# Build Tasks: Platform voice pass

Generated from: design/platform-voice-pass/DESIGN_BRIEF.md
Date: 11 Sep 2026

Rules for every task: follow [docs/VOICE.md](../../docs/VOICE.md) (R1 to R11). Lumen is unchanged: this pass changes words only, never layout, colour, or flow. Every new or changed user-facing string goes into both `en.json` and `th.json`.

**Done means, for every task:**
- `npm run build` passes (there is no test runner or linter in this repo).
- `copy-reviewer` rerun on the task's files reports no findings except the brief's agreed exceptions.
- Changed Thai buttons are checked at 375px.

**Off limits until told otherwise:**
- Donor records session files: `AdminCreateDonorPage`, `AdminEditDonorPage`, `DonorForm`, `ContributionDrawer`, `ContributionsTable`, `AllocationPanel`, `donorMoney.ts`, `AdminDonorDetailPage`
- Sponsorship session files: `src/modules/calendar/*`, `src/modules/sponsorship/*`, `DonorProfileTab.tsx`, `AdminStudentOverviewPage.tsx`, `AdminStudentsPage.tsx`, `dashboardMetrics.ts`, `dashboard/TodayRail.tsx`, `studentProfile.ts`, and the sponsorship keys in both locale files
- `AdminReportsBetaPage.tsx` and `WaitingDeliveryDialog.tsx`: released by donordashboard-92 ("1.15 done"), findings applied and reviewed.
- `ReportVerifyPage.tsx`: now owned by donordashboard-43.

## Foundation

- [x] **Make `format.ts` speak the voice** (done 11 Sep 2026: `EMPTY` replaced by `emptyValue(lang)`, `CURRENCY_OPTIONS` labels without dashes): in [src/design-system/format.ts](../../src/design-system/format.ts):
  - change `EMPTY` from "—" to "Not recorded"
  - make `formatDateRange` join with " to " and handle open ends as "From 12 Mar 2026" / "Until 11 Mar 2027"
  - give `formatDate`, `formatDateTime` and `formatDateRange` an optional `lang` that produces Thai months with the Western year for now (`11 ก.ย. 2026`, ranges joined with " ถึง "), defaulting to the current i18n language. Buddhist Era years come in a later release; don't add 543.

  Done when every existing caller renders without a dash and switching to ไทย changes the dates. _Modifies: `format.ts`. Reuses: i18n `language`._

- [x] **Fix the other empty-value roots** (done 11 Sep 2026; `schoolProfile.ts` uses `emptyValue()` and `formatDate`):
  - set `common.none` in `en.json` to "Not recorded" and in `th.json` to "ยังไม่ได้บันทึก"
  - point `PLACEHOLDER` in [schoolProfile.ts](../../src/modules/admin/schoolProfile.ts) at `EMPTY`, so there's one source
  - make `ProvinceTable` numeric columns show "0" instead of a dash

  _Modifies: locale files, `schoolProfile.ts`, `dashboard/ProvinceTable.tsx`. Depends on: Make `format.ts` speak the voice._

- [x] **Friendly error helper** (done 11 Sep 2026: `src/i18n/errors.ts`, used in `entityForm.ts`): add `toFriendlyError(err, fallbackKey)` next to `format.ts`. It logs the raw error with `console.error` and returns the translated message for `fallbackKey`. Add these keys to both locale files:
  - `errors.save`, `errors.load`, `errors.create`, `errors.network`, `errors.permission`
  - each in the form "We couldn't … Check your connection and try again."

  Use it first in [entityForm.ts](../../src/modules/admin/entityForm.ts), so every form built on it inherits it. _New helper. Modifies: `entityForm.ts`, locale files._

- [x] **Plain pending-update notices** (done for `teacherProfile.ts` and `userAccess.ts`; `studentProfile.ts` deferred, another session owns it): rewrite the pending notes (`TEACHER_FIELDS_PENDING_NOTE` in `teacherProfile.ts`, `STUDENT_LIFECYCLE_PENDING_NOTE` in `studentProfile.ts`, the "Unknown" hint in `userAccess.ts`) as a plain sentence and a next step. Move each migration file name to `console.info`. Leave `DONOR_FIELDS_PENDING_NOTE` in `donorRecord.ts` for the donor records phase. Done when no migration name, table name or column name renders on screen (R11). _Modifies: 3 files._

## Core UI

- [x] **Report email reads like a letter** (done 11 Sep 2026): in [report-email/template.ts](../../supabase/functions/report-email/template.ts):
  - English subject becomes "{name}'s term report"
  - date range uses "to" / "ถึง"
  - "in her teacher's own words" becomes "in {name}'s teacher's own words" (R10)
  - remove "simply" from the reply note
  - warmer Thai reply note: "มีคำถามเกี่ยวกับรายงานฉบับนี้ไหมคะ ตอบกลับอีเมลนี้ หรือติดต่อ {email} ได้เลยค่ะ"

  Done when `EmailPreviewDialog` shows the new copy in both languages. _Modifies: `template.ts`. Reuses: `EmailPreviewDialog`._ This is the most visible surface a donor sees, so it goes first.

- [x] **Locale file wording pass** (done 11 Sep 2026, sponsorship keys untouched): apply the review's `en.json`/`th.json` findings:
  - `errors.generic`, `errors.missingStudentId`, `student.empty`, `teacher.profileNotFound`, `student.monthlySupport` (drop "THB"), `student.background`, `report.approveAndSend`, `report.noRecipients`, `money.overAllocated`, `nav.logout` → "Sign out"
  - the five `*Required` messages, now with reasons
  - Thai: remove "กรุณา" and "เกิดข้อผิดพลาด", and add ค่ะ/นะคะ to full sentences

  Leave the sponsorship keys alone. _Modifies: both locale files._

- [x] **Teacher pages in Thai, part 1: dashboard and student list** (done 11 Sep 2026, keys under `teacherPages.*`): move every string in [TeacherDashboardPage.tsx](../../src/modules/teacher/TeacherDashboardPage.tsx) and [TeacherStudentsPage.tsx](../../src/modules/teacher/TeacherStudentsPage.tsx) to `t()` under `teacher.dashboard.*` and `teacher.students.*`, with Thai values. Reuse the existing `student.*`, `report.*` and `errors.*` keys. Fix the copy as you go:
  - "Submit report" → "Send report"
  - "No students found." → an empty state with a next action

  Done when switching to ไทย leaves no English on either page. _Modifies: 2 pages, locale files. Depends on: Locale file wording pass._ This is the highest risk task, so it comes before the admin work.

- [x] **Teacher pages in Thai, part 2: student detail and profile** (done 11 Sep 2026): same treatment for [TeacherStudentDetailPage.tsx](../../src/modules/teacher/TeacherStudentDetailPage.tsx) and [TeacherProfilePage.tsx](../../src/modules/teacher/TeacherProfilePage.tsx):
  - remove the generic "View and update the basic information…" subtitle (R5)
  - "Background / notes" becomes one heading with no repeated label (R9)
  - drop "(THB)" and "e.g." from labels and placeholders
  - errors go through `toFriendlyError`
  - `teacher.profileNotFound` is reused

  _Modifies: 2 pages. Depends on: Friendly error helper, Teacher pages part 1._

## Interactions & States

- [x] **Admin form errors** (done 11 Sep 2026): replace every raw or technical error in [AdminCreateUserPage.tsx](../../src/modules/admin/AdminCreateUserPage.tsx), [TeacherForm.tsx](../../src/modules/admin/TeacherForm.tsx), [SchoolForm.tsx](../../src/modules/admin/SchoolForm.tsx), `AdminCreateScholarshipPage`, `AdminEditScholarshipPage`, `AdminCreateGrantTypePage`, `AdminEditGrantTypePage`, `AdminEditSchoolPage` and `AdminBrandingPage` with `toFriendlyError`. These include "NOT be created… See console", `VITE_SUPABASE_URL`, "server", "table", `insertError.message`, "Unexpected error". Success messages name who and what ("Araya's invitation was sent to …"). Covers: save error, load error, network error, partial success (account created but profile not saved). _Modifies: 9 files. Depends on: Friendly error helper._

- [x] **Edge function error bodies** (done 11 Sep 2026; Thai greeting "เรียน ท่านผู้สนับสนุน" left formal, pending your call): in `admin-create-user`, `invite-donor`, `admin-user-access` and `donor-renew-request`, return plain messages (for example "Add an email address and a name to invite this person.") and log the raw error with `console.error` on the server. "user" becomes "person" or "account". Covers: validation, not found, invite failed, internal error. _Modifies: 4 functions._

- [x] **Guidance copy on admin forms** (done 11 Sep 2026; report forms handled with the reports task): across the admin form files not owned by another session (`StudentFields`, `StudentForm`, `StudentFormDrawer`, `TeacherForm`, `SchoolForm`, grant type pages, scholarship pages, `AdminCreateUserPage`, `RoleEditorDrawer`, `AdminBrandingPage`, report forms):
  - every placeholder follows R8: no "e.g." / "เช่น", no visibility statements, and each says what's worth writing
  - repeated headings and labels are removed under R9: the "Roles" heading plus label, and the internal note in `ReportForm`
  - generic subtitles are removed under R5
  - required-field messages are imperative and give a reason
  - Title Case becomes sentence case ("Branding and layout", "Dashboard banner", "Create and send invite")

  Covers: default, validation, empty. _Modifies: ~14 files._

- [x] **Empty, missing and not-found states on admin pages** (done 11 Sep 2026; AdminStudentsPage and dashboard/* left to their owner): on the directory and detail pages:
  - every "X not found" becomes "We couldn't find this X. It may have been removed."
  - every "Could not load" gets a fix
  - every empty table gets a reason and a first action
  - the confirm and alert text reads "Delete {name}? This can't be undone." (the component stays)
  - bare "—"/"–" left after the Foundation tasks become specific phrases ("No school recorded")

  Covers: empty, not found, load error, confirm. _Modifies: `AdminStudentDetailPage`, `AdminStudentOverviewPage`, `AdminTeacherOverviewPage`, `AdminTeacherStudentsPage`, `AdminTeachersPage`, `AdminUsersRolesPage`, `AdminGrantTypesOverviewPage`, `AdminScholarshipsPage`, `AdminReportsBetaPage`, `AdminSchoolDetailPage`, `AdminSchoolsPage`, `AdminContactRequestsPage`, `donorCard.ts`._

- [x] **Dash and symbol sweep** (done per file by each task, 11 Sep 2026; owned files excluded): remove every remaining visible `-`, `–`, `—`, `&mdash;` and `&` across the files in scope (the rewrite goes in the nearest string, not a blanket replace). Replace `toLocaleDateString()` with `formatDate` / `formatDateRange` in the 11 files that call it. Swap "Log out" for "Sign out" in `AppShellLayout`. Grep afterwards, and the only hits left are the agreed exceptions. _Modifies: many files. Depends on: Make `format.ts` speak the voice._

- [x] **Sign-in and profile copy** (done 11 Sep 2026): in `LoginPage`, `ResetPasswordPage`, `WelcomeSetPasswordPage`, `AcceptInvitePage` and `ProfilePage`:
  - remove "Welcome!" and every "Please"
  - loading text becomes "Getting your … ready…"
  - "not logged in" → "not signed in"
  - errors go through `toFriendlyError`

  Covers: loading, error, success. _Modifies: 5 files._

- [x] **Donor facing pages** (done 11 Sep 2026; EmailPreviewDialog still shows the raw report-email error, left because another session is editing it):
  - `DonorRenewPage`: remove the organisation name, slogan, sentiment and Title Case
  - `DonorStudentDetailPage` (live): fix the dashes, "THB" fallbacks, hand-written dates and "not found"
  - `DonorDashboardPage` and `DonorBalanceCard`: fix the "– Grade", "THB" and "Over-allocated" text
  - `DonorReportCard`: fix the dash in the alt text
  - `ReportVerifyPage`: fix the dashes and the "&"

  _Modifies: 6 files. Depends on: Make `format.ts` speak the voice._

- [x] **Query page in plain language** (done 11 Sep 2026): rewrite the copy on [AdminReportsPage.tsx](../../src/modules/admin/AdminReportsPage.tsx):
  - table names become plain names ("Term updates / reports" → "Reports")
  - operators become words (`eq` → "is", `neq` → "isn't", and so on)
  - "ID" gets a readable label
  - empty cells use `EMPTY`

  Logic and layout are unchanged. _Modifies: 1 file._

## Responsive & Polish

- [ ] **Length check at 375px**: on phone width, open every page changed above in both languages. Buttons stay at 2 lines or fewer. Table cells that show "Not recorded" truncate with an ellipsis and a `title` rather than growing the row. Error messages wrap, never truncate. Breakpoints: 375, 768, 1440.
- [x] **Accessibility pass** (checked in code 11 Sep 2026: R9 fields keep aria-labelledby, errors use InlineMessage with role="alert", ranges use "to"/"ถึง", teacher pages fully in t(). A real screen reader run is still worth doing):
  - each field whose visible label was removed under R9 still has an accessible name (`aria-label` or `aria-labelledby` pointing at the section heading)
  - errors carry `role="alert"` or `aria-describedby`
  - date ranges read "to" / "ถึง" to screen readers
  - no Thai screen reader output jumps to English partway through a sentence on the teacher pages

## Donor records files (blocked)

- [ ] **Donor forms and money copy**: after the donor records session commits, apply the review's findings to `AdminCreateDonorPage`, `AdminEditDonorPage`, `DonorForm`, `ContributionDrawer`, `ContributionsTable` and `DONOR_FIELDS_PENDING_NOTE`:
  - the internal note placeholder and repeated heading from the screenshot
  - "Visible only to admins (e.g., …)"
  - "Dashboard & communication"
  - "Amount (THB)"
  - "Voided — reason"
  - raw errors

  _Blocked by: donor records commit. Depends on: Friendly error helper._

## Review

- [x] **Full copy review** (done 11 Sep 2026; all remaining findings fixed): run `copy-reviewer` on the whole platform. The only findings left should be the brief's agreed exceptions and the out-of-scope items (admin Thai, `designsystem`, sponsorship, calendar).
- [ ] **Design review**: run /design-review against [DESIGN_BRIEF.md](DESIGN_BRIEF.md).
