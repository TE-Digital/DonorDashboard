-- The student record grows up: a lifecycle, a reporting cycle, a note log, an
-- activity trail, and a donor-facing card that is separate from the record.
--
-- Four things this adds, and why each is a column rather than something derived:
--
-- 1. A student is archived, never deleted. Their reports, scholarships and
--    history are the programme's record of a child; a delete throws that away
--    to hide a row from a list.
-- 2. A report has a state. "Overdue" was the only thing the product could say,
--    which meant a report sitting in review looked identical to one nobody had
--    started.
-- 3. Notes and activity are separate tables. A note is somebody writing a
--    sentence on purpose; activity is everything that happened. Notes appear in
--    activity, not the other way round.
-- 4. What a donor sees is written once, reviewed, and consented to — and it is
--    not the internal record with fields hidden at render time. A card built by
--    filtering the student row is one refactor away from leaking an address.

/* ------------------------------------------------------------- 1. Lifecycle */

alter table public.students
  add column if not exists status      text not null default 'enrolled',
  add column if not exists archived_at timestamp with time zone,
  add column if not exists archived_by uuid references public.profiles (id) on delete set null,
  add column if not exists enrolled_on date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'students_status_check') then
    alter table public.students
      add constraint students_status_check check (status in ('enrolled', 'archived'));
  end if;
end
$$;

comment on column public.students.status is 'enrolled or archived. Archiving hides a student from working lists and keeps every record about them.';
comment on column public.students.enrolled_on is 'When this student joined the programme. Falls back to created_at where it was never recorded.';

create index if not exists students_status_idx on public.students using btree (status);


/* --------------------------------------------------- 2. The reporting cycle */
--
-- A report now has a state, and the cycle it belongs to has a due date. The
-- product had one word for everything that was not finished — "Overdue" — so a
-- report in review looked the same as one nobody had opened.
--
-- Existing rows become 'approved': they are historic, they were accepted, and
-- marking them open would light up every student in the directory on day one.

alter table public.term_updates
  add column if not exists status   text not null default 'submitted',
  add column if not exists due_date date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'term_updates_status_check') then
    alter table public.term_updates
      add constraint term_updates_status_check
      check (status in ('draft', 'submitted', 'under_review', 'changes_requested', 'approved'));
  end if;
end
$$;

update public.term_updates set status = 'approved' where status = 'submitted' and created_at < now();

comment on column public.term_updates.status is 'Where this report is in its cycle. approved is the end state — the report has been accepted and sent.';
comment on column public.term_updates.due_date is 'When this report was due. Null means the cycle is derived from the previous report instead.';

create index if not exists term_updates_open_idx
  on public.term_updates using btree (student_id, report_date desc)
  where status <> 'approved';

/* -------------------------------------------------------------- 3. The note */

create table if not exists public.student_notes (
  id         uuid primary key default extensions.uuid_generate_v4(),
  student_id uuid not null references public.students (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null check (length(btrim(body)) > 0),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  edited     boolean not null default false
);

comment on table public.student_notes is 'Running admin commentary about a student. Internal: never rendered on anything a donor sees.';

create index if not exists student_notes_student_idx
  on public.student_notes using btree (student_id, created_at desc);

alter table public.student_notes enable row level security;

drop policy if exists "admins manage student notes" on public.student_notes;
create policy "admins manage student notes"
  on public.student_notes
  using (public.is_admin())
  with check (public.is_admin());

-- A teacher reads and writes notes on the students they are responsible for.
drop policy if exists "teachers read own student notes" on public.student_notes;
create policy "teachers read own student notes"
  on public.student_notes
  for select
  using (
    exists (
      select 1 from public.students s
      where s.id = student_notes.student_id
        and s.responsible_teacher_id = auth.uid()
    )
  );

/* --------------------------------------------------------- 4. The trail */

create table if not exists public.student_events (
  id         uuid primary key default extensions.uuid_generate_v4(),
  student_id uuid not null references public.students (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  kind       text not null,
  -- One sentence, already written for a person to read. Composed where the
  -- action happens, because that is the only place that knows what happened.
  summary    text not null,
  -- Anything structured worth keeping: a recipient address, a field name.
  detail     jsonb,
  created_at timestamp with time zone not null default now()
);

comment on table public.student_events is 'The activity timeline for one student: what happened, who did it, when. Written by the app, never by a trigger — a trigger knows a column changed, not what a person did.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'student_events_kind_check') then
    alter table public.student_events
      add constraint student_events_kind_check check (kind in (
        'student_created', 'student_updated', 'photo_updated',
        'note_added', 'note_edited', 'note_deleted',
        'report_added', 'report_updated', 'report_deleted',
        'scholarship_changed', 'teacher_assigned',
        'donor_card_sent', 'donor_card_downloaded', 'donor_profile_updated', 'consent_updated',
        'archived', 'restored'
      ));
  end if;
end
$$;

create index if not exists student_events_student_idx
  on public.student_events using btree (student_id, created_at desc);

alter table public.student_events enable row level security;

drop policy if exists "admins manage student events" on public.student_events;
create policy "admins manage student events"
  on public.student_events
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "teachers read own student events" on public.student_events;
create policy "teachers read own student events"
  on public.student_events
  for select
  using (
    exists (
      select 1 from public.students s
      where s.id = student_events.student_id
        and s.responsible_teacher_id = auth.uid()
    )
  );

/* ------------------------------------------------------ 5. The donor card */
--
-- Written separately from the record on purpose. A card assembled by hiding
-- fields from the student row is one careless render away from putting a
-- child's address in front of a stranger; a card with its own three columns
-- cannot leak a field it does not have.
--
-- Consent is a separate axis from readiness. A published card with no consent
-- is not sendable, and neither is a consented card that nobody has written.

alter table public.students
  add column if not exists donor_display_name   text,
  add column if not exists donor_description    text,
  add column if not exists donor_photo_path     text,
  add column if not exists donor_profile_status text not null default 'draft',
  add column if not exists consent_status       text not null default 'pending',
  add column if not exists consent_recorded_at  timestamp with time zone,
  add column if not exists donor_card_sent_at   timestamp with time zone;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'students_donor_profile_status_check') then
    alter table public.students
      add constraint students_donor_profile_status_check
      check (donor_profile_status in ('draft', 'awaiting_review', 'published'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'students_consent_status_check') then
    alter table public.students
      add constraint students_consent_status_check
      check (consent_status in ('pending', 'approved', 'declined'));
  end if;
end
$$;

comment on column public.students.donor_display_name is 'The name a donor sees. Usually the nickname; never assumed to be the legal name.';
comment on column public.students.donor_description  is 'The donor-facing description. NOT the internal bio, which may name a guardian or a hardship.';
comment on column public.students.donor_photo_path   is 'The one photo cleared for donors. Separate from profile_photo_path, which is the internal record photo.';
comment on column public.students.consent_status     is 'Whether the family has agreed to this child appearing in donor material. Nothing is sent unless this is approved.';
