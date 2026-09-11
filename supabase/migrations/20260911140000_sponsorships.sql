-- Sponsorship: a donor funding a student, as something every screen agrees on.
--
-- Brief: design/donor-sponsorship/DESIGN_BRIEF.md (task "Sponsorship data and
-- status badge"). Runs after 20260911130000. Every statement is safe to run
-- twice.
--
-- `scholarships` already is the sponsorship: donor, student, amount, dates.
-- 20260911100000_donor_records.sql adopted the status vocabulary this needs
-- (active | needs_decision | ended) and re-created donor_balance so money in
-- needs_decision stays committed. What the row still lacked was everything
-- about the relationship rather than the money: what kind of support it is,
-- whether this donor wants this student's reports, whether it renews itself,
-- why it is waiting on a decision, and whether the donor has been welcomed.

-- ---------------------------------------------------------------------------
-- 1. The relationship
-- ---------------------------------------------------------------------------

alter table public.scholarships
  add column if not exists support_type text,
  add column if not exists item_description text,
  add column if not exists report_emails_enabled boolean not null default true,
  add column if not exists auto_renew boolean not null default true,
  add column if not exists decision_reason text,
  add column if not exists decision_since timestamptz,
  add column if not exists renewed_from_id uuid,
  add column if not exists welcome_sent_at timestamptz,
  add column if not exists welcome_skipped_at timestamptz,
  add column if not exists updated_at timestamptz;

-- Existing rows get a support type from the numbers they already carry: a
-- monthly amount that meets the student's need is full support, anything less
-- is partial. A student with no recorded need cannot be judged, so partial.
update public.scholarships sc
set support_type = case
  when coalesce(sc.monthly_amount_thb, sc.amount_thb) >= coalesce(s.monthly_support_expected, gt.amount_per_period)
    then 'full'
  else 'partial'
end
from public.students s
  left join public.grant_types gt on gt.id = s.grant_type_id
where s.id = sc.student_id
  and sc.support_type is null;

update public.scholarships set support_type = 'partial' where support_type is null;

alter table public.scholarships alter column support_type set default 'partial';
alter table public.scholarships alter column support_type set not null;

do $$
begin
  alter table public.scholarships
    add constraint scholarships_support_type_check check (support_type in ('full', 'partial', 'specific_item'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.scholarships
    add constraint scholarships_decision_reason_check check (
      decision_reason is null or decision_reason in ('student_archived', 'renewal_short', 'graduated')
    );
exception when duplicate_object then null;
end $$;

-- A decision reason belongs to a row waiting on a decision, and only then.
do $$
begin
  alter table public.scholarships
    add constraint scholarships_decision_state_check check (
      (status = 'needs_decision') = (decision_reason is not null)
    );
exception when duplicate_object then null;
end $$;

comment on column public.scholarships.support_type is 'full: covers the student''s monthly need. partial: part of it. specific_item: a one off item (uniform, fees) described in item_description.';
comment on column public.scholarships.report_emails_enabled is 'Whether this donor receives this student''s reports. Both this and donors.wants_email_updates must be on.';
comment on column public.scholarships.auto_renew is 'Renew for the next school year on coverage_end when the donor''s free balance covers it.';
comment on column public.scholarships.decision_reason is 'Why the row is in needs_decision: the student was archived or graduated, or the balance could not cover renewal.';
comment on column public.scholarships.renewed_from_id is 'The row this one renewed. Renewals form a chain, so history reads as one relationship.';
comment on column public.scholarships.welcome_sent_at is 'When the welcome email for this donor and student went out. A renewal never sends another.';

-- Relationships that existed before this migration were never going to be
-- welcomed. Marking them skipped keeps the admin's queue to new ones only.
update public.scholarships
set welcome_skipped_at = coalesce(created_at, now())
where welcome_sent_at is null
  and welcome_skipped_at is null;

drop trigger if exists scholarships_updated_at on public.scholarships;
create trigger scholarships_updated_at
  before update on public.scholarships
  for each row execute function public.update_updated_at();

create index if not exists idx_scholarships_student_active
  on public.scholarships (student_id) where status = 'active';
create index if not exists idx_scholarships_needs_decision
  on public.scholarships (decision_since) where status = 'needs_decision';
create index if not exists idx_scholarships_renewal_due
  on public.scholarships (coverage_end) where status = 'active' and auto_renew;

-- ---------------------------------------------------------------------------
-- 2. Who can be shown to a donor
-- ---------------------------------------------------------------------------

-- The gates already exist on the student row. This view states them once, so
-- the assign drawer, the directory filter and anything after them cannot
-- disagree about who is ready. Every enrolled student is in the programme to be
-- funded, so there is no separate "accepting donations" flag.
create or replace view public.student_sponsor_eligibility
with (security_invoker = true)
as
with gates as (
  select
    s.id as student_id,
    array_remove(array[
      case when coalesce(s.status, 'enrolled') <> 'enrolled' then 'archived' end,
      case when coalesce(s.consent_status, 'pending') = 'pending' then 'consent_pending' end,
      case when s.consent_status = 'declined' then 'consent_declined' end,
      case when coalesce(s.donor_profile_status, 'draft') <> 'published' then 'profile_unpublished' end
    ], null) as missing_gates
  from public.students s
),
active as (
  select student_id, count(*)::int as active_count
  from public.scholarships
  where status = 'active'
  group by student_id
)
select
  g.student_id,
  cardinality(g.missing_gates) = 0 as is_eligible,
  g.missing_gates,
  coalesce(a.active_count, 0) as active_sponsorships
from gates g
  left join active a on a.student_id = g.student_id;

comment on view public.student_sponsor_eligibility is 'Whether a student can be assigned to a donor, and which gates are missing when not. active_sponsorships counts the donors funding them now.';

grant select on public.student_sponsor_eligibility to authenticated;
