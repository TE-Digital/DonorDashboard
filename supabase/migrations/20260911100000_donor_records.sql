-- Donor records: who a donor is, one status vocabulary for scholarships, a
-- link back to the old award a row was copied from, and a balance that knows
-- when money last arrived.
--
-- Brief: design/donor-records-and-payments/DESIGN_BRIEF.md (task 1.2).
-- Runs after 20260911090000. Every statement is safe to run twice.

-- ---------------------------------------------------------------------------
-- 1. Who the donor is
-- ---------------------------------------------------------------------------

-- Many donors are companies and foundations, and the record treated all of them
-- as a person. The type decides which fields the form asks for; an
-- organisation's reports are addressed to its contact person, not to
-- "Dear Acme Foundation". Existing rows become individuals, which is what the
-- form has always assumed.
alter table public.donors
  add column if not exists donor_type text not null default 'individual',
  add column if not exists contact_person text,
  add column if not exists country text;

do $$
begin
  alter table public.donors
    add constraint donors_donor_type_check check (donor_type in ('individual', 'organisation'));
exception when duplicate_object then null;
end $$;

-- ISO 3166-1 alpha-2, upper case. Optional: blank means nobody recorded it.
do $$
begin
  alter table public.donors
    add constraint donors_country_check check (country is null or country ~ '^[A-Z]{2}$');
exception when duplicate_object then null;
end $$;

comment on column public.donors.contact_person is 'Organisations only. Required by the form for organisations; reports to an organisation are addressed to this person.';
comment on column public.donors.country is 'ISO 3166-1 alpha-2. Optional. Drives the phone field''s dialling code.';

-- Phones become E.164 where the stored value is unambiguous. Only three shapes
-- are rewritten: an international number with spacing or dashes, a Thai number
-- written locally (0 plus 8 or 9 digits), and a Thai number missing its plus.
-- Anything else is left exactly as typed. The donors list's "Phone needs
-- fixing" filter finds those, so a person decides rather than this migration
-- guessing.
update public.donors d
set contact = jsonb_set(d.contact, '{phone}', to_jsonb(n.normalised))
from (
  select
    id,
    case
      when regexp_replace(contact ->> 'phone', '[^0-9+]', '', 'g') ~ '^\+[1-9][0-9]{7,14}$'
        then regexp_replace(contact ->> 'phone', '[^0-9+]', '', 'g')
      when regexp_replace(contact ->> 'phone', '[^0-9]', '', 'g') ~ '^0[0-9]{8,9}$'
        then '+66' || substr(regexp_replace(contact ->> 'phone', '[^0-9]', '', 'g'), 2)
      when regexp_replace(contact ->> 'phone', '[^0-9]', '', 'g') ~ '^66[0-9]{8,9}$'
        then '+' || regexp_replace(contact ->> 'phone', '[^0-9]', '', 'g')
    end as normalised
  from public.donors
  where nullif(btrim(contact ->> 'phone'), '') is not null
) n
where d.id = n.id
  and n.normalised is not null
  and n.normalised is distinct from d.contact ->> 'phone';

-- ---------------------------------------------------------------------------
-- 2. One status vocabulary for scholarships
-- ---------------------------------------------------------------------------

-- The live check allows only 'active' and 'inactive'. Copying old awards needs
-- 'ended', and the sponsorship work needs 'needs_decision', so the vocabulary
-- both briefs use is adopted here, once. 'inactive' rows become 'ended'. Their
-- end date is not known, so ended_at is left empty rather than invented; the
-- status alone keeps them out of every commitment total.
alter table public.scholarships drop constraint if exists scholarships_status_check;

update public.scholarships
set status = 'ended',
    ended_reason = coalesce(ended_reason, 'Marked inactive before statuses were renamed')
where status = 'inactive';

alter table public.scholarships
  add constraint scholarships_status_check check (status in ('active', 'needs_decision', 'ended'));

-- ---------------------------------------------------------------------------
-- 3. Where a copied row came from
-- ---------------------------------------------------------------------------

-- Set only on rows copied from scholarship_awards. Unique, so copying twice is
-- impossible rather than merely unlikely: a re-run of the copy finds the award
-- already taken and moves on.
alter table public.scholarships add column if not exists source_award_id uuid;
alter table public.donor_contributions add column if not exists source_award_id uuid;

create unique index if not exists idx_scholarships_source_award_id_unique
  on public.scholarships (source_award_id) where source_award_id is not null;
create unique index if not exists idx_donor_contributions_source_award_id_unique
  on public.donor_contributions (source_award_id) where source_award_id is not null;

-- ---------------------------------------------------------------------------
-- 4. donor_balance, once
-- ---------------------------------------------------------------------------

-- Re-created from the 20260831090000 version with three changes:
--
--   * last_received_on, for the donors list's "Last payment" column and the
--     overview KPI. Appended at the end: `create or replace view` may add
--     columns but not reorder them.
--   * Committed money counts EVERY scholarship at its amount_thb, ended ones
--     included. Before, an ended scholarship dropped out of committed entirely,
--     months already paid out included, so money a donor had already spent
--     became allocatable again the day the scholarship ended (found
--     2026-09-11 by the sponsorship session). An ended row's amount_thb means
--     "what was actually used": ending one early trims it to the months covered
--     and records the unspent remainder in scholarship_releases, which is how
--     money genuinely returns to the balance. needs_decision rows count too,
--     because returning money silently is a decision.
--   * monthly_committed stays forward-looking: active and needs_decision rows
--     that haven't ended. It drives "short next month", which is about the
--     future, not about money already used.
--   * The access rule comes back. 20260830090000 limited this view to admins
--     and the donor themselves; 20260831090000 re-created it without that
--     clause. With security_invoker and an all_read policy still on donors,
--     every signed-in account could then read every donor's giving.
create or replace view public.donor_balance
with (security_invoker = true)
as
with given as (
  select
    donor_id,
    coalesce(sum(amount_thb), 0) as total_given,
    max(received_on) as last_received_on
  from public.donor_contributions
  where voided_at is null
  group by donor_id
),
committed as (
  select
    donor_id,
    coalesce(
      sum(coalesce(monthly_amount_thb, amount_thb))
        filter (where status in ('active', 'needs_decision') and ended_at is null),
      0
    ) as monthly_committed,
    coalesce(sum(amount_thb), 0) as total_committed
  from public.scholarships
  group by donor_id
)
select
  d.id as donor_id,
  d.name as donor_name,
  d.preferred_language,
  coalesce(g.total_given, 0) as total_given_thb,
  coalesce(c.total_committed, 0) as total_committed_thb,
  coalesce(g.total_given, 0) - coalesce(c.total_committed, 0) as free_balance_thb,
  coalesce(c.monthly_committed, 0) as monthly_committed_thb,
  -- A donor with nothing committed is not "short"; they have nothing to be
  -- short for, so a zero commitment is always covered.
  (coalesce(c.monthly_committed, 0) = 0
    or (coalesce(g.total_given, 0) - coalesce(c.total_committed, 0))
       >= coalesce(c.monthly_committed, 0)) as covers_next_month,
  greatest(
    coalesce(c.monthly_committed, 0)
      - (coalesce(g.total_given, 0) - coalesce(c.total_committed, 0)),
    0
  ) as shortfall_next_month_thb,
  g.last_received_on
from public.donors d
  left join given g on g.donor_id = d.id
  left join committed c on c.donor_id = d.id
where public.is_admin() or d.user_id = auth.uid();

comment on view public.donor_balance is 'Given minus committed. Committed is every scholarship at its amount_thb, ended ones included (an ended row holds what was actually used; an early end trims it and writes the remainder to scholarship_releases). monthly_committed_thb is forward-looking: active and needs_decision only. free_balance_thb goes negative when more is allocated than given; that is shown, not clamped. Admins see every donor; a donor sees only their own row.';

grant select on public.donor_balance to authenticated;
