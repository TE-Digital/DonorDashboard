-- Copy old scholarship awards into scholarships and donor_contributions.
--
-- RUN BY HAND, AFTER REVIEWING THE PREVIEW. This file is deliberately outside
-- supabase/migrations so `db push` never runs it.
--
-- Before running:
--   1. Migrations up to 20260911110000 are applied.
--   2. The preview has been read:
--        select action, reason, count(*) from public.scholarship_award_copy_plan
--        group by 1, 2 order by 1, 2;
--      and every 'flag' row, and every donor with donor_already_has_payments,
--      has been checked by a person:
--        select * from public.scholarship_award_copy_plan
--        where action = 'flag' or (creates_payment and donor_already_has_payments);
--   3. It has been run on staging first.
--
-- Run as an admin or the service role (the plan view shows rows to admins only).
-- Everything happens in one transaction. If anything is left uncopied at the
-- end, the whole copy rolls back, so a partial copy cannot be committed.
-- Safe to run again: a copied award is 'already_copied' from then on.

begin;

-- Scholarships. Only 'create' rows. Ended rows get an end date no later than
-- today: a cancelled award whose period runs into the future ended when it was
-- cancelled, not on its planned last day.
insert into public.scholarships (
  student_id,
  donor_id,
  amount_thb,
  monthly_amount_thb,
  coverage_start,
  coverage_end,
  status,
  ended_at,
  ended_reason,
  grant_type_id,
  comment,
  created_at,
  source_award_id
)
select
  p.student_id,
  p.donor_id,
  p.amount_for_period,
  p.monthly_amount_thb,
  p.period_start,
  p.period_end,
  p.target_status,
  case
    when p.target_status = 'ended'
      then (least(p.period_end, (now() at time zone 'UTC')::date)::timestamp at time zone 'UTC')
  end,
  p.ended_reason,
  p.grant_type_id,
  'Copied from scholarship award ' || p.award_id,
  -- scholarship_awards.created_at has no time zone; it is read as UTC.
  coalesce(p.award_created_at at time zone 'UTC', now()),
  p.award_id
from public.scholarship_award_copy_plan p
where p.action = 'create'
on conflict (source_award_id) where source_award_id is not null do nothing;

-- Payments, for paid awards. Read from the plan captured before the insert
-- above: after it, the same awards read as 'already_copied'. So this uses the
-- awards table and the copied scholarships instead.
insert into public.donor_contributions (
  donor_id,
  amount_thb,
  received_on,
  note,
  created_at,
  source_award_id
)
select
  a.donor_id,
  a.amount_for_period,
  coalesce(a.payment_date, a.period_start),
  'Migrated from award' || coalesce(': ' || nullif(btrim(a.payment_note), ''), ''),
  coalesce(a.created_at at time zone 'UTC', now()),
  a.id
from public.scholarship_awards a
  join public.scholarships s on s.source_award_id = a.id
where (a.is_paid or a.payment_date is not null)
on conflict (source_award_id) where source_award_id is not null do nothing;

-- Refuse to commit a partial copy.
do $$
declare
  remaining int;
  copied int;
  paid_copied int;
  payments int;
begin
  select count(*) into remaining from public.scholarship_award_copy_plan where action = 'create';
  if remaining > 0 then
    raise exception '% award(s) still marked create after the copy. Nothing was committed.', remaining;
  end if;

  select count(*) into copied from public.scholarships where source_award_id is not null;
  select count(*) into paid_copied
    from public.scholarship_awards a
    join public.scholarships s on s.source_award_id = a.id
    where a.is_paid or a.payment_date is not null;
  select count(*) into payments from public.donor_contributions where source_award_id is not null;

  if payments <> paid_copied then
    raise exception 'Paid awards copied: %, payments created: %. Nothing was committed.', paid_copied, payments;
  end if;

  raise notice 'Copied % award(s) into scholarships, with % payment(s).', copied, payments;
end $$;

-- What was not copied, and why. Read this before closing the session.
select action, reason, count(*) as awards
from public.scholarship_award_copy_plan
where action <> 'already_copied'
group by action, reason
order by action, reason;

commit;
