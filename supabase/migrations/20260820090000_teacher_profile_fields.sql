-- Teacher profile fields.
--
-- The add-teacher form collects a Thai name, a LINE ID, the school the teacher
-- represents and free-text notes. `public.profiles` had nowhere to put any of
-- them, so they are added here rather than derived or dropped on save.
--
-- Every column is nullable: existing profiles (admins, donors, agents) keep
-- working untouched, and the frontend treats a missing column as "not migrated
-- yet" rather than an error.

alter table public.profiles
  add column if not exists full_name_th text,
  add column if not exists line_id      text,
  add column if not exists school_id    uuid,
  add column if not exists notes        text;

-- The school a teacher represents. On delete set null: removing a school must
-- not remove the person.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_school_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_school_id_fkey
      foreign key (school_id) references public.schools (id) on delete set null;
  end if;
end
$$;

create index if not exists profiles_school_id_idx on public.profiles using btree (school_id);

comment on column public.profiles.full_name_th is 'Full name in Thai. The legal-language name; full_name holds the English transliteration.';
comment on column public.profiles.line_id      is 'LINE ID — the primary day-to-day contact channel for teachers.';
comment on column public.profiles.school_id    is 'School this person represents. Set for teachers; null for other roles.';
comment on column public.profiles.notes        is 'Free-text admin notes about this person.';
