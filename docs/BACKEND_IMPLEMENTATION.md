# Backend implementation: what is outstanding

Snapshot: 2026-08-29. Sources: `full_schema.sql` (the live schema as dumped), the eight files in `supabase/migrations/`, the five functions in `supabase/functions/`, and every `supabase.from(...)`, `.rpc(...)` and `functions/v1/...` call in `src/`.

Nothing here was executed against a database. There is no `psql`, no Supabase CLI and no running Docker daemon on this machine, so every statement below is read from the schema dump and the migration files. Anything marked **verify** needs a query run against the real database before it is trusted.

---

## 1. The summary

The frontend is ahead of the database. Six migrations are written and, on the evidence of the code's own fallback paths, not all applied — every form and directory carries a "the column does not exist yet" branch, which is careful but is not a substitute for applying them.

That is the ordinary work. The urgent work is different: **the live schema has five public tables with row-level security switched off and `GRANT ALL` to `anon`, and one of them is the table that decides who is an admin.** That is a privilege-escalation hole reachable with the public anon key. It is not caused by anything in the recent frontend work; it predates it, and it is item 1 for a reason.

---

## 2. P0 — security holes in the live schema

### 2.1 Anyone can make themselves an admin

`public.person_roles` is the authorisation table. In `full_schema.sql`:

- it does **not** appear in any `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statement, and
- it carries `GRANT ALL ON TABLE public.person_roles TO anon` and `TO authenticated`.

RLS off plus a grant to `anon` means the table is readable and writable through the public API key. A single insert of `{user_id: <self>, role: 'admin'}` is a full takeover, and `is_admin()` — which every careful policy in the schema depends on — reads this table.

Four more tables are in the same state: `scholarship_awards` (every award and payment figure), `contact_requests`, `donor_leads` and `branding_settings`.

**Work:** enable RLS on all five; admin-only write policies; read policies matched to each table's audience (`contact_requests` and `donor_leads` need an insert path for the public forms, and only that). Revoke the `anon` grants that are not needed by an unauthenticated form.

**Verify first**, because enabling RLS on a table with no policy locks everyone out including the app:

```sql
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relrowsecurity, relname;
```

### 2.2 `all_read USING (true)` on three tables

The schema carries these:

| Policy | Table | Effect |
| --- | --- | --- |
| `all_read` | `term_updates` | Every signed-in account reads every report — drafts, unapproved work, and `internal_note` |
| `all_read` | `students` | Every signed-in account reads every student record |
| `all_read` | `donors` | Every signed-in account reads every donor |
| `donors_temp_read` | `donors` | Same again, under a name that says it was meant to be temporary |

Policies are OR'd, so each of these makes the careful policies beside it decorative: `students_teacher_read`, `students_donor_read`, `students_agent_read`, `tu_read_scope` and `donors_self_read` all currently decide nothing.

`20260830090000_donor_funding.sql` drops `all_read` on `term_updates` and replaces it with a working donor rule. **The other three are not addressed by any migration and need one.**

**Work:** drop `all_read` on `students` and `donors` and `donors_temp_read` on `donors`, then confirm the remaining per-role policies actually cover each screen. Expect breakage to surface here — these policies have never been load-bearing, so nobody knows whether they are correct.

### 2.3 A function that raises instead of returning false

`public.donor_is_mapped_to(uid, student)` joins `public.donor_students`. That table does not exist: it appears exactly once in the entire 8,004-line schema dump, inside this function's own body.

The function is called by `tu_read_scope` and `students_donor_read`. A function querying a missing table raises, and because policies are evaluated rather than short-circuited, that error can fail the whole query — which means `all_read` above has been the only thing keeping those tables readable at all.

Already handled: `20260830090000_donor_funding.sql` now rewrites the function in place, keeping its name and signature, to mean "this donor actively funds this student". The policy is left alone deliberately, because its other two arms — `teacher_is_responsible_for` and `agent_is_mapped_to`, the latter over `agent_students`, which does exist — are the only read path a teacher and an agent have.

**Work:** none, but re-read that block before applying, and **verify** afterwards that a teacher, an agent and a donor can each still read what they should.

### 2.4 Views bypass RLS unless told not to

A Postgres view runs as its owner unless created `with (security_invoker = true)`, and `create or replace view` does **not** inherit the setting from the version it replaces.

Both money migrations were affected and both are now fixed: `donor_balance`, `student_coverage` and `student_donors` in `20260830090000`, and `donor_balance` again — it is re-created — plus `report_email_payload` in `20260831090000`. That last one carries every funding donor's name and email address and is granted to `authenticated`.

**Work:** none outstanding, but this is a standing trap. Any future `create or replace view` on these must repeat the clause.

---

## 3. P1 — migrations to apply

Twelve files, in this order, then the sponsorship migrations from `20260911120000` onwards (documented with that work). `school_location` was renamed from `20260831090000` to `20260831100000` (2026-09-11) so no two files share a version. It touches only `schools` and every statement in it is safe to re-run, so an environment that already applied it under the old name is unaffected.

| # | Migration | Adds | Frontend already depends on it |
| --- | --- | --- | --- |
| 1 | `20260820090000_teacher_profile_fields` | `profiles.full_name_th`, `line_id`, `school_id`, `notes` | Teacher form, teacher directory's Thai-name and LINE columns |
| 2 | `20260820100000_user_access` | `admin_user_access_state()`, `user_access_events`, invite counters | Access badges and the whole invite flow on both directories |
| 3 | `20260828090000_school_active` | `schools.is_active` | Closed-school handling in the school picker |
| 4 | `20260828120000_student_record_lifecycle` | `students.status`/`archived_at`/`enrolled_on`, `term_updates.status`/`due_date`, donor-profile and consent columns, `student_events`, `student_notes` | Archive/restore, the report cycle, the donor profile tab, the activity timeline |
| 5 | `20260829090000_school_reporting_period` | `schools.reporting_period_months` | Per-school report cycles on the students and teachers directories |
| 6 | `20260830090000_donor_funding` | `donor_contributions`, `report_comments`, the money views, the report gate, `flag_report()`/`resolve_report_flag()` | Donor money screens, report flags and comments |
| 7 | `20260831090000_bilingual_and_email` | `name_th` on students and schools, bilingual report fields, send/delivery columns, `report_email_payload` | Thai names, bilingual reports, email delivery state |
| 8 | `20260831100000_school_location` | `schools.province`, `district` | The school form's address fields |
| 9 | `20260911090000_report_recipients_email_pref` | `report_email_payload` re-created to leave out donors with `wants_email_updates` off | Report emails respect the donor's own setting |
| 10 | `20260911100000_donor_records` | `donors.donor_type`/`contact_person`/`country`, Thai phones normalised to E.164, scholarship status `active · needs_decision · ended`, `source_award_id` on scholarships and payments, `donor_balance` with `last_received_on` | Donor side panel, donor overview, donors list columns and filters |
| 11 | `20260911110000_scholarship_award_copy_plan` | Read-only `scholarship_award_copy_plan` view (admin only) | Nothing directly: it is the preview for `supabase/scripts/copy_scholarship_awards.sql`, run by hand after it (see `supabase/scripts/README.md`) |
| 12 | `20260911115000_report_deliveries` | `report_deliveries` (one row per report and recipient: waiting, sent, failed), `update_updated_at()` | Reports beta's Waiting to send filter and column, the send dialog, the sidebar count |

Migrations 6 to 12 were written during this project and have never been run. Nothing in this repo has been executed against a database. Before the award copy script runs in production, task 1.13 (removing the old donor pages) must wait.

**Work:** apply in order on a copy first; confirm each screen's fallback branch stops firing; then production.

### What "not applied" looks like in the product

Every affected module degrades rather than failing, which is good engineering and bad visibility. `isMissingColumnError` in `teacherProfile.ts` is checked by the teacher form, the school form, the student pages and both directories, and each one drops fields and shows a note naming the migration. So the honest way to read the current app is: **the database is the limiting factor, not the UI.**

---

## 4. P1 — objects the frontend calls that no migration creates

Every table the app touches, against what the repo can create:

| Object | Where it comes from | Status |
| --- | --- | --- |
| `students`, `schools`, `profiles`, `term_updates`, `donors`, `scholarships`, `scholarship_awards`, `grant_types`, `person_roles`, `agents`, `contact_requests`, `branding_settings` | Live schema only | **No migration creates these.** They exist because somebody made them in the dashboard |
| `student_events`, `student_notes` | Migration 4 | Written, pending |
| `donor_contributions`, `report_comments`, money views | Migration 6 | Written, pending |
| `report_email_payload` | Migration 7 | Written, pending |
| `branding` | Called from `src/` | **Verify** — the schema has `branding_settings`; a `branding` read looks like a stale name |
| `agents` | Called from `src/` | Exists, RLS on |

**Work:** the first row is the real gap. The schema is not reproducible from this repo — a new environment cannot be built from `supabase/migrations/`. `full_schema.sql` is a dump, not a migration chain. Either check in a baseline migration generated from the live database, or accept that the repo can only ever patch an environment somebody else created by hand. The first is a day of work and removes a permanent class of "it works on prod" problems.

---

## 5. P2 — edge functions

Five exist: `admin-create-user`, `admin-user-access`, `donor-renew-request`, `invite-donor`, `send-donor-card`. All five are called from the frontend (`admin-create-user`, `admin-user-access` and `send-donor-card` by URL; `invite-donor` and `donor-renew-request` through `functions.invoke`).

**Missing:** the report email sender. Migration 7 adds `term_updates.sent_at`, `sent_to` and `send_error`, and builds `report_email_payload` explicitly for "the edge function [that] runs with the service key". That function does not exist yet.

**Work:**
- Write it. It reads `report_email_payload` for one report, sends per donor in the language each asked for, and writes `sent_at` / `sent_to` / `send_error` back. `sent_to` is specified as a snapshot array of `{donor_id, name, email, language}` as at send time, so a donor changing their address next year does not rewrite history.
- Decide what triggers it: approval, or an explicit "send" action. The migration's own comment says "the email IS the delivery", which argues for an explicit action with a visible failure state, not a side effect of approval.
- No email provider is configured anywhere in the repo — **verify** what `send-donor-card` uses and reuse it.

---

## 6. P2 — storage

Two buckets are referenced from the code: `progress-photos` (`reportAttachments.ts`) and `student-profiles` (`studentProfile.ts`). Neither appears in `full_schema.sql`'s storage section, and no migration creates them.

**Work:** create both, and write their policies. These hold photographs of children, so the questions are not routine: public or signed URLs, who may upload, who may read, and how a photo follows a student who is archived. The code currently calls `getPublicUrl`, which means today's answer is "anyone with the link, forever". That should be a decision somebody makes on purpose.

---

## 7. P2 — data integrity the schema does not enforce

The forms now validate these; the database does not. A second client, an import script or a direct dashboard edit bypasses all of it.

| Rule | Enforced in | Suggested |
| --- | --- | --- |
| Email format | `fieldValidation.ts` | `check` constraint on `profiles.email`, donor and school contact emails |
| Thai phone format | `fieldValidation.ts` | `check` constraint, or a normalising trigger |
| Birthdate not in the future, not before 1990 | `studentProfile.ts` | `check (birthdate <= current_date and birthdate >= '1990-01-01')` |
| `grade_to >= grade_from` | `SchoolForm.tsx` | `check` against the ordered grade list |
| A school contact has at least one channel | `SchoolForm.tsx` | `check (contact_phone is not null or contact_email is not null or contact_line is not null)` |
| Monthly support is a sane number | `studentProfile.ts` | `check (monthly_support_expected between 0 and 100000)` |

Constraints reject rows that already exist. Each needs a "what is already broken" query before it is added — the phone one especially, since the review found values like `06454984` in the data.

**Also:** `updated_at` columns exist on `donor_contributions` and `report_comments` with no trigger to maintain them. Either add a trigger or drop the columns; a timestamp that only sometimes updates is worse than none.

---

## 8. Order of work

1. **Today.** `person_roles` RLS. Nothing else matters while any visitor can grant themselves admin.
2. **This week.** The other four ungoverned tables; drop the three `all_read` policies and `donors_temp_read`; then re-test every role against every screen, because those policies have never actually been in force.
3. **Then.** Apply migrations 1–8 in order on a copy, verify the fallback branches go quiet, apply to production.
4. **Then.** Storage buckets and their policies — decide the photo access question deliberately.
5. **Then.** The report email edge function.
6. **Background.** A baseline migration so the schema is reproducible from the repo. Then the check constraints, each preceded by its own "what is already broken" query.

---

## 9. Queries to run before any of this

```sql
-- Which public tables are unprotected
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relrowsecurity, relname;

-- Every policy that grants unconditionally
select schemaname, tablename, policyname, qual
from pg_policies
where schemaname = 'public' and qual = 'true';

-- Which of the nine migrations are already applied, by probing for a column each one adds
select
  to_regclass('public.student_events')       is not null as lifecycle_applied,
  to_regclass('public.donor_contributions')  is not null as funding_applied,
  to_regclass('public.report_email_payload') is not null as bilingual_applied;

-- Views that bypass RLS
select c.relname, c.reloptions
from pg_class c
where c.relkind = 'v' and c.relnamespace = 'public'::regnamespace
order by c.relname;

-- Data that would fail the proposed constraints
select count(*) filter (where birthdate > current_date) as future_birthdates,
       count(*) filter (where birthdate < '1990-01-01') as impossible_birthdates
from public.students;
```
