-- Report deliveries: one row per report and recipient (task 1.15).
--
-- A report email used to leave one trace: term_updates.sent_to, a list of who
-- received it. Whoever did NOT receive it (no address, the email service
-- refused, or the admin closed the send dialog) was a sentence in send_error at
-- best, and nothing at all when the dialog was just closed. Nobody could see
-- who was still waiting, so nobody followed up.
--
-- This table makes each recipient a row with a state:
--   waiting  not sent yet. Written when the send dialog builds its preview, so
--            a report approved and then left unsent is still on the list.
--   sent     the email service accepted it.
--   failed   the email service refused it; `error` says why.
--
-- report-email writes every row with the service role. term_updates.sent_at
-- and sent_to are still written on each send, so every screen that reads them
-- keeps working; this table is the source for who is waiting.
--
-- Rules: no foreign keys (report_id, donor_id and template_id are plain uuids,
-- checked by the application), TEXT, uuid_generate_v4(), soft delete.

-- The project's shared trigger function. 20260911120000 defines the same body;
-- it is repeated here because this file runs first. Same body, so either one
-- running first leaves the same function.
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.report_deliveries (
  id uuid primary key default extensions.uuid_generate_v4(),
  report_id uuid not null,
  -- Null for an address added at send, which belongs to no donor.
  donor_id uuid,
  -- A snapshot at the time, like sent_to, so the list still reads if the donor
  -- is renamed.
  name text,
  email text,
  language text not null default 'en',
  -- email_templates.id (kind 'report'), chosen per recipient at send. Set by the
  -- sponsorship work (20260911160000); null until then.
  template_id uuid,
  status text not null default 'waiting',
  -- Why a recipient is waiting or left out. Filterable, so it is a fixed list.
  reason text,
  -- The email service's refusal, for a failed row.
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  constraint report_deliveries_language_check check (language in ('en', 'th')),
  constraint report_deliveries_status_check check (status in ('waiting', 'sent', 'failed')),
  constraint report_deliveries_reason_check check (
    reason is null
    or reason in ('needs_decision', 'support_ended', 'report_emails_off', 'donor_emails_off', 'no_email')
  )
);

comment on table public.report_deliveries is 'One row per report and recipient: waiting, sent or failed. Written by the report-email function. The Waiting to send list on Reports beta reads it.';
comment on column public.report_deliveries.donor_id is 'donors.id, or null for an address typed in at send.';
comment on column public.report_deliveries.template_id is 'email_templates.id (kind report) used for this recipient. No foreign key, by project rule.';
comment on column public.report_deliveries.reason is 'Why this recipient is waiting or excluded: needs_decision, support_ended, report_emails_off, donor_emails_off, no_email.';

create index if not exists idx_report_deliveries_report_id
  on public.report_deliveries (report_id)
  where deleted_at is null;

-- What the Waiting to send list and the sidebar count read.
create index if not exists idx_report_deliveries_open
  on public.report_deliveries (report_id)
  where deleted_at is null and status in ('waiting', 'failed');

create index if not exists idx_report_deliveries_deleted
  on public.report_deliveries (deleted_at)
  where deleted_at is not null;

-- One live row per donor per report, and per added address per report.
create unique index if not exists idx_report_deliveries_donor_unique
  on public.report_deliveries (report_id, donor_id)
  where donor_id is not null and deleted_at is null;

create unique index if not exists idx_report_deliveries_email_unique
  on public.report_deliveries (report_id, lower(email))
  where donor_id is null and deleted_at is null;

drop trigger if exists report_deliveries_updated_at on public.report_deliveries;
create trigger report_deliveries_updated_at
  before update on public.report_deliveries
  for each row execute function public.update_updated_at();

-- Admins read. Nobody writes from the browser: report-email uses the service
-- role, which RLS does not apply to.
alter table public.report_deliveries enable row level security;

do $$
begin
  create policy report_deliveries_admin_read on public.report_deliveries
    for select using (public.is_admin());
exception when duplicate_object then null;
end
$$;

grant select on public.report_deliveries to authenticated;

-- Everyone who already received a report, as sent rows, so a resend doesn't
-- list them as waiting. Rows whose donor_id isn't a uuid are skipped rather
-- than failing the migration.
insert into public.report_deliveries (report_id, donor_id, name, email, language, status, sent_at)
select
  t.id,
  case
    when r ->> 'donor_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (r ->> 'donor_id')::uuid
  end,
  r ->> 'name',
  lower(nullif(r ->> 'email', '')),
  case when r ->> 'language' = 'th' then 'th' else 'en' end,
  'sent',
  t.sent_at
from public.term_updates t
  cross join lateral jsonb_array_elements(t.sent_to) as r
where jsonb_typeof(t.sent_to) = 'array'
  and (r ->> 'donor_id' is not null or nullif(r ->> 'email', '') is not null)
on conflict do nothing;
