-- The welcome email a new donor receives about their student, as sent.
--
-- Brief: design/donor-sponsorship/DESIGN_BRIEF.md (task "Welcome email").
-- Runs after 20260911160000. Every statement is safe to run twice.
--
-- One row per attempt. What was sent is frozen here (address, language,
-- subject, the description as the admin edited it for this email) because the
-- donor's address and the student's card will both change, and the record of
-- what a person was told must not change with them. Editing the description in
-- a welcome never touches students.donor_description.

create table if not exists public.sponsorship_welcomes (
  id uuid primary key default extensions.uuid_generate_v4(),
  scholarship_id uuid not null,
  donor_id uuid not null,
  student_id uuid not null,
  template_id uuid,
  language text not null check (language in ('en', 'th')),
  email text,
  subject text,
  description_text text,
  admin_note text,
  sent_at timestamptz,
  send_error text,
  created_by uuid,
  created_at timestamptz not null default now()
);

comment on table public.sponsorship_welcomes is 'Each attempt to send a welcome email for a sponsorship. sent_at set means delivered to the provider; send_error set means it failed.';

create index if not exists idx_sponsorship_welcomes_scholarship
  on public.sponsorship_welcomes (scholarship_id, created_at desc);
create index if not exists idx_sponsorship_welcomes_student
  on public.sponsorship_welcomes (student_id);

alter table public.sponsorship_welcomes enable row level security;

do $$
begin
  create policy sponsorship_welcomes_admin_read on public.sponsorship_welcomes
    for select using (public.is_admin());
exception when duplicate_object then null;
end $$;

-- Written only by the send-welcome edge function with the service key; the
-- browser reads and never writes.
grant select on public.sponsorship_welcomes to authenticated;
