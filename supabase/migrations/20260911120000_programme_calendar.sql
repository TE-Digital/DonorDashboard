-- The Thai school calendar, written down once.
--
-- Brief: design/thai-calendar-and-field-alignment/DESIGN_BRIEF.md (task 1).
-- Runs after 20260911110000. Every statement is safe to run twice.
--
-- Until now the platform had no idea what a school year was. Report cycles
-- were the calendar year cut in half, so a "mid-year" report was due six weeks
-- into a Thai semester and a "year-end" one landed in the middle of the next.
-- The school year is a fact about the programme, so it lives in one row that an
-- admin edits on the Settings page, and every screen asks this migration's view
-- rather than doing the arithmetic itself.
--
-- Dates are stored as month-day text ('05-16'), not as dates: a school year is
-- a rule that repeats, and a stored 2026 date would be wrong in 2027. Years are
-- Western (CE) everywhere; Buddhist Era display is deliberately out of scope.

-- ---------------------------------------------------------------------------
-- 0. The shared updated_at trigger function
-- ---------------------------------------------------------------------------

-- The project's rules say to reuse public.update_updated_at(), but no migration
-- in this repo creates it and the live schema dump does not have it (only
-- Supabase's own storage.update_updated_at_column). It is defined once, here,
-- and every later migration reuses it rather than writing its own.
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.update_updated_at() is 'Sets updated_at to now() on every update. Shared by every table that has the column; do not create per-table copies.';

-- ---------------------------------------------------------------------------
-- 1. The one row
-- ---------------------------------------------------------------------------

-- A single-row table keyed 'global', the same shape branding_settings already
-- uses, so there is exactly one programme calendar and no question of which.
create table if not exists public.programme_settings (
  id text primary key default 'global' check (id = 'global'),
  school_year_start text not null default '05-16',
  school_year_end text not null default '03-31',
  semester1_start text not null default '05-16',
  semester1_end text not null default '10-10',
  semester2_start text not null default '11-01',
  semester2_end text not null default '03-31',
  report_due_after_days integer not null default 21 check (report_due_after_days between 0 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

comment on table public.programme_settings is 'The programme calendar: the Thai school year and its two semesters as month-day rules, and how long after a semester ends its report is due. One row, id = global.';

-- Month-day, zero padded. February 29 is refused: a rule that exists one year
-- in four would silently move itself the other three.
do $$
begin
  alter table public.programme_settings
    add constraint programme_settings_month_day_check check (
      school_year_start ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      and school_year_end ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      and semester1_start ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      and semester1_end ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      and semester2_start ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      and semester2_end ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      and '02-29' not in (school_year_start, school_year_end, semester1_start, semester1_end, semester2_start, semester2_end)
    );
exception when duplicate_object then null;
end $$;

insert into public.programme_settings (id) values ('global')
on conflict (id) do nothing;

drop trigger if exists programme_settings_updated_at on public.programme_settings;
create trigger programme_settings_updated_at
  before update on public.programme_settings
  for each row execute function public.update_updated_at();

alter table public.programme_settings enable row level security;

do $$
begin
  create policy programme_settings_admin_all on public.programme_settings
    for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null;
end $$;

-- Teachers need the calendar to know when their report is due. It holds no
-- personal data, so every signed-in account may read it.
do $$
begin
  create policy programme_settings_read on public.programme_settings
    for select using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

grant select on public.programme_settings to authenticated;
grant update on public.programme_settings to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Month-day rule to a real date
-- ---------------------------------------------------------------------------

-- The date a month-day rule falls on inside the school year that starts in
-- p_year. A rule earlier in the calendar than the school year's own start
-- belongs to the following January–May, so 03-31 in the 2026 school year is
-- 31 March 2027.
create or replace function public.school_year_date(p_year integer, p_md text, p_anchor_md text)
returns date
language sql
immutable
as $$
  select make_date(
    case when p_md >= p_anchor_md then p_year else p_year + 1 end,
    split_part(p_md, '-', 1)::int,
    split_part(p_md, '-', 2)::int
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Every school year a screen could ask about
-- ---------------------------------------------------------------------------

-- One row per school per school year, three years back and one forward, plus a
-- row with no school for students who have not been placed. The per-school
-- override columns arrive with the next calendar task; until then every school
-- reads the programme row, and this view is re-created then with a coalesce.
create or replace view public.school_years
with (security_invoker = true)
as
with ps as (
  select * from public.programme_settings where id = 'global'
),
years as (
  select generate_series(
    extract(year from (now() at time zone 'UTC'))::int - 3,
    extract(year from (now() at time zone 'UTC'))::int + 1
  ) as y
),
places as (
  select id as school_id from public.schools
  union all
  select null::uuid
)
select
  p.school_id,
  y.y as school_year_start,
  y.y::text || '–' || lpad(((y.y + 1) % 100)::text, 2, '0') as label,
  public.school_year_date(y.y, ps.school_year_start, ps.school_year_start) as starts_on,
  public.school_year_date(y.y, ps.school_year_end, ps.school_year_start) as ends_on,
  public.school_year_date(y.y, ps.semester1_start, ps.school_year_start) as semester1_starts_on,
  public.school_year_date(y.y, ps.semester1_end, ps.school_year_start) as semester1_ends_on,
  public.school_year_date(y.y, ps.semester1_end, ps.school_year_start) + ps.report_due_after_days as semester1_report_due_on,
  public.school_year_date(y.y, ps.semester2_start, ps.school_year_start) as semester2_starts_on,
  public.school_year_date(y.y, ps.semester2_end, ps.school_year_start) as semester2_ends_on,
  public.school_year_date(y.y, ps.semester2_end, ps.school_year_start) + ps.report_due_after_days as semester2_report_due_on
from ps
  cross join years y
  cross join places p;

comment on view public.school_years is 'Each school year, with both semesters and their report due dates, per school. school_year_start is the Western year the school year begins in; label reads 2026–27.';

grant select on public.school_years to authenticated;
