-- The plan for copying old scholarship awards into scholarships. READ-ONLY.
--
-- Brief: design/donor-records-and-payments/DESIGN_BRIEF.md (task 1.3).
--
-- This file creates a view and changes no data, so it is safe for `db push` to
-- run automatically. The view is the preview: one row per award, saying what
-- the copy would do with it and why. The write itself is
-- supabase/scripts/copy_scholarship_awards.sql, which is run by hand only after
-- this view has been reviewed, and which inserts from this view, so the preview
-- and the write cannot disagree.
--
-- Why the copy exists: the new donor overview reads `scholarships`, but existing
-- donors' history lives only in `scholarship_awards`, which nothing migrated.
-- Awards are copied, never moved: 15 screens still read scholarship_awards.
--
-- Rules, in the order they are checked (the first that applies wins):
--   already_copied   a scholarship already carries this award's id
--   skip             no donor, no student, or no positive amount. scholarships
--                    requires donor, student and amount_thb, and a payment's
--                    amount must be above zero, so these cannot be copied
--                    without guessing
--   flag             a currency other than THB (payments are THB-only); a
--                    cancelled award, because how much of it was actually used
--                    is unknown and donor_balance counts an ended row's whole
--                    amount_thb as used, so a person decides; or another award
--                    for the same donor and student overlaps this one while
--                    both are current (a likely duplicate)
--   skip             a current award already covered by an active scholarship
--                    for the same donor and student, made through the
--                    allocation panel. Copying it would count the commitment
--                    twice
--   create           everything else
--
-- An award that is active and covers today becomes an active scholarship.
-- Everything else becomes ended, with the reason. A paid award (is_paid, or a
-- payment_date) also creates a THB payment, so a migrated donor starts with a
-- truthful balance instead of a negative one.
--
-- Months are counted from days (period length / 30.4375, rounded), not with
-- age(). age() calls 1 Jan to 30 Jun five months, which would overstate the
-- monthly amount by a fifth. "Today" is the UTC date.

create or replace view public.scholarship_award_copy_plan
with (security_invoker = true)
as
with today as (
  select (now() at time zone 'UTC')::date as d
),
awards as (
  select
    a.*,
    lower(coalesce(nullif(btrim(a.currency), ''), 'thb')) in ('thb', 'bhat', 'baht') as is_thb,
    (a.status = 'active' and a.period_start <= t.d and a.period_end >= t.d) as is_current,
    (a.is_paid or a.payment_date is not null) as is_paid_award,
    greatest(1, round((a.period_end - a.period_start + 1) / 30.4375))::int as months
  from public.scholarship_awards a
  cross join today t
),
classified as (
  select
    a.*,
    case
      when exists (select 1 from public.scholarships s where s.source_award_id = a.id)
        then 'already_copied'
      when a.donor_id is null then 'skip'
      when a.student_id is null then 'skip'
      when a.amount_for_period is null or a.amount_for_period <= 0 then 'skip'
      when not a.is_thb then 'flag'
      when lower(coalesce(a.status, '')) = 'cancelled' then 'flag'
      when a.is_current and exists (
        select 1 from awards o
        where o.id <> a.id
          and o.donor_id = a.donor_id
          and o.student_id = a.student_id
          and o.is_current
          and o.period_start <= a.period_end
          and o.period_end >= a.period_start
      ) then 'flag'
      when a.is_current and exists (
        select 1 from public.scholarships s
        where s.source_award_id is null
          and s.donor_id = a.donor_id
          and s.student_id = a.student_id
          and s.status = 'active'
          and s.ended_at is null
          and s.coverage_start <= a.period_end
          and (s.coverage_end is null or s.coverage_end >= a.period_start)
      ) then 'skip'
      else 'create'
    end as action,
    case
      when exists (select 1 from public.scholarships s where s.source_award_id = a.id)
        then 'Already copied'
      when a.donor_id is null then 'No donor on the award'
      when a.student_id is null then 'No student on the award'
      when a.amount_for_period is null or a.amount_for_period <= 0 then 'No amount on the award'
      when not a.is_thb then 'Currency is ' || a.currency || ', not THB'
      when lower(coalesce(a.status, '')) = 'cancelled' then 'Cancelled award: a person decides how much of it was used'
      when a.is_current and exists (
        select 1 from awards o
        where o.id <> a.id
          and o.donor_id = a.donor_id
          and o.student_id = a.student_id
          and o.is_current
          and o.period_start <= a.period_end
          and o.period_end >= a.period_start
      ) then 'Overlaps another current award for the same donor and student'
      when a.is_current and exists (
        select 1 from public.scholarships s
        where s.source_award_id is null
          and s.donor_id = a.donor_id
          and s.student_id = a.student_id
          and s.status = 'active'
          and s.ended_at is null
          and s.coverage_start <= a.period_end
          and (s.coverage_end is null or s.coverage_end >= a.period_start)
      ) then 'Already covered by an active scholarship'
      else null
    end as reason
  from awards a
)
select
  c.id as award_id,
  c.donor_id,
  c.student_id,
  c.grant_type_id,
  c.period_start,
  c.period_end,
  c.status as award_status,
  c.amount_for_period,
  c.currency,
  c.is_paid,
  c.payment_date,
  c.action,
  c.reason,
  case when c.is_current then 'active' else 'ended' end as target_status,
  case
    when c.is_current then null
    when lower(coalesce(c.status, '')) = 'cancelled' then 'Cancelled award, copied from old records'
    when lower(coalesce(c.status, '')) = 'completed' then 'Completed award, copied from old records'
    else 'Award period ended ' || to_char(c.period_end, 'YYYY-MM-DD') || ', copied from old records'
  end as ended_reason,
  round(c.amount_for_period / c.months, 2) as monthly_amount_thb,
  c.months,
  c.is_paid_award and c.action = 'create' as creates_payment,
  coalesce(c.payment_date, c.period_start) as payment_received_on,
  -- Payments already recorded by hand might be the same money this award marks
  -- as paid. That cannot be detected, only shown, so the reviewer checks these
  -- donors before running the copy.
  exists (
    select 1 from public.donor_contributions dc
    where dc.donor_id = c.donor_id
      and dc.source_award_id is null
      and dc.voided_at is null
  ) as donor_already_has_payments,
  c.created_at as award_created_at
from classified c
where public.is_admin();

comment on view public.scholarship_award_copy_plan is 'Read-only preview of copying scholarship_awards into scholarships and donor_contributions. One row per award. supabase/scripts/copy_scholarship_awards.sql inserts from this view.';

grant select on public.scholarship_award_copy_plan to authenticated;
