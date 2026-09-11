-- Province and district, as facts rather than as guesses.
--
-- schools has held id, name, address and created_at. Everything geographic the
-- product shows -- the province column in the schools directory, the district
-- on a school record -- comes from schoolProfile.ts, which splits the free-text
-- address on commas and, failing that, derives a value from the row id. That
-- file says so out loud: "Everything below is a placeholder. Nothing here is
-- persisted, and no caller should treat these values as facts about the school."
--
-- The admin dashboard is about to rank provinces by funding gap. A ranking
-- drawn from placeholders is worse than no ranking, because somebody allocates
-- money against it. So the two fields the school form already collects, and has
-- until now flattened into the address string, get columns of their own.

alter table public.schools
  add column if not exists province text,
  add column if not exists district text;

comment on column public.schools.province is 'Entered on the school form. Null means nobody has recorded it -- shown as its own group, never folded into another province.';

-- Existing rows: the address was composed as "..., subdistrict, district,
-- province", so the tail of it is recoverable. Only rows that actually look
-- composed that way are touched; anything shorter is left null for a person to
-- fill, rather than guessed at.
update public.schools
set province = nullif(btrim(split_part(address, ',', array_length(string_to_array(address, ','), 1))), '')
where province is null
  and address is not null
  and array_length(string_to_array(address, ','), 1) >= 3;

update public.schools
set district = nullif(btrim(split_part(address, ',', array_length(string_to_array(address, ','), 1) - 1)), '')
where district is null
  and address is not null
  and array_length(string_to_array(address, ','), 1) >= 3;

create index if not exists schools_province_idx on public.schools (province);
