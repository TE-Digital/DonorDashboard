-- How often a school reports on its students.
--
-- Reporting was a single global constant: every student, everywhere, was
-- expected to have a report every six months. Schools do not work that way. A
-- school on a three-term year reports three times; a border-police school on a
-- yearly rhythm reports once. Getting this wrong makes the students table lie
-- about who is late, which is the one thing that table is for.
--
-- So the period belongs to the school, and a student inherits the period of the
-- school they are assigned to. Six months stays the default, so every school
-- that exists today keeps exactly the behaviour it has now.

alter table public.schools
  add column if not exists reporting_period_months smallint not null default 6;

do $$
begin
  alter table public.schools
    add constraint schools_reporting_period_months_check
    check (reporting_period_months in (1, 3, 4, 6, 12));
exception
  when duplicate_object then null;
end
$$;

comment on column public.schools.reporting_period_months is 'Months between term reports for students at this school. A student inherits this from their school; it drives the due date and the Reports column in the students directory.';
