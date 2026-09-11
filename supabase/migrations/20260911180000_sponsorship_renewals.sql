-- Renewing support each school year, and noticing when it cannot go on.
--
-- Brief: design/donor-sponsorship/DESIGN_BRIEF.md (tasks "Needs decision" and
-- "Renewal job"). Runs after 20260911170000. Every statement is safe to run
-- twice.
--
-- Three pieces, all in the database because each one writes more than one row
-- and must do all of it or none of it:
--
--   renew_sponsorship        one sponsorship into the next school year, if the
--                            donor's free balance covers it
--   the archive trigger      a student leaving puts their donors' support in
--                            front of an admin instead of carrying on silently
--   run_sponsorship_renewals the daily job: renew what can be renewed, hand the
--                            rest to a person, end what was never meant to renew
--
-- Renewals never send a welcome: the donor already knows the student.

-- ---------------------------------------------------------------------------
-- 1. One renewal
-- ---------------------------------------------------------------------------

-- The work itself, with no caller check. Not granted to anybody: only the two
-- functions below reach it. The admin wrapper checks who is asking; the daily
-- run is scheduled by pg_cron with no signed-in user at all, so a check in here
-- would refuse the job the first time it tried to renew anything.
create or replace function public.renew_sponsorship_core(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.scholarships%rowtype;
  v_ps public.programme_settings%rowtype;
  v_year integer;
  v_start date;
  v_end date;
  v_months integer;
  v_amount numeric(12, 2);
  v_free numeric(12, 2);
  v_new uuid;
begin
  select * into v_row from public.scholarships where id = p_id for update;
  if not found then
    raise exception 'Sponsorship not found.' using errcode = 'no_data_found';
  end if;
  if v_row.status = 'ended' then
    raise exception 'This support has already ended.' using errcode = 'check_violation';
  end if;
  if v_row.support_type = 'specific_item' then
    raise exception 'A one time item does not renew.' using errcode = 'check_violation';
  end if;

  select * into v_ps from public.programme_settings where id = 'global';

  -- The next school year to start after this support ends (or after today, for
  -- open ended support), so a gap like April to mid May is never paid for.
  v_year := extract(year from coalesce(v_row.coverage_end, (now() at time zone 'UTC')::date))::int;
  v_start := public.school_year_date(v_year, coalesce(v_ps.school_year_start, '05-16'), coalesce(v_ps.school_year_start, '05-16'));
  if v_start <= coalesce(v_row.coverage_end, (now() at time zone 'UTC')::date) then
    v_year := v_year + 1;
    v_start := public.school_year_date(v_year, coalesce(v_ps.school_year_start, '05-16'), coalesce(v_ps.school_year_start, '05-16'));
  end if;
  v_end := public.school_year_date(v_year, coalesce(v_ps.school_year_end, '03-31'), coalesce(v_ps.school_year_start, '05-16'));

  v_months := greatest(1, round((v_end - v_start + 1) / 30.4375))::integer;
  v_amount := coalesce(v_row.monthly_amount_thb, 0) * v_months;

  -- Only money that has arrived. The row being renewed already counts in full
  -- as committed, so the free balance is exactly what is left to spend.
  select free_balance_thb into v_free from public.donor_balance where donor_id = v_row.donor_id;
  if coalesce(v_free, 0) < v_amount then
    raise exception 'The donor''s free balance does not cover the next school year.' using errcode = 'check_violation';
  end if;

  insert into public.scholarships (
    student_id, donor_id, amount_thb, monthly_amount_thb, coverage_start, coverage_end, status,
    support_type, item_description, report_emails_enabled, auto_renew, renewed_from_id,
    welcome_skipped_at, created_by
  ) values (
    v_row.student_id, v_row.donor_id, v_amount, v_row.monthly_amount_thb, v_start, v_end, 'active',
    v_row.support_type, v_row.item_description, v_row.report_emails_enabled, v_row.auto_renew, v_row.id,
    now(), auth.uid()
  )
  returning id into v_new;

  -- The old row ends having been used in full: its months were paid out.
  update public.scholarships
  set status = 'ended',
      ended_at = now(),
      ended_reason = 'Renewed for the ' || v_year || ' school year',
      decision_reason = null,
      decision_since = null
  where id = v_row.id;

  insert into public.student_events (student_id, actor_id, kind, summary, detail)
  values (
    v_row.student_id, auth.uid(), 'scholarship_changed',
    'Support renewed to ' || to_char(v_end, 'FMDD Mon YYYY'),
    jsonb_build_object('from_scholarship_id', v_row.id, 'scholarship_id', v_new, 'amount_thb', v_amount)
  );

  return v_new;
end;
$$;

revoke all on function public.renew_sponsorship_core(uuid) from public, anon, authenticated;

-- What the admin screen calls.
create or replace function public.renew_sponsorship(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can renew a donor''s support.' using errcode = 'insufficient_privilege';
  end if;
  return public.renew_sponsorship_core(p_id);
end;
$$;

comment on function public.renew_sponsorship(uuid) is 'Renews a sponsorship into the next school year at the same monthly amount, if the donor''s free balance covers it. Ends the old row, never sends a welcome. Returns the new row''s id. Admins only.';

revoke all on function public.renew_sponsorship(uuid) from public;
grant execute on function public.renew_sponsorship(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. A student leaving
-- ---------------------------------------------------------------------------

-- Archiving (and, once the calendar work adds it, graduating) a student puts
-- every active support for them in front of an admin: emails stop because the
-- status is no longer active, and the money stays allocated until somebody
-- decides to return it or move it to another student.
create or replace function public.sponsorships_follow_student_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('archived', 'graduated') then
    update public.scholarships
    set status = 'needs_decision',
        decision_reason = case when new.status = 'graduated' then 'graduated' else 'student_archived' end,
        decision_since = now()
    where student_id = new.id
      and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists students_status_sponsorships on public.students;
create trigger students_status_sponsorships
  after update of status on public.students
  for each row execute function public.sponsorships_follow_student_status();

-- ---------------------------------------------------------------------------
-- 3. The daily run
-- ---------------------------------------------------------------------------

create or replace function public.run_sponsorship_renewals(p_on date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_on date := coalesce(p_on, (now() at time zone 'UTC')::date);
  v_row record;
  v_renewed integer := 0;
  v_short integer := 0;
  v_ended integer := 0;
begin
  -- An admin running it by hand, the service key, or pg_cron (no JWT at all).
  -- A signed-in non-admin has a role claim and is refused.
  if not (public.is_admin() or coalesce(auth.role(), '') in ('service_role', '')) then
    raise exception 'Not allowed.' using errcode = 'insufficient_privilege';
  end if;

  for v_row in
    select id, auto_renew, support_type
    from public.scholarships
    where status = 'active'
      and coverage_end is not null
      and coverage_end <= v_on
    order by coverage_end
  loop
    if v_row.support_type = 'specific_item' or not v_row.auto_renew then
      -- Never meant to renew: it simply ends, used in full.
      update public.scholarships
      set status = 'ended', ended_at = now(), ended_reason = 'Reached its end date'
      where id = v_row.id;
      v_ended := v_ended + 1;
    else
      begin
        perform public.renew_sponsorship_core(v_row.id);
        v_renewed := v_renewed + 1;
      exception when check_violation then
        -- Not enough money: a person decides, after talking to the donor.
        update public.scholarships
        set status = 'needs_decision', decision_reason = 'renewal_short', decision_since = now()
        where id = v_row.id;
        v_short := v_short + 1;
      end;
    end if;
  end loop;

  return jsonb_build_object('on', v_on, 'renewed', v_renewed, 'needs_decision', v_short, 'ended', v_ended);
end;
$$;

comment on function public.run_sponsorship_renewals(date) is 'Daily: renews due sponsorships the balance covers, moves the rest to needs_decision (renewal_short), ends those with auto_renew off. Returns counts.';

revoke all on function public.run_sponsorship_renewals(date) from public;
grant execute on function public.run_sponsorship_renewals(date) to authenticated;

-- Scheduled with pg_cron where the project has it: 17:15 UTC is 00:15 in
-- Bangkok, outside the 1 to 3 AM window. Without pg_cron nothing is scheduled
-- and an admin can run the function by hand; the Today rail still warns 30
-- days ahead either way.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'sponsorship-renewals';
    perform cron.schedule('sponsorship-renewals', '15 17 * * *', 'select public.run_sponsorship_renewals()');
  end if;
end $$;
