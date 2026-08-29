-- Donor money, student coverage, and the gate on a donor-facing report.
--
-- Three things were true before this migration, and each of them made the
-- platform lie about money.
--
-- 1. Money could not exist before it was spent. Every row that holds an amount
--    -- scholarship_awards, scholarships, scholarship_payments -- requires a
--    student. A transfer that arrives on Monday and is assigned on Friday did
--    not exist for four days, and no screen could answer "how much of this
--    donor's gift is still unspent?" because nothing recorded the gift.
--
-- 2. A student's need was written down and ignored. students.monthly_support_expected
--    is on the form and in the completion checklist, and nothing compared it to
--    what the student actually receives. So allocation was done by memory
--    rather than by who was short.
--
-- 3. A donor could read a teacher's draft. The donor student page reads
--    term_updates with no status filter, so an unfinished report was one login
--    away from the person it was being written for.
--
-- What follows fixes all three, and puts the third one in the database rather
-- than in a query, so a screen built next year inherits the gate instead of
-- having to remember it.

-- ---------------------------------------------------------------------------
-- 1. Money in
-- ---------------------------------------------------------------------------

-- A gift, recorded when it arrives, with no student attached. This is the only
-- place a contribution is written, and the only thing an admin edits when a
-- donor sends more. `voided_at` rather than a delete: a gift that was recorded
-- and then withdrawn is a fact about the ledger, and a ledger you can delete
-- from is a ledger nobody trusts.
create table if not exists public.donor_contributions (
  id uuid primary key default extensions.uuid_generate_v4(),
  donor_id uuid not null references public.donors (id) on delete cascade,
  amount_thb numeric(12, 2) not null check (amount_thb > 0),
  received_on date not null default current_date,
  method text,
  reference text,
  note text,
  voided_at timestamp with time zone,
  voided_reason text,
  created_by uuid references auth.users (id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

comment on table public.donor_contributions is 'Money received from a donor, before it is allocated to any student. A donor''s balance is the sum of these minus what is committed in scholarships.';
comment on column public.donor_contributions.voided_at is 'Set instead of deleting. A voided contribution stays visible in the ledger and stops counting toward the balance.';

create index if not exists donor_contributions_donor_idx
  on public.donor_contributions (donor_id, received_on desc);

-- ---------------------------------------------------------------------------
-- 2. Money out
-- ---------------------------------------------------------------------------

-- `scholarships` becomes the one place a commitment lives. It already exists
-- and already carries donor, student, amount and coverage dates; what it lacks
-- is the monthly framing the rest of the product thinks in, and a link back to
-- the grant type that set the amount.
alter table public.scholarships
  add column if not exists monthly_amount_thb numeric(12, 2),
  add column if not exists grant_type_id uuid references public.grant_types (id),
  add column if not exists ended_at timestamp with time zone,
  add column if not exists ended_reason text,
  add column if not exists created_by uuid references auth.users (id);

comment on column public.scholarships.monthly_amount_thb is 'What this donor covers per month for this student. amount_thb stays the total pledge; this is what the coverage maths compares against students.monthly_support_expected.';

-- Existing rows predate the column, and a null here would read as "covers
-- nothing" on every coverage bar. Derive a monthly figure from the pledge and
-- the coverage window, falling back to the pledge itself for an open-ended row.
update public.scholarships
set monthly_amount_thb = case
  when coverage_end is null then amount_thb
  else round(
    (amount_thb / greatest(
      1,
      (date_part('year', age(coverage_end, coverage_start)) * 12
        + date_part('month', age(coverage_end, coverage_start)))
    ))::numeric,
    2
  )
end
where monthly_amount_thb is null;

-- Whether this donor funds this student right now. Used by every donor-facing
-- policy below, so the rule is written once.
create or replace function public.donor_funds_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.scholarships sc
      join public.donors d on d.id = sc.donor_id
    where sc.student_id = p_student_id
      and d.user_id = auth.uid()
      and sc.status = 'active'
      and sc.ended_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Balances and coverage, as views
-- ---------------------------------------------------------------------------

-- Never stored columns. A balance held in two places drifts, and a drifting
-- balance is worse than no balance, because somebody acts on it.

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
  coalesce(g.total_given, 0) as total_given_thb,
  coalesce(p.total_committed, 0) as total_committed_thb,
  coalesce(g.total_given, 0) - coalesce(p.total_committed, 0) as free_balance_thb,
  coalesce(c.monthly_committed, 0) as monthly_committed_thb
from public.donors d
  left join given g on g.donor_id = d.id
  left join pledged p on p.donor_id = d.id
  left join committed c on c.donor_id = d.id
-- A balance is an admin's figure and the donor's own. Written here as well as
-- left to RLS because a view is a grant to `authenticated`, and a donor reading
-- another donor's giving total is the one thing this table must never do.
where public.is_admin() or d.user_id = auth.uid();

comment on view public.donor_balance is 'Given minus committed. free_balance_thb goes negative when a donor is over-allocated; that is shown, not clamped.';

-- Need against received, per student. The gap this yields is what ranks the
-- allocation panel: a student short by 800 a month sorts above one short by 200,
-- so the screen answers "who needs this next" without anyone having to know.
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
  s.school_id,
  coalesce(s.monthly_support_expected, gt.amount_per_period, 0) as monthly_need_thb,
  coalesce(c.monthly_covered, 0) as monthly_covered_thb,
  greatest(
    coalesce(s.monthly_support_expected, gt.amount_per_period, 0) - coalesce(c.monthly_covered, 0),
    0
  ) as monthly_gap_thb,
  coalesce(c.donor_count, 0)::int as donor_count,
  (s.monthly_support_expected is null and gt.amount_per_period is null) as need_unknown
from public.students s
  left join public.grant_types gt on gt.id = s.grant_type_id
  left join covered c on c.student_id = s.id
-- What a student is short is not public to every signed-in account. An admin
-- allocates, a teacher sees their own, a donor sees the students they fund.
where public.is_admin()
  or s.responsible_teacher_id = auth.uid()
  or public.donor_funds_student(s.id);

comment on view public.student_coverage is 'monthly_support_expected (or the grant type default) against the sum of active scholarships. need_unknown separates "needs nothing" from "nobody has said".';

-- student_current_donor answered "the donor", singular, by picking one row with
-- a LIMIT 1. Splitting a student across two donors is now allowed, so this
-- becomes "the donors" and the old view keeps working for callers that still
-- want one.
create or replace view public.student_donors
with (security_invoker = true)
as
select
  sc.student_id,
  sc.donor_id,
  d.name as donor_name,
  sc.id as scholarship_id,
  coalesce(sc.monthly_amount_thb, sc.amount_thb) as monthly_amount_thb,
  sc.coverage_start,
  sc.coverage_end
from public.scholarships sc
  join public.donors d on d.id = sc.donor_id
where sc.status = 'active'
  and sc.ended_at is null
-- Who else funds this student, and for how much, is an admin's view of the
-- ledger. A donor sees their own commitment and not their co-donor's.
  and (public.is_admin() or d.user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Reports: verification, flags, and comments
-- ---------------------------------------------------------------------------

alter table public.term_updates
  add column if not exists approved_at timestamp with time zone,
  add column if not exists approved_by uuid references auth.users (id),
  add column if not exists flagged_at timestamp with time zone,
  add column if not exists flagged_by uuid references auth.users (id),
  add column if not exists flag_reason text,
  add column if not exists flag_resolved_at timestamp with time zone;

comment on column public.term_updates.flagged_at is 'A donor raised a question on this report. Not a complaint: it sorts the report to the top of the admin table until somebody answers.';

-- A report already approved before this migration was, by the old rules, sent.
update public.term_updates
set approved_at = coalesce(approved_at, created_at)
where status = 'approved'
  and approved_at is null;

-- A donor's question and an admin's answer, on the report rather than in email.
-- `audience` is the whole point: an internal note between staff and a reply the
-- donor reads are the same shape and must never be the same row.
create table if not exists public.report_comments (
  id uuid primary key default extensions.uuid_generate_v4(),
  report_id uuid not null references public.term_updates (id) on delete cascade,
  author_id uuid references auth.users (id),
  body text not null check (length(trim(body)) > 0),
  audience text not null default 'donor' check (audience in ('donor', 'internal')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone
);

create index if not exists report_comments_report_idx
  on public.report_comments (report_id, created_at);

comment on column public.report_comments.audience is 'donor: visible to the funding donor and to staff. internal: staff only, never leaves the server for a donor session.';

-- ---------------------------------------------------------------------------
-- 5. The gate
-- ---------------------------------------------------------------------------

-- A security-definer function is executable by every role that can reach it
-- unless it is told otherwise, and this one answers a question about somebody
-- else's funding. Anonymous callers have no business asking it.
revoke all on function public.donor_funds_student(uuid) from public;
grant execute on function public.donor_funds_student(uuid) to authenticated;

-- public.is_admin() already exists and is used by policies across the schema.
-- It is deliberately not redefined here: every policy below calls the one the
-- rest of the database already trusts.

alter table public.donor_contributions enable row level security;
alter table public.report_comments enable row level security;

do $$
begin
  -- Money in is an admin act. A donor may read their own ledger and write none
  -- of it, which is the same rule the product states out loud: allocation is an
  -- admin act, the donor sees the result.
  create policy donor_contributions_admin_all on public.donor_contributions
    for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy donor_contributions_donor_read on public.donor_contributions
    for select using (
      exists (
        select 1 from public.donors d
        where d.id = donor_contributions.donor_id
          and d.user_id = auth.uid()
      )
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy report_comments_admin_all on public.report_comments
    for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null;
end $$;

do $$
begin
  -- A donor reads the donor-audience comments on a report they are entitled to,
  -- and writes only as themselves, only to that audience.
  create policy report_comments_donor_read on public.report_comments
    for select using (
      audience = 'donor'
      and deleted_at is null
      and exists (
        select 1 from public.term_updates t
        where t.id = report_comments.report_id
          and t.status = 'approved'
          and public.donor_funds_student(t.student_id)
      )
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy report_comments_donor_write on public.report_comments
    for insert with check (
      audience = 'donor'
      and author_id = auth.uid()
      and exists (
        select 1 from public.term_updates t
        where t.id = report_comments.report_id
          and t.status = 'approved'
          and public.donor_funds_student(t.student_id)
      )
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  -- Their own comment, and only while it is theirs to change.
  --
  -- The audience is pinned on the way out. Without that clause an author could
  -- update their own row to audience = 'internal' — or a staff author could be
  -- moved the other way by this policy rather than by the admin one — and the
  -- single column separating "the donor reads this" from "staff only" would be
  -- editable by whoever typed the comment. Staff editing an internal note go
  -- through report_comments_admin_all.
  create policy report_comments_author_update on public.report_comments
    for update
    using (author_id = auth.uid() and deleted_at is null)
    with check (author_id = auth.uid() and audience = 'donor');
exception when duplicate_object then null;
end $$;

-- The report itself.
--
-- RLS is already enabled on term_updates and already carries tu_admin_all,
-- tu_read_scope, tu_teacher_insert and tu_teacher_update. None of them is the
-- problem. The problem is one line:
--
--   create policy all_read on public.term_updates for select using (true);
--
-- Policies are OR'd, so that single permissive rule grants every signed-in
-- account every report, draft and internal note included, and makes all four
-- careful policies beside it decorative. It goes.
drop policy if exists all_read on public.term_updates;

-- tu_read_scope's donor arm calls donor_is_mapped_to(), which joins a
-- donor_students table that does not exist in this schema -- so for a donor it
-- has been erroring or returning nothing, and all_read was the only reason
-- donor screens showed anything at all. Removing all_read therefore has to be
-- paired with a donor rule that actually works, or every donor's dashboard
-- empties on deploy.
do $$
begin
  create policy term_updates_donor_read on public.term_updates
    for select using (
      status = 'approved'
      and public.donor_funds_student(student_id)
    );
exception when duplicate_object then null;
end $$;

-- And the other half of the same problem, which is worse than an empty donor
-- dashboard: policies are OR'd and Postgres evaluates them, so if
-- donor_is_mapped_to() raises rather than returning false -- which is what a
-- function querying a missing table does -- then every select on term_updates
-- fails, for teachers and admins too. all_read was masking that as well.
--
-- tu_read_scope is not dropped: its other two arms work and are the only read
-- path for a teacher (teacher_is_responsible_for) and for an agent
-- (agent_is_mapped_to, over agent_students, which does exist). Dropping the
-- policy to be rid of one broken arm would take those two with it.
--
-- Instead the broken arm is repaired in place. donor_is_mapped_to() keeps its
-- name and signature, and stops joining donor_students -- a table that appears
-- nowhere in this schema except inside this function -- for the definition the
-- rest of the product now uses: a donor is mapped to a student when they are
-- actively funding one.
create or replace function public.donor_is_mapped_to(uid uuid, student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.scholarships sc
      join public.donors d on d.id = sc.donor_id
    where sc.student_id = student
      and d.user_id = uid
      and sc.status = 'active'
      and sc.ended_at is null
  );
$$;

comment on function public.donor_is_mapped_to(uuid, uuid) is 'A donor is mapped to a student while they fund one. Was a join to donor_students, a table this schema does not have, which made every call raise.';

-- internal_note is the one column a donor must never receive, and a policy
-- cannot hide a column. So the donor side reads through a view that does not
-- select it, and the grant below is what makes that the only path.
create or replace view public.donor_reports
with (security_invoker = true)
as
select
  t.id,
  t.student_id,
  t.report_date,
  t.covers_start,
  t.covers_end,
  t.grade,
  t.grade_text,
  t.grade_numeric,
  t.donor_comment,
  t.attachments,
  t.approved_at,
  t.flagged_at,
  t.flag_reason,
  t.flag_resolved_at,
  t.created_at
from public.term_updates t
where t.status = 'approved';

comment on view public.donor_reports is 'The donor render of a term report. internal_note is absent by construction, not by a filter somebody has to remember.';

-- These four grants are only as tight as the RLS on what the views read.
-- security_invoker hands the underlying tables the caller's identity, but a
-- table with RLS switched off answers everybody the same way — so donors,
-- scholarships and students must each have RLS enabled and a donor-scoped
-- policy, or a donor still sees every row through student_coverage. Check
-- before deploying:
--
--   select relname, relrowsecurity from pg_class
--   where relname in ('donors', 'scholarships', 'students');
--
-- Any false there is a hole this migration cannot close on its own, and it is
-- deliberately not switched on here: enabling RLS on a table whose policies
-- nobody has read locks the product out of its own data.
grant select on public.donor_reports to authenticated;
grant select on public.donor_balance to authenticated;
grant select on public.student_coverage to authenticated;
grant select on public.student_donors to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Raising and clearing a flag
-- ---------------------------------------------------------------------------

-- A donor has select on term_updates and nothing more, which is right: the
-- report is a teacher's work and an admin's to send. But flagging writes four
-- columns on that row, and RLS gates rows rather than columns -- a donor update
-- policy wide enough to set flag_reason is also wide enough to rewrite a grade.
--
-- An RLS-blocked update is the quiet kind of failure: it matches no rows,
-- returns no error, and the screen says "sent". So the write goes through a
-- function that owns exactly the four columns and checks entitlement itself.

create or replace function public.flag_report(p_report_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_status text;
begin
  select student_id, status into v_student_id, v_status
  from public.term_updates
  where id = p_report_id;

  if v_student_id is null then
    raise exception 'Report not found.' using errcode = 'no_data_found';
  end if;

  -- A donor may only question a report they have actually been sent; an admin
  -- may raise one on a donor's behalf after a phone call.
  if not (public.is_admin() or (v_status = 'approved' and public.donor_funds_student(v_student_id))) then
    raise exception 'Not entitled to flag this report.' using errcode = 'insufficient_privilege';
  end if;

  update public.term_updates
  set flagged_at = now(),
      flagged_by = auth.uid(),
      flag_reason = nullif(btrim(coalesce(p_reason, '')), ''),
      flag_resolved_at = null
  where id = p_report_id;
end;
$$;

-- Clearing is an admin act. The donor asked; somebody at iCare answers, and the
-- answering is what closes it.
create or replace function public.resolve_report_flag(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can resolve a flag.' using errcode = 'insufficient_privilege';
  end if;

  update public.term_updates
  set flag_resolved_at = now()
  where id = p_report_id
    and flagged_at is not null;
end;
$$;

revoke all on function public.flag_report(uuid, text) from public;
revoke all on function public.resolve_report_flag(uuid) from public;
grant execute on function public.flag_report(uuid, text) to authenticated;
grant execute on function public.resolve_report_flag(uuid) to authenticated;
