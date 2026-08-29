# Design Brief: Teachers directory, invitations, and the Users & roles ledger

## Problem

An admin at iCare adds a teacher because a school has students who need reports written. What they want is simple: this person should be able to sign in and start writing. The platform makes them hold three unresolved things at once.

**They cannot tell which screen is in charge.** There is a Teachers page and a Users & roles page. Both list the same people, both show an access badge, neither says which one owns the job. The admin adds a teacher, sees them appear twice, and cannot tell whether they finished or did half of it twice.

**The Teachers table does not answer the questions they came with.** It shows a Subject column that is a hardcoded em-dash with no database column behind it. It shows a School derived only from the students that teacher supervises — so a teacher who has been assigned to a school but has no students yet reads "—", even though the form asked for the school and saved it. It loads the teacher's LINE ID and never displays it, on a platform where the code's own comment calls LINE "the channel teachers actually answer on". It counts overdue reports but never says when the teacher last submitted anything, so a teacher going quiet is invisible until the count moves.

**The invitation is a black box.** The invitation is an email. Emails to rural Thai school addresses bounce, sit in spam, or land in an inbox nobody opens. Days pass, the teacher has not signed in, and nothing on any screen says so. The admin finds out when a report is late.

And on the other side, Users & roles hands out authority through four columns of checkboxes that write to the database on a single click — no confirmation, no undo, and a failed write only reaches the browser console. An admin can grant someone full admin access with a stray click, or fail to grant it and be shown nothing at all.

## Solution

One place to add a teacher. One directory that answers a supervisor's real questions at a glance. One ledger that treats access as something you change deliberately.

Adding a teacher stays a single act: who they are, their school, their email — and saving creates the account, assigns the Teacher role, and emails the invitation.

**Teachers** becomes the working directory, and every column earns its place: the person in both scripts, the school they actually belong to, how to reach them on the channel they use, how many students they carry, when they last submitted a report, and whether they have signed in at all. A stuck invitation is visible on the row, and can be resent from it.

**Users & roles** becomes the access ledger: every account across every role, with a search and role filter at the top, when each person last signed in, and roles edited deliberately in a panel rather than toggled by accident in a grid.

## Experience Principles

1. **One place to create, everywhere to see** — A teacher is created in exactly one flow. Their sign-in state reads the same on every screen that lists them, because an admin who has to go looking will not look.
2. **Every column answers a question somebody asked** — No placeholder columns, no data collected and then hidden. If the form asks for it and a supervisor needs it, the table shows it; if nothing backs it, it goes.
3. **Roles are what you may do; access is whether you can** — Separate ideas, never merged into one control. Granting authority is deliberate and confirmed; removing access never touches a record, its students, or its reports.

## Aesthetic Direction

- **Philosophy**: Lumen — the existing system. Operational software for people managing real students: spreadsheet-familiar tables, a rationed blue spent only where an action or a state matters, warm off-white chrome.
- **Tone**: Calm and administrative. Adding a teacher is routine. The only things that raise their voice are an unanswered invitation and a teacher who has stopped reporting.
- **Reference points**: Linear's directories, Stripe's team-management screens — dense tables where state is a quiet chip, and the one row that needs attention finds you.
- **Anti-references**: Onboarding-wizard theatre — no confetti, no progress rail, no celebration page for routine work. Equally not a generic admin CRUD grid where every row is the same grey and nothing signals what to do.

## Existing Patterns

- **Typography**: `--font-core` is Figtree with a system fallback stack; one family throughout (`--font-display`, `--font-mono`, `--font-numeric` all alias it). Ramp: `--fs-h1` 24px, `--fs-h2` 19px, `--fs-h3` 16px, `--fs-body`/`--fs-sm` 14px, `--fs-xs` 12px, `--fs-micro` 11px. Table text is `--text-table` (14px).
- **Colors**: Blue ramp `--blue-25` `#f3f5fe` to `--blue-800` `#041461`, primary `--blue-500` `#072ac8`. Surfaces: `--surface-card`/`--surface-raised` white, `--surface-sunken` `--n-25`, nav `#f6f5f2`, rail `#efedea`, hover `--n-100`, selected `--blue-50`. Access tones use the existing `success / info / warning / danger / neutral` set.
- **Spacing**: 4px base scale (`--sp-2` = 8px upward).
- **Radii**: one value — `--radius` 8px aliased across every size; `--radius-pill` 999px for circles and chips only.
- **No field subtext**: helper text under input labels was removed platform-wide and `.mantine-InputWrapper-description` is hidden in `global.scss`. Label and placeholder carry the meaning. Nothing here reintroduces it.
- **Components this feature already stands on**:
  - `userAccess.ts` — the single definition of sign-in state: `active`, `invited`, `stale` (7 days, `INVITE_STALE_DAYS`), `revoked`, `none`, `unknown`, read through the `admin_user_access_state()` RPC and never stored on `profiles`. Actions `resend_invite`, `send_reset`, `invite_link`, `revoke`, `restore` run through the `admin-user-access` edge function. Falls back to "Unknown" when the migration is unapplied rather than failing the page. `AccessRow` already carries `last_sign_in_at`, `last_invite_at` and `invite_count`.
  - `AccessActions.tsx` — `AccessBadge` and `AccessMenu`, already shared by both directories.
  - `TeacherForm.tsx` — posts to `admin-create-user`, creating the account and emailing the invitation in one save; submit reads "Create and send invite". Failure copy already separates duplicate account, non-admin caller, expired session and rate limit.
  - `teacherProfile.ts` — `full_name_th`, `line_id`, `school_id` and `notes` from migration `20260820090000_teacher_profile_fields.sql`, with `isMissingColumnError` degradation.
  - `TableSection`, `PageHeader`, `ContactCell`, `DataColumn`, `TableKpi`, Lumen `Badge` / `Button`.

## The Teachers table

The row answers, left to right: who, where, how to reach them, how much they carry, how they are doing, can they get in.

| Column | Change | Content |
| --- | --- | --- |
| Teacher | Modify | Avatar, English name, Thai name (`full_name_th`) beneath at `--fs-xs` and `--text-subtle`. Falls back to the English name alone when the migration is unapplied. |
| School | Fix | Reads `profiles.school_id` first — the value the form actually saved — and falls back to the schools derived from supervised students. Multiple schools show the first plus "+2". A teacher with a school and no students no longer reads "—". |
| Subject | Remove | Nothing backs it in the database. A column of em-dashes is worse than no column. |
| Contact | Modify | `ContactCell` gains LINE alongside email and phone, since LINE is the channel teachers answer on. LINE shows as a copy action, not a mailto-style link. |
| Students | Exists | Count, right-aligned. |
| Last report | New | Date of the teacher's most recent submitted report across their students, shown as relative age — "3 weeks ago", "7 months ago", "Never". Past the reporting cycle it takes the warning tone. Sorts oldest-first so silence rises to the top. |
| Overdue | Modify | Count of students with an active scholarship and no report inside the cycle. The cycle threshold comes from the shared report-cycle logic used on the students pages, not the local six-month constant this page invented. |
| Sign-in | Modify | `AccessBadge`, sortable by `ACCESS_RANK` so "Invite not used" and "No account" float to the top. |
| Created | Exists | Muted date. First column to drop when space runs out. |
| Actions | Exists | `AccessMenu`, with "Send invitation again" as the primary item for `invited` / `stale` / `none`. |

Notes stay on the teacher's own page — a paragraph does not belong in a table row.

## The Users & roles revamp

This page stops being a second, worse Teachers page and becomes the ledger.

- **Header**: a search field over name and email, plus role filter chips (All / Admin / Teacher / Donor / Agent) using `--surface-selected` when active. "All admins" becomes one click instead of a column-header filter menu.
- **Add user is removed.** People are created where their work lives — a teacher in Teachers, a donor in Donors. This page grants roles to accounts that already exist.
- **Roles become one cell.** The four checkbox columns collapse into a single Roles column of chips. Clicking it opens a side panel: changes are staged, a summary states what will change, Save writes them together. Granting Admin asks for confirmation naming what admin access means. A failed write shows an inline error and rolls the panel back to the last known state — never a silent console line.
- **Last sign-in** joins the table as a relative date, already loaded and currently discarded. An account that has never signed in reads "Never" in the warning tone.
- **KPI tiles corrected**: Accounts · Admins · Never signed in · Access removed. The current "Without a role — cannot sign in anywhere" is factually wrong; a roleless account can sign in perfectly well, it just lands nowhere. That case becomes a "No role" chip in the Roles cell instead.
- **Access actions stay here**: revoke and restore live in this page's row menu, confirmed, with copy that says what survives — the record, the students, the reports.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| `TeacherForm` | Modify | Email required — every teacher is an account. Drop the leftover explanatory paragraph in the Account invitation section; the submit label already says what happens. |
| `AdminCreateTeacherPage` | Modify | On success, return to Teachers with the new row highlighted and a toast naming the address the invitation went to. No separate success screen. |
| `AdminTeachersPage` | Modify | Column set above; school resolution fixed; last-report join added; shared cycle rule replaces the local six-month constant. |
| `AdminUsersRolesPage` | Modify | Search and role filters, Roles cell, last sign-in, corrected KPIs, Add user removed. |
| `RoleEditorPanel` | New | Side panel for staged role changes, with an Admin-grant confirmation and real error handling. |
| `ContactCell` | Modify | Third channel: LINE, as a copy action. |
| `LastReportCell` | New | Relative date with tone by age; "Never" is its own state, not an em-dash. |
| Invite-state filter chips | New | Above the Teachers table: All / Needs attention / Active. |
| `AccessBadge` | Exists | Unchanged, used in both directories and on the teacher page. |
| `AccessMenu` | Modify | Primary item varies by state. `invite_link` stays as the recovery route when email fails; it is not part of the create flow. |
| `AdminTeacherOverviewPage` | Modify | Same access block and the same last-report figure as the row, so page and directory cannot disagree. Notes surface here. |

## Key Interactions

**Creating a teacher.** Fill the form, save. Account created, Teacher role assigned, invitation emailed in one server call. The button shows an in-place pending state; on success the admin lands back on Teachers, the new row flashes once carrying an "Invited" chip, and a toast names the email address. On failure nothing partial is claimed: the existing per-status message appears inline above the form and every typed value is kept.

**A duplicate email.** The common case. The message says an account exists for that address and points to Users & roles to add the Teacher role there — a route, not a dead end.

**An invitation that goes unanswered.** At seven days the chip turns from "Invited" (info) to "Invite not used" (warning) on its own, the KPI tile counts it, and sorting by sign-in floats it up. The admin resends from the row menu without opening the teacher; the row updates in place and a toast confirms.

**Email that will never arrive.** "Copy sign-in link" in the row menu, behind the existing confirmation about it being a credential, hands over a one-time link for LINE. That confirmation copy stays as written — this is the one action where friction is the point.

**A teacher going quiet.** Last report crosses the cycle threshold and takes the warning tone before any report is formally overdue. Sorting by that column puts the quietest teacher first. This is the column a supervisor opens the page for.

**Changing roles.** Click the Roles cell, panel opens, tick and untick, the summary reads back what will change, Save writes it. Granting Admin asks first. A failed write says so on the panel and restores the previous state.

**Removing access.** Row menu on Users & roles only, confirmed, with copy naming what stays untouched. Teachers then shows "Access removed" and the row holds its place — a revoked teacher is still a teacher.

**When the access RPC is unavailable.** Every access chip reads "Unknown", the menus disable, and both tables still load with their real work intact.

## Responsive Behavior

Above 1200px, the full Teachers table: teacher, school, contact, students, last report, overdue, sign-in, created.

Below that, columns drop in reverse order of urgency — created first, then contact, then students. Sign-in and last report never drop; they are why the page exists.

Below 768px both tables become stacked cards: name and school as the heading, sign-in chip and last report on one line beneath, action menu as a single 44px target. KPI tiles become a horizontally scrolling row. Filter chips scroll horizontally rather than wrapping to three lines. The role editor becomes a full-height sheet. The create form is single-column with its submit pinned to the bottom of the viewport.

## Accessibility Requirements

- No state carried by color alone — every chip keeps its text label and its `ACCESS_META.hint` as an accessible description. Relative dates carry the absolute date as a title.
- 4.5:1 minimum on chip and body text; warning tone verified against `--surface-card` and against the row hover fill.
- Fully keyboard operable: menus and the role panel open on Enter or Space, arrow-navigate, close on Escape, and return focus to their trigger. Focus is trapped inside the role panel while open.
- Results of a resend, role change or revoke are announced in a live region — a toast a screen reader never hears is not feedback.
- Form errors tie to their fields with `aria-describedby`; focus moves to the first invalid field on a failed submit.
- After creating a teacher, focus lands on the new row. After a filter change, the row count is announced.

## Out of Scope

- Bulk import or bulk invitation of teachers.
- Any second delivery channel — no SMS, no LINE integration. Email is the only automatic send; copy-link is a manual fallback, not a channel.
- Teacher self-service signup, and any change after they click the link (`WelcomeSetPasswordPage` stays as it is).
- Custom or per-school roles; the set stays admin / teacher / donor / agent.
- The same treatment for donors and agents — they have their own invite path (`invite-donor`) and are untouched here.
- Reworking `admin-create-user` or `admin-user-access` beyond making email required.
- An audit-log UI. The edge function writes the trail; reading it back is separate work.
- Adding a Subject field to the database. The column is being removed, not backfilled; if subject matters, it is its own piece of work.
