-- Ending a sponsorship, in one transaction.
--
-- Brief: design/donor-sponsorship/DESIGN_BRIEF.md (task "Sponsorship row
-- actions"). Runs after 20260911140000. Safe to run twice.
--
-- Ending writes two tables: the scholarship row and a scholarship_releases row
-- for the money that goes back to the donor. Written from the browser as two
-- calls, a dropped connection between them leaves an ended sponsorship with no
-- record of the money returned, or a release with the sponsorship still active.
-- So it is one function, and either both happen or neither does.
--
-- What "used" means: an ended row's amount_thb is trimmed to the money that
-- actually covered months, and only the rest is released. The donor balance
-- then counts an ended row at what it really cost, rather than handing back
-- months that were already paid out.

create or replace function public.end_sponsorship(p_id uuid, p_reason text, p_on date default null)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.scholarships%rowtype;
  v_on date := coalesce(p_on, (now() at time zone 'UTC')::date);
  v_months integer;
  v_used numeric(12, 2);
  v_release numeric(12, 2);
begin
  if not public.is_admin() then
    raise exception 'Only an admin can end a donor''s support.' using errcode = 'insufficient_privilege';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required.' using errcode = 'check_violation';
  end if;

  select * into v_row from public.scholarships where id = p_id for update;
  if not found then
    raise exception 'Sponsorship not found.' using errcode = 'no_data_found';
  end if;

  -- Already ended: nothing to release twice.
  if v_row.status = 'ended' then
    return 0;
  end if;

  if v_row.support_type = 'specific_item' then
    -- A one off item is bought when it is paid; ending changes nothing.
    v_used := v_row.amount_thb;
  elsif v_on < v_row.coverage_start then
    v_used := 0;
  elsif v_row.coverage_end is not null and v_on >= v_row.coverage_end then
    v_used := v_row.amount_thb;
  else
    -- Months counted from days, the rule the rest of the product uses.
    v_months := greatest(1, round((v_on - v_row.coverage_start + 1) / 30.4375))::integer;
    v_used := least(v_row.amount_thb, coalesce(v_row.monthly_amount_thb, 0) * v_months);
  end if;

  v_release := greatest(v_row.amount_thb - v_used, 0);

  update public.scholarships
  set status = 'ended',
      ended_at = now(),
      ended_reason = btrim(p_reason),
      amount_thb = v_used,
      coverage_end = least(coalesce(v_row.coverage_end, v_on), v_on),
      decision_reason = null,
      decision_since = null
  where id = p_id;

  if v_release > 0 then
    insert into public.scholarship_releases (scholarship_id, donor_id, student_id, released_thb, reason, released_on, created_by)
    values (p_id, v_row.donor_id, v_row.student_id, v_release, btrim(p_reason), v_on, auth.uid());
  end if;

  return v_release;
end;
$$;

comment on function public.end_sponsorship(uuid, text, date) is 'Ends a sponsorship: trims amount_thb to what was used, releases the rest to the donor''s free balance with a ledger row, clears any pending decision. Returns the amount released.';

revoke all on function public.end_sponsorship(uuid, text, date) from public;
grant execute on function public.end_sponsorship(uuid, text, date) to authenticated;
