-- The donor card in Thai as well as English.
--
-- Brief: design/thai-calendar-and-field-alignment/DESIGN_BRIEF.md (bilingual
-- donor card). Runs after 20260911120000. Every statement is safe to run twice.
--
-- A report exists in both languages, and so do the student's and the school's
-- names. The card a donor sees about the student (display name, description)
-- existed in one, so a Thai-reading donor received a Thai report beside a card
-- they could not read. The existing columns become the English version and two
-- Thai columns join them. A card may be published with one language; sending it
-- to a reader of the other is blocked until somebody writes that version.

alter table public.students
  add column if not exists donor_display_name_th text,
  add column if not exists donor_description_th text;

comment on column public.students.donor_display_name is 'The name a donor sees, in English. Usually the nickname; never assumed to be the legal name.';
comment on column public.students.donor_description is 'The donor-facing description, in English. NOT the internal bio.';
comment on column public.students.donor_display_name_th is 'The name a donor sees, in Thai script.';
comment on column public.students.donor_description_th is 'The donor-facing description, in Thai. Written by a person, never machine-translated.';

-- Some cards were written in Thai into the only columns there were. Anything
-- containing Thai script (U+0E00 to U+0E7F) moves to the Thai column, and the
-- English column is emptied, so an English donor is never sent Thai labelled as
-- English. Rows already carrying a Thai value are left alone.
update public.students
set donor_display_name_th = donor_display_name,
    donor_display_name = null
where donor_display_name ~ '[฀-๿]'
  and donor_display_name_th is null;

update public.students
set donor_description_th = donor_description,
    donor_description = null
where donor_description ~ '[฀-๿]'
  and donor_description_th is null;
