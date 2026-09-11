-- The words around a donor email, written by the organisation, in two languages.
--
-- Brief: design/donor-sponsorship/DESIGN_BRIEF.md (task "Email template
-- library"). Runs after 20260911150000. Every statement is safe to run twice.
--
-- A template owns only the framing: the subject, the opening paragraph and the
-- closing. The part that is about the student (the report, or the welcome's
-- photo and description) is always inserted by the system between the two, so
-- a template can change how we say hello and goodbye but can never drop or
-- rewrite what a teacher wrote or what a family agreed to share.

create table if not exists public.email_templates (
  id uuid primary key default extensions.uuid_generate_v4(),
  kind text not null check (kind in ('welcome', 'report')),
  name text not null check (length(btrim(name)) > 0),
  description text,
  subject_en text,
  subject_th text,
  intro_en text,
  intro_th text,
  closing_en text,
  closing_th text,
  is_default boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

comment on table public.email_templates is 'Subject, opening and closing for donor emails, in English and Thai. kind welcome frames the welcome email; kind report frames a report. The student part is inserted by the system, never by the template.';
comment on column public.email_templates.is_default is 'The template preselected when sending. Exactly one live default per kind.';

-- One live default per kind. A partial unique index rather than a trigger, so
-- two admins setting a default at once cannot both win.
create unique index if not exists idx_email_templates_default_unique
  on public.email_templates (kind) where is_default and deleted_at is null;

create index if not exists idx_email_templates_active
  on public.email_templates (kind, name) where deleted_at is null;
create index if not exists idx_email_templates_deleted
  on public.email_templates (deleted_at) where deleted_at is not null;

drop trigger if exists email_templates_updated_at on public.email_templates;
create trigger email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.update_updated_at();

alter table public.email_templates enable row level security;

do $$
begin
  create policy email_templates_admin_all on public.email_templates
    for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null;
end $$;

grant select, insert, update on public.email_templates to authenticated;

-- ---------------------------------------------------------------------------
-- Defaults. Written to docs/VOICE.md: warm, plain, no dashes, no exclamation
-- marks, signed from the team. Placeholders in braces are filled at send time.
-- ---------------------------------------------------------------------------

insert into public.email_templates (kind, name, description, subject_en, subject_th, intro_en, intro_th, closing_en, closing_th, is_default)
select
  'welcome',
  'Welcome a new donor',
  'Sent once, when a donor starts funding a student.',
  'Meet {student_name}',
  'แนะนำให้รู้จัก{student_name}',
  E'Dear {donor_name},\n\nThank you for supporting {student_name}. Before their first report arrives, here is a little about them.',
  E'เรียน คุณ{donor_name}\n\nขอบคุณที่สนับสนุน{student_name}นะคะ ก่อนรายงานฉบับแรกจะมาถึง เราอยากแนะนำให้รู้จักกันสักเล็กน้อยค่ะ',
  E'You''ll hear how {student_name} is doing at the end of each semester, in a report from their teacher.\n\nWith thanks,\nthe team at {organisation}',
  E'คุณจะได้รับรายงานความคืบหน้าของ{student_name}จากคุณครูทุกสิ้นภาคเรียนค่ะ\n\nด้วยความขอบคุณ\nทีมงาน {organisation}',
  true
where not exists (select 1 from public.email_templates where kind = 'welcome' and deleted_at is null);

insert into public.email_templates (kind, name, description, subject_en, subject_th, intro_en, intro_th, closing_en, closing_th, is_default)
select
  'report',
  'Semester report',
  'The usual letter around a teacher''s report.',
  '{student_name}''s term report',
  'รายงานประจำภาคเรียนของ{student_name}',
  E'Dear {donor_name},\n\nHere is how {student_name} got on this {report_period}, in their teacher''s own words.',
  E'เรียน คุณ{donor_name}\n\nนี่คือความคืบหน้าของ{student_name}ใน{report_period} เขียนโดยคุณครูผู้ดูแลค่ะ',
  E'With thanks from all of us,\nthe team at {organisation}',
  E'ด้วยความขอบคุณจากพวกเราทุกคน\nทีมงาน {organisation}',
  true
where not exists (select 1 from public.email_templates where kind = 'report' and deleted_at is null);
