-- Schools that iCare no longer places students at.
--
-- A school closes, or the programme ends there, and it must stop appearing in
-- the school picker on the add-student form. Deleting it is not an option: the
-- students who studied there still point at it, and their history is the whole
-- record.
--
-- So a school is active or it is not. Active is the default, and every school
-- that exists today is active.

alter table public.schools
  add column if not exists is_active boolean not null default true;

comment on column public.schools.is_active is 'False for a school iCare no longer places students at. Inactive schools stay in the database and on existing student records; they are hidden from pickers that choose a school for a new placement.';

-- The pickers ask for active schools by name, and nothing else.
create index if not exists schools_is_active_idx on public.schools using btree (is_active) where is_active;
