-- Thai names everywhere, reports in two languages, and delivery by email.
--
-- Three problems, one migration, because they are the same problem seen from
-- three angles: this organisation works in Thai and the database only speaks
-- English.
--
-- 1. A teacher has full_name_th. A student and a school have nothing. So a
--    Thai report about "Mali" at "Ban Huai Nam Rin School" renders two Latin
--    names inside a Thai sentence, which is how you can tell software was not
--    built for the people using it.
--
-- 2. A report has one comment field, so it has one language. The donor who
--    asked for Thai on the form gets English, or gets nothing.
--
-- 3. Approval had nowhere to record that the report actually reached anybody.
--    With no donor dashboard, the email IS the delivery: a report that was
--    approved and whose email failed is a report nobody received, and until
--    now that state could not be written down.

-- ---------------------------------------------------------------------------
-- 1. Thai names
-- ---------------------------------------------------------------------------

-- Nullable in the database, required in the forms.
--
-- A NOT NULL here would reject every existing student and school on the next
-- write, and there is no honest default: a placeholder Thai name is worse than
-- an absent one, because it looks filled in. So the constraint lives in the UI
-- for new and edited records, and the profile-completion checklist surfaces the
-- existing gaps as work rather than as errors.
alter table public.students
  add column if not exists name_th text;

alter table public.schools
  add column if not exists name_th text;

comment on column public.students.name_th is 'The student''s name in Thai script. Required by the forms; nullable here so existing records are a backlog rather than a wall.';
comment on column public.schools.name_th is 'The school''s name in Thai script. Falls back to name where absent.';

-- profiles.full_name_th already exists from the teacher migration. Nothing to
-- add; the form simply stops treating it as optional.

-- ---------------------------------------------------------------------------
-- 2. Reports in two languages
-- ---------------------------------------------------------------------------

-- `donor_comment` stays: it is what the teacher wrote, in whichever language
-- they think in, and every existing screen reads it. These two are what the
-- donor receives, and which one is sent is decided by donors.preferred_language.
alter table public.term_updates
  add column if not exists donor_comment_en text,
  add column if not exists donor_comment_th text,
  add column if not exists grade_text_en text,
  add column if not exists grade_text_th text,
  -- Which language the teacher originally wrote in. Without this the verify
  -- screen cannot tell an untranslated report from one written in English and
  -- would ask an admin to "translate" a field that is already correct.
  add column if not exists source_language text
    check (source_language is null or source_language in ('en', 'th'));

comment on column public.term_updates.donor_comment_en is 'The donor-facing update in English. Written or checked by a person at verification, never machine-translated.';
comment on column public.term_updates.source_language is 'The language the teacher wrote in. The other column is the one somebody has to fill.';

-- Everything already written was written in English by the current forms.
update public.term_updates
set donor_comment_en = coalesce(donor_comment_en, donor_comment),
    grade_text_en = coalesce(grade_text_en, grade_text),
    source_language = coalesce(source_language, 'en')
where donor_comment is not null
   or grade_text is not null;

-- ---------------------------------------------------------------------------
-- 3. Delivery
-- ---------------------------------------------------------------------------

alter table public.term_updates
  add column if not exists sent_at timestamp with time zone,
  -- Who it went to and at which address, frozen at send time. A donor who
  -- changes their email next year must not silently rewrite the record of what
  -- was sent to them last year.
  add column if not exists sent_to jsonb,
  add column if not exists send_error text,
  add column if not exists send_attempted_at timestamp with time zone;

comment on column public.term_updates.sent_to is 'Array of { donor_id, name, email, language } as at the moment of sending.';
comment on column public.term_updates.send_error is 'The last failure. Present means approved but not delivered, which is a state the reports table must be able to show.';

-- ---------------------------------------------------------------------------
-- 4. The balance alert
-- ---------------------------------------------------------------------------

-- One column, computed once, so the donors table, the dashboard count and the
-- sentence on the balance card cannot disagree about who is short.
-- security_invoker matters here and was missing from the first version of this
-- view. Without it a view runs as its owner and reads straight past the RLS on
-- donors and scholarships, so any signed-in account querying donor_balance
-- would see every donor's money. `create or replace` does not inherit the
-- setting, so it has to be stated every time the view is rewritten.
drop view if exists public.student_donors cascade;
drop view if exists public.student_coverage cascade;
drop view if exists public.donor_balance cascade;

create or replace view public.donor_balance
with (security_invoker = true)
as
with given as (
  select donor_id, coalesce(sum(amount_thb), 0) as total_given
  from public.donor_contributions
  where voided_at is null
  group by donor_id
),
committed as (
  select
    donor_id,
    coalesce(sum(coalesce(monthly_amount_thb, amount_thb)), 0) as monthly_committed,
    coalesce(sum(amount_thb), 0) as total_committed
  from public.scholarships
  where status = 'active'
    and ended_at is null
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
  -- The alert. A donor with nothing committed is not "short" — they have
  -- nothing to be short for — so a zero commitment is always covered.
  (coalesce(c.monthly_committed, 0) = 0
    or (coalesce(g.total_given, 0) - coalesce(c.total_committed, 0))
       >= coalesce(c.monthly_committed, 0)) as covers_next_month,
  greatest(
    coalesce(c.monthly_committed, 0)
      - (coalesce(g.total_given, 0) - coalesce(c.total_committed, 0)),
    0
  ) as shortfall_next_month_thb
from public.donors d
  left join given g on g.donor_id = d.id
  left join committed c on c.donor_id = d.id;

comment on view public.donor_balance is 'Given minus committed, plus whether the free balance covers one more month of commitments. covers_next_month is the single source for the low-balance alert.';

-- student_coverage and student_donors shipped with the same omission. Replaced
-- here with the setting applied and their definitions otherwise untouched.
create or replace view public.student_coverage
with (security_invoker = true)
as
with covered as (
  select
    student_id,
    coalesce(sum(coalesce(monthly_amount_thb, amount_thb)), 0) as monthly_covered,
    count(*) as donor_count
  from public.scholarships
  where status = 'active'
    and ended_at is null
    and coverage_start <= current_date
    and (coverage_end is null or coverage_end >= current_date)
  group by student_id
)
select
  s.id as student_id,
  s.name as student_name,
  s.name_th as student_name_th,
  s.school_id,
  coalesce(s.monthly_support_expected, gt.amount_per_period, 0) as monthly_need_thb,
  coalesce(c.monthly_covered, 0) as monthly_covered_thb,
  greatest(
    coalesce(s.monthly_support_expected, gt.amount_per_period, 0) - coalesce(c.monthly_covered, 0),
    0
  ) as monthly_gap_thb,
  coalesce(c.donor_count, 0)::int as donor_count,
  s.monthly_support_expected is null and gt.amount_per_period is null as need_unknown
from public.students s
  left join public.grant_types gt on gt.id = s.grant_type_id
  left join covered c on c.student_id = s.id;

create or replace view public.student_donors
with (security_invoker = true)
as
select
  sc.student_id,
  sc.donor_id,
  d.name as donor_name,
  coalesce(d.preferred_language, 'en') as donor_language,
  sc.id as scholarship_id,
  coalesce(sc.monthly_amount_thb, sc.amount_thb) as monthly_amount_thb,
  sc.coverage_start,
  sc.coverage_end
from public.scholarships sc
  join public.donors d on d.id = sc.donor_id
where sc.status = 'active'
  and sc.ended_at is null;

-- ---------------------------------------------------------------------------
-- 5. Releasing money when a scholarship ends early
-- ---------------------------------------------------------------------------

-- Ending a scholarship returns the uncommitted remainder to the donor's free
-- balance. That happens automatically, because the balance is a view over
-- active scholarships and an ended one drops out of the sum.
--
-- What does NOT happen automatically is anybody being able to see that it
-- happened. A balance that jumps by 14,000 with no row behind it is exactly the
-- kind of number people stop trusting. So ending a scholarship writes its own
-- ledger entry.
create table if not exists public.scholarship_releases (
  id uuid primary key default extensions.uuid_generate_v4(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  donor_id uuid not null references public.donors (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  released_thb numeric(12, 2) not null,
  reason text,
  released_on date not null default current_date,
  created_by uuid references auth.users (id),
  created_at timestamp with time zone default now()
);

create index if not exists scholarship_releases_donor_idx
  on public.scholarship_releases (donor_id, released_on desc);

comment on table public.scholarship_releases is 'What came back to a donor''s free balance when a commitment ended early. The balance already reflects it; this is why.';

alter table public.scholarship_releases enable row level security;

do $$
begin
  create policy scholarship_releases_admin_all on public.scholarship_releases
    for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy scholarship_releases_donor_read on public.scholarship_releases
    for select using (
      exists (
        select 1 from public.donors d
        where d.id = scholarship_releases.donor_id
          and d.user_id = auth.uid()
      )
    );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 6. What the email needs, in one read
-- ---------------------------------------------------------------------------

-- The edge function runs with the service key and has no React app to assemble
-- a payload for it. Everything one report email needs — the child, her school,
-- both languages, and every donor who should receive it with the language they
-- asked for — comes from here.
-- This one carries every funding donor's name and email address. The edge
-- function reads it with the service key, which bypasses RLS regardless; the
-- grant below is what a signed-in browser gets, and without security_invoker
-- that browser is every donor's contact list.
create or replace view public.report_email_payload
with (security_invoker = true)
as
select
  t.id as report_id,
  t.student_id,
  s.name as student_name,
  s.name_th as student_name_th,
  s.grade_level,
  s.profile_photo_path,
  sch.name as school_name,
  sch.name_th as school_name_th,
  t.report_date,
  t.covers_start,
  t.covers_end,
  t.donor_comment_en,
  t.donor_comment_th,
  t.grade_text_en,
  t.grade_text_th,
  t.attachments,
  t.status,
  t.sent_at,
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'donor_id', d.id,
          'name', d.name,
          'email', d.contact ->> 'email',
          'language', coalesce(d.preferred_language, 'en')
        )
      ),
      '[]'::jsonb
    )
    from public.scholarships sc
      join public.donors d on d.id = sc.donor_id
    where sc.student_id = t.student_id
      and sc.status = 'active'
      and sc.ended_at is null
  ) as recipients
from public.term_updates t
  left join public.students s on s.id = t.student_id
  left join public.schools sch on sch.id = s.school_id;

comment on view public.report_email_payload is 'Everything one report email needs, including every funding donor and the language each of them asked for.';

grant select on public.report_email_payload to authenticated;
grant select on public.donor_balance to authenticated;
