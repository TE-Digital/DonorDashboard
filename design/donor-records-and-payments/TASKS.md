# Build Tasks: Donor records & payments, then sponsorship

Generated from: `design/donor-records-and-payments/DESIGN_BRIEF.md` and `INFORMATION_ARCHITECTURE.md` (phase 1), and `design/donor-sponsorship/DESIGN_BRIEF.md` (phase 2). The email work comes from `design/donor-email-and-bilingual/DESIGN_BRIEF.md`.
Date: 2026-09-11

**Order is fixed by dependencies.** Phase 2 builds on phase 1's donor overview, Students tab and payment flow, and both need the migrations at the top. Within each group, riskier work comes first.

**Visual direction: Lumen, unchanged.** No new tokens, colours or fonts. Every new screen copies an existing one: the add-teacher drawer, the teacher overview, and the students list's row menu. The first UI task (1.4) sets this; everything after it follows.

**Definition of done, for every task:**
- `npm run build` passes. It runs `tsc --noEmit` first.
- UI tasks: a Playwright check of the flow at 1280px and 375px. This **needs an admin test account**; the 2026-09-11 QA run couldn't get past login without one.
- Edge-function tasks: a real send against staging. Deno isn't installed locally, so `report-email` is syntax-checked (esbuild) but not type-checked.
- No unit-test framework is set up. `@playwright/test` is installed.

## Done ahead of the build (2026-09-11)
- [x] **Migration version clash**: `school_location` renamed to `20260831100000`. It's safe to re-run.
- [x] **Report emails respect "Wants email updates"**: `20260911090000_report_recipients_email_pref.sql`.
- [x] **One donor without an email no longer blocks a report**: `report-email` skips and names them, doesn't re-email donors already in `sent_to`, and no longer wipes `sent_at` / `sent_to` on a failed attempt. `EmailPreviewDialog` warns before sending, and `ReportVerifyPage` shows a lasting notice after.
- [x] **Dead "automatically linked" check removed** from `AdminCreateDonorPage`.

---

# Phase 1 · Donor records & payments

## Foundation
- [ ] **1.1 Stand up staging data**: apply the pending migrations in order (lifecycle → funding → bilingual → school_location → `20260911090000`) to a staging copy of production. Run the probe query in `docs/BACKEND_IMPLEMENTATION.md`, and re-check `donors`, `scholarships` and `scholarship_awards` against `full_schema.sql` (it's dated 14 June and may be stale). Done when the probe reports every migration applied and the three tables match. _Reuses: existing migrations. Gates every task below that touches data._
  > **Status 2026-09-11: blocked, needs a person.** There's no database access from the build machine (no Supabase CLI, `psql` or staging credentials). The steps are written up in `supabase/scripts/README.md`.
- [ ] **1.2 Donor and scholarship schema migration**: one new migration with a unique version that:
  > **Status 2026-09-11: written, not run.** `supabase/migrations/20260911100000_donor_records.sql` passes the Postgres parser (libpg-query, 16 statements). It also restores `donor_balance`'s admin-or-own access rule, which `20260831090000` had dropped. It won't count as done until it runs on staging (1.1) and the README's checks pass. **Money fix, 2026-09-11:** `donor_balance` now counts every scholarship, ended ones included, as committed. Before, an ended scholarship's already-spent money became allocatable again. That bug was inherited from the funding migration's view and caught by the sponsorship session. `monthly_committed` stays active-only.
  - Adds `donors.donor_type` (default `individual`), `contact_person` and `country`.
  - Replaces `scholarships_status_check` with `active | needs_decision | ended`, mapping `inactive` to `ended`. The live check allows only `active`/`inactive`, and 1.3 needs `ended`.
  - Adds `source_award_id` to `scholarships` and `donor_contributions`.
  - Re-creates `donor_balance` **once**, with `last_received_on` and sponsorship's committed rule (`active` + `needs_decision`), from the `bilingual_and_email` version.
  - Normalises existing Thai phones (`0XXXXXXXXX` → `+66…`) and leaves every other number untouched, for task 1.8's fix list.

  No new FKs. Done when it applies on staging, re-runs cleanly, and existing donors read as `individual`. _New migration. Depends on: 1.1._
- [ ] **1.3 Copy old awards into scholarships (preview, then write)**. This is the riskiest task: live money records, no test database until 1.1.
  > **Status 2026-09-11: written, not run.** The preview is a read-only view in `20260911110000_scholarship_award_copy_plan.sql`, safe for `db push`. The write is `supabase/scripts/copy_scholarship_awards.sql`, run by hand only, never by `db push`. It inserts from the same view and rolls back if anything is left uncopied. Both parse cleanly. Months are counted from days, because `age()` would overstate monthly amounts by a fifth. **Cancelled awards are flagged, not copied** (2026-09-11): nobody knows how much of one was used, and the balance counts an ended row's whole amount as used.
  - Ships a read-only **preview query** listing every row it would create, skip or flag. The preview is reviewed before the insert runs.
  - Rules:
    - **Copy, don't move**: 15 screens still read `scholarship_awards`.
    - An `active` award covering today becomes `active`; everything else becomes `ended`, with `ended_reason` (past / completed / cancelled).
    - Paid awards (`is_paid` or `payment_date`) also create a THB payment dated `payment_date`, else `period_start`, noted *Migrated from award*.
    - Currency `THB` / `thb` / `Bhat` / blank counts as THB; any other currency is listed.
    - Awards missing `donor_id` or `student_id` are skipped and listed.
    - Overlaps with an existing active scholarship are skipped and listed.
    - `source_award_id` makes a re-run skip what's already migrated.

  Done when **awards in = scholarships created + skipped + flagged** on staging, and a sample of migrated donors show a zero or truthful balance, not a negative one. _New migration + preview SQL. Depends on: 1.2._

## Core UI
- [x] **1.4 Country and phone fields**: a `CountrySelect` (optional, starts blank, searchable, Thailand first, static ISO list with dialling codes) and a `PhoneInput` (dialling-code prefix from the country; with no country it expects `+`). Add `isInternationalPhone(value, country)` and `normalisePhone` (E.164) to `fieldValidation.ts`. `isPhone` stays Thai-only for students and teachers. Adds `libphonenumber-js` ("min" metadata); run `/spartan:js-security` on it before merging. Done when both fields validate Thai-local, `+44…`, and bad numbers with the brief's exact messages. Show them on `/design-system/reference`, which is dev-only. _New: `CountrySelect`, `PhoneInput`. Modifies: `fieldValidation.ts`. Establishes the Lumen form look for this feature._
  > **Done 2026-09-11.** Built as `CountrySelect`, `PhoneInput` and `countries.ts`, plus `phoneProblem` / `phoneMessage` / `isInternationalPhone` / `normalisePhone` / `displayPhone` in `fieldValidation.ts`. `isPhone` is unchanged. There's no hand-kept country list: the countries and dialling codes come from `libphonenumber-js` (MIT, not in any `npm audit` finding) and the names from the browser. Checks: a type-check passes, 22/22 helper assertions pass, and every Playwright check at 1280px on `/design-system/reference` passes. **The 375px check moves to 1.5:** the reference page is desktop-only (its side nav and 132px label column leave the demo 46px wide), so it's no fair test. The donor drawer, full-screen at ≤640px, is. Error examples come from the library, since the brief's `7700 900123` is a fictional UK number the library rightly rejects.
- [x] **1.5 Add donor in a side panel**: `DonorForm` + `DonorFormDrawer` (size 880) + `DonorTypeToggle`, following `TeacherFormDrawer` / `StudentFormDrawer` through `EntityFormHandle`.
  > **Done 2026-09-11.** New: `donorRecord.ts` (fields, validation, duplicate lookup with `_`/`%` escaped, a check for whether the new columns exist, and a save that retries without them), `DonorForm.tsx`, `DonorFormDrawer.tsx`. `AdminDonorsPage` opens the drawer via `?add=1` and reloads quietly after a create (a full reload would unmount the drawer). Verified: a type-check; 45/45 Playwright checks on the real `/admin/donors` with **every** Supabase request intercepted (fake admin session, nothing reaches the database), across four scenarios: 1280px, 375px (full-width drawer, 325px country field, one column, no overflow), new columns missing (plain-words note, base save, Thai phone rule), and a stale schema cache (full save refused, retried without the new columns). Copy passes `docs/VOICE.md` after the copy-reviewer's 12 fixes. The old `/admin/donors/new` page still exists until 1.13.
  - Sections: Donor (type; name or organisation name; contact person, **required for organisations**; agent), Contact (email, **required for new donors**; country; phone; other contact; address), Preferences (English · Thai; **Send report emails**, which is the existing `wants_email_updates` relabelled; newsletter; dashboard access, kept as-is), Internal note.
  - Email: format check plus a case-insensitive duplicate check against other donors, which blocks and links to that donor. No account-link notice.
  - Every invalid field is marked at once, the summary shows in the drawer's `status`, and focus goes to the first problem.
  - "Add donor" on the list opens it and sets `?add=1`. On save: notification *"{name} added"* with **Open donor**, and the new row highlighted.

  _New: `DonorForm`, `DonorFormDrawer`, `DonorTypeToggle`. Reuses: `FormDrawer`, `FormSection`, `fieldValidation`, `entityForm`. Modifies: `AdminDonorsPage`. Depends on: 1.2, 1.4._
- [x] **1.6 Donor overview (header, KPIs, Overview tab)**: rebuild `AdminDonorDetailPage` in the teacher-overview shape.
  - `<h1>` + Individual/Organisation `Badge` + **Edit** (secondary) and **Record payment** (primary).
  - Subtitle: contact person · country · email · language.
  - `KpiRow`: Total given · Unallocated (warning tone when > 0) · Students funded · Last payment (from `last_received_on`).
  - `Tabs` backed by `?tab=`, copying `AdminStudentOverviewPage`'s `tabFromUrl` + `replace`; defaults to Overview.
  - Overview tab field grids: Contact · Donor · Preferences · Internal note.
  - Notices: *"Report emails are off for this donor."* and *"No email — reports can't be sent."*

  _Modifies: `AdminDonorDetailPage`. Reuses: `KpiRow`, `Tabs`, `Badge`, field-grid styles from the teacher overview. Depends on: 1.2._
  > **Done 2026-09-11.** `AdminDonorDetailPage` rebuilt in the teacher-overview layout: initials avatar, name, Individual/Organisation badge, subtitle (contact person · country · email · language), **Edit** and **Record payment**. Notices for columns pending, funding not set up, no email, and report emails off. KPIs: Total given, Unallocated (orange with *Waiting to be allocated*, or *More allocated than given*), Students funded (active only), Last payment (from `last_received_on`, now in `DonorBalance`). Tabs are synced to `?tab=` with `replace`, and an Overview tab holds Contact / Donor / Preferences / Internal note, where empty values read *Not recorded*. The existing ledger and students table moved into the Payments and Students tabs, so nothing was lost; 1.9 and 1.10 refine them. `DonorBalanceCard` is off the admin page and kept for the donor's own view. Verified: a type-check, and 58/58 Playwright checks with every Supabase request intercepted (1280px, 375px, missing columns, no email), with tab clicks scoped to the tab strip so the sidebar can't give a false pass.
- [x] **1.7 Edit donor in the same panel**: **Edit** opens `DonorFormDrawer` pre-filled, sets `?edit=1` and keeps `?tab=`. The duplicate check excludes the donor's own address. An **existing** donor with no email saves with a warning. An invalid stored phone blocks saving with *"That isn't a valid number. Fix it or clear the field."* On save the overview updates in place and stays on the same tab. _Modifies: `DonorForm` (edit mode), `AdminDonorDetailPage`. Depends on: 1.5, 1.6._
  > **Done 2026-09-11.** **Edit** on the overview opens `DonorFormDrawer` in edit mode (*Edit donor · {name}*, **Save changes**) via `?edit=1`, keeping `?tab=`, and reloads in place with *"{name} updated"*. `donorRecord.ts` gained `toDonorDetails` (a stored `+66…` phone shows as `081 234 5678`; an unparseable one shows exactly as stored) and `updateDonor`, which asks for the row back so an update refused by a policy (zero rows, no error) is reported as refused. The old edit page would have said "saved". For existing donors: email isn't required (a warning shows what it costs), the duplicate check skips their own address, and a bad old phone blocks saving until it's fixed or cleared. Verified: a type-check, and 48/49 Playwright checks (1280px, 375px, no email, bad old phone, refused update), all Supabase traffic intercepted. The one failure is a `createRoot` warning from a hot reload caused by the other session editing the tree mid-run, not this code. The old `/admin/donors/:id/edit` page still exists until 1.13.
- [x] **1.8 Donors list upgrades**, the main working screen:
  - Columns: Type badge (plus contact person on organisation rows), Country, and **Last payment** in place of Last scholarship by default. Agent and Last scholarship move to the end. `TableSection` can't hide columns, so check the width at 1280px.
  - A `⋯` row menu (**Record payment · Edit · Open donor**), copying the students list's `actions` column (a Mantine `Menu` behind `IconDotsVertical` in `rowActions`, with `stopPropagation`).
  - Column filters: Type · Country · Unallocated.
  - Read `?balance=idle`, which fixes the dashboard's dead "Allocate ฿X" link, and `?phone=invalid`, set by a **Phone needs fixing (n)** control. Both show as a removable `Tag`, as schools does for `?province=`.

  _Modifies: `AdminDonorsPage`. Reuses: `TableSection`, `Tag`, Mantine `Menu`. Depends on: 1.4, 1.5._
  > **Done 2026-09-11.** `AdminDonorsPage` rewritten. The donors load with the new columns, falling back without them. New columns: Type (badge, filterable), Country (by name, filterable), Last payment (from `last_received_on`). Organisation rows show their contact person, and a stored phone that doesn't validate shows *· needs fixing*. Entry filters `?balance=idle` (**the dashboard's "Allocate ฿X" link finally works**), `?type=`, `?country=` (case-insensitive) and `?phone=invalid` show as removable `Tag`s, with an empty state that says a filter is on. A **Phone needs fixing (n)** control appears when any are bad. The `⋯` row menu copies the students list: **Record payment** opens `ContributionDrawer` over the list and reloads the row quietly, **Edit** goes to the overview with `?edit=1`, and **Open donor**. The voice rules are applied: no `—` (*Not recorded*, *No email*, *No phone*, *No payments yet*, *None yet*), and dates use `formatDate`, not `toLocaleDateString`. The unused `shortfallSentence` import is gone. Verified: a type-check, and 42/42 Playwright checks at 1280px and 375px, all Supabase traffic intercepted, no hot reloads. The KPI-click filter was left out: the IA doesn't require it, and the dashboard link covers it.
- [x] **1.9 Payments: rename and record from anywhere**:
  - Change all 14 user-visible *contribution* strings to *payment*: `ContributionDrawer` (title *Record payment* / *Edit payment*), `ContributionsTable` (section title *Payments*, empty states, void dialog, row icon labels), `DonorBalanceCard`, the `donorMoney.ts` errors, and the dashboard CSV line.
  - **Record payment** opens the drawer from the overview header and from the list's row menu. After saving: *"฿21,450 recorded."* On the list the row's Given / Unallocated / Last payment update in place; on the overview the KPI row does, with a **View payments** link.
  - The Payments tab holds `ContributionsTable`, with Edit and Void kept.
  - Fields stay THB-only and unchanged.

  _Modifies: `ContributionDrawer`, `ContributionsTable`, `DonorBalanceCard`, `donorMoney.ts`, `dashboardMetrics.ts`, `AdminDonorDetailPage`. Depends on: 1.6, 1.8._
  > **Done 2026-09-11.** Every user-facing *contribution* now says *payment*, including the ledger buttons my first grep missed (its exclusion list matched the filename) and two dashboard strings (`FundingSummaryBand`, `FundingTrendChart`). `ContributionDrawer` shows one confirmation wherever a payment is recorded (*"฿21,450 recorded."*), and the overview adds **View payments** when the ledger isn't open. The copy-reviewer's 18 findings are applied: no "database" in admin messages, *Not recorded* instead of `—`, *"฿X more than this donor has given"*, *"Needs ฿X more"* via `formatCurrency`, and **Edit donor**. The one exception is the **Amount (THB)** label, kept because the input has no ฿ prefix. Verified: a type-check, 28/28 Playwright checks at 1280px and 375px, and a regression pass of 1.6 (58/58), 1.7 (48/49; the failure is a hot reload from the other session) and 1.8 (42/42).
- [x] **1.10 Students tab**: the funded-students table from `scholarships` (student, monthly amount, coverage window, status **Active / Ended**), active rows first, with **Allocate**. Allocate opens the existing `AllocationPanel` and is disabled with a reason at zero balance: *"Record a payment first — there's nothing to allocate."* Existing donors show their migrated history here. _Modifies: `AdminDonorDetailPage`. Reuses: `AllocationPanel`, `TableSection`. Depends on: 1.3, 1.6._
  > **Done 2026-09-11.** The Students tab puts active rows first and ended ones underneath (the sort is stable, so the newest coverage stays on top within each group). *Unallocated: ฿X* sits beside **Allocate**. At zero or below, Allocate is disabled with the reason written out: *"Record a payment first. There's nothing to allocate yet."* It still opens the existing `AllocationPanel`; the sponsorship session's `AssignSponsorDrawer` replaces it in phase 2. Verified: a type-check, and 21/21 Playwright checks (1280px and 375px with money waiting, and 1280px at zero), with the fixture sending ended rows first to prove the sort.
- [x] **1.11 Find donors through global search**: `searchDonors` opens `/admin/donors/:id`, not `/edit`, and matches `name`, `contact->>email` and `contact_person`. Delete the comment claiming donors have no read-only record. _Modifies: `globalSearch.ts`. Depends on: 1.2, 1.6._
  > **Done 2026-09-11.** Donors match on name, email (`contact->>email`) or contact person, and the hit's subtitle shows *Contact: {name}*. Before the donor migration runs, a missing `contact_person` column is retried without it, so name and email search keep working. Results open the overview. Verified: a type-check, and 19/19 Playwright checks on a static build (1280px, 375px, and columns missing), all Supabase traffic intercepted. An earlier 11/19 was a bug in the test's stub (it read the `+` in an encoded space literally), not in the app.
- [ ] **1.12 Student → their donors**: a **Funded by** line above the student's Scholarships tab, from the `student_donors` view. Each name links to `/admin/donors/:id?tab=students`; with no donor it reads *"Not funded by any donor"*. _Modifies: `AdminStudentOverviewPage`. Depends on: 1.1, 1.10._
- [ ] **1.13 Retire the old donor pages**: `/admin/donors/new` redirects to `?add=1`, and `/admin/donors/:id/edit` to `?edit=1`. Then delete `AdminCreateDonorPage` and `AdminEditDonorPage`. Invitations are deferred, so that section isn't carried over and `invite-donor` stays deployed but unused. **Gate: 1.3 has run in production, and 1.6–1.10 have shipped.** Otherwise the only screen showing award history disappears. _Modifies: `App.tsx`. Deletes: the two pages._

## Interactions & States: sending reports
- [x] **1.14 Add recipients at send**: an **Add recipients** field at the top of `EmailPreviewDialog`.
  > **Done 2026-09-11.** The dialog opens with **Add recipients** (email, **EN · ไทย**, **Add address**; Enter also adds). It refuses an incomplete address, a repeat, or a language whose version is empty, and says which. Each donor with no address gets an *Email for {name}* box and a ticked *Save this address to {name}'s donor page*. Send counts everyone (*Send to 3 people*) and stays off while nobody is set or a typed address is wrong. Approving now always opens the dialog, even with no funding donor, so a report always has a way out. `onSent` takes `{ sent, skipped, unsaved }`. An address that sent but didn't save raises its own notice. Also fixed along the way: Lumen `Dialog` had no accessible name, so it now has `aria-modal`, `aria-labelledby` and `aria-describedby`. Found but not fixed (shared components): Lumen `Field` never renders its `hint`, and Lumen `Checkbox` is a clickable `<span>` with no role or keyboard support. This dialog uses Mantine's instead. Verified: a type-check, and 55/55 Playwright checks on a static build (1280px and 375px with a donor missing an address, and 1280px with no funding donor), with the function and every Supabase call intercepted. Copy passes `docs/VOICE.md` after the copy-reviewer's 8 fixes.
  - Any address, for this send only, validated like the donor email field, each with an **EN · ไทย** switch defaulting to English; Send is blocked if that language's version is empty.
  - An inline **Add their address** box, with **Save to donor** ticked, for each sponsor with no email.
  - Send disabled until at least one address is set.
  - `report-email` accepts `extraRecipients` and `donorAddresses`, validates them server-side, writes a ticked address to the donor, and records added recipients in `sent_to` with `donor_id` null.

  Covers: empty, invalid address, missing language, all-skipped, and partial failure. _Modifies: `EmailPreviewDialog`, `report-email`, `ReportVerifyPage`. Depends on: 1.1._
- [x] **1.15 Waiting to send drafts**: a `report_deliveries` table (one row per report and recipient, `waiting · sent · failed`; TEXT, `uuid_generate_v4()`, soft delete, no FKs), with `sent_at` / `sent_to` derived from it.
  - `report-email` can send one waiting delivery.
  - **Reports beta** gets a **Waiting to send** filter (approved reports with any waiting or failed delivery), a *Waiting for* column, and a count on its sidebar item.
  - The draft view offers **Send to** plus **Also save this address to {donor}**, ticked by default. Sending reaches that one recipient only.

  Covers: waiting, failed with the reason, sent-and-removed-from-list, and empty list. _New migration. Modifies: `report-email`, `AdminReportsBetaPage`, `AppShellLayout`, `EmailPreviewDialog`. Depends on: 1.14._
  > **Done 2026-09-11.**
  > - **Migration `20260911115000_report_deliveries.sql`:** one row per report and recipient (`waiting · sent · failed`). It has `reason` (checked against `needs_decision`, `support_ended`, `report_emails_off`, `donor_emails_off`, `no_email`) and `template_id`, both for the sponsorship work. Admins can read it; only the function writes. Existing `sent_to` entries are backfilled as sent. It also defines `update_updated_at()`, with the same body as `20260911120000`.
  > - **`report-email`:** the preview writes a waiting row for every intended donor, so a report approved and then left unsent stays listed. Every send writes sent, failed (with the service's reason) or waiting (`no_email`) rows. `onlyDonorIds` scopes a send to one person. `sent_at` and `sent_to` are still written, so older screens keep working.
  > - **Reports beta:** a **Waiting to send** filter, a *Waiting for* column with **Send**, and a pinned **Waiting to send** status. On that filter, tapping a row opens the send. The **Approved** footnote now says how many are waiting.
  > - **`WaitingDeliveryDialog`:** sends to one person at a time. It offers *Send to* plus a ticked *Also save this address to {donor}* for someone with no address, and *Try again* for a refused address.
  > - **Sidebar:** the Reports beta item shows a count, refreshed on navigation and after every send.
  >
  > Verified: a type-check; the migration parses (libpg-query, 17 statements) and the function parses (esbuild); 38/38 Playwright checks (1280px, 375px, and the table missing), plus the 1.14 suite again at 55/55. **Found, not fixed:** at 375px, Reports beta's DataTable clips its middle columns and nothing scrolls sideways to reach them. The pinned status covers this view, but the table needs a phone layout (1.17).
- [ ] **1.16 States pass (donor screens)**: loading, empty, error and "migration not applied" states on the list, the overview's three tabs, and both drawers. Each matches the brief's copy, and none is left blank. _Reuses: `LoadingState`, `EmptyState`, `Banner`._

## Responsive & Polish
- [ ] **1.17 Responsive pass**: drawers go full-screen ≤640px with the action bar pinned, all fields single-column, and the type toggle full width. Tabs scroll horizontally, and tables scroll inside their own container. The 10-column list is checked at 1280px. Breakpoints: 375 · 768 · 1280. Touch targets inherit the open Mantine 36px button issue from QA; don't work around it here.
- [ ] **1.18 Accessibility pass**:
  - `aria-invalid` + `aria-describedby` on every field error, focus to the first invalid field on save, and the drawer's status summary in a polite live region.
  - The drawer traps focus and returns it to its opener.
  - The type toggle is a labelled radio group with arrow keys, and the phone's dialling code is in its accessible description.
  - Notices and statuses carry words, not colour alone.
  - Contrast AA on existing tokens.

---

# Phase 2 · Sponsorship

Built on phase 1. Its brief carries a *Reconciled with donor-records* note that overrides it where they differed. **Answer that brief's four Open Questions** (renewal period, fit length, needs-decision age, welcome on renewal) **before 2.6 and 2.7.**

## Foundation
- [ ] **2.1 Sponsorship schema**:
  - `scholarships` gains `support_type` (backfilled full/partial), `item_description`, `report_emails_enabled`, `auto_renew`, `decision_reason`, `decision_since`, `renewed_from_id`, `welcome_sent_at` and `welcome_skipped_at`. The status vocabulary already landed in 1.2.
  - New: `programme_settings` (school year 16 May → 31 Mar), the `student_sponsor_eligibility` view, `email_templates` (one default welcome and one default report, seeded) and `sponsorship_welcomes`.
  - `report_email_payload` routes on `active` + `report_emails_enabled` + `wants_email_updates`, returning excluded sponsors with their reasons.

  _New migration. Depends on: 1.2._

## Core UI
- [ ] **2.2 Assign students drawer**: `AssignSponsorDrawer` replaces `AllocationPanel`, in donor mode.
  - The free balance is pinned at the top, and students are grouped *Waiting for a sponsor* / *Already sponsored* with a live `FitLabel`.
  - Greyed rows give their eligibility reason.
  - `SponsorshipFields` rows, and over-allocation blocks saving.
  - Rename the donor Students tab's **Allocate** to **Assign students**. It said Allocate in phase 1 (decided).

  _New: `AssignSponsorDrawer`, `FitLabel`, `SponsorshipFields`. Modifies: `AdminDonorDetailPage`. Depends on: 2.1, 1.10._
- [ ] **2.3 Sponsors on the student**: `SponsorsTab`, `SponsorChips` and `SponsorshipStatusBadge` on the student overview, with assign-from-student mode (a donor picker). `AdminStudentOverviewPage` **stops reading `scholarship_awards`**, which is safe only because 1.3 copied them. `AdminStudentsPage` gets a Sponsors column and filters (*Waiting for a sponsor*, *Needs decision*, *Sponsored*). _New: `SponsorsTab`, `SponsorChips`, `SponsorshipStatusBadge`. Modifies: `AdminStudentOverviewPage`, `AdminStudentsPage`. Depends on: 2.2, 1.3._
- [ ] **2.4 Money-in suggestion**: after a donor or payment is saved, the notification carries **Assign students** when there's free balance and an eligible student waiting. `TodayRail` gets a *Can help N students* item until the money is spent. _Modifies: `DonorFormDrawer`, `ContributionDrawer`, `TodayRail`, `dashboardMetrics.ts`. Depends on: 2.2._
- [ ] **2.5 Email templates**:
  - `EmailTemplatesPage` (Settings → Email templates), grouped by kind. The `FormDrawer` editor has EN · ไทย per field, an *Insert field* menu, and a live preview.
  - `report-email` and `template.ts` render from templates.
  - `EmailPreviewDialog` gets a template and language choice per recipient, with *Changed from …* markers, and a *Not sending to* list with reasons. No-email lines point to *Waiting to send* (1.15).

  _New: `EmailTemplatesPage`. Modifies: `report-email`, `template.ts`, `EmailPreviewDialog`. Depends on: 2.1, 1.14, 1.15._

## Interactions & States
- [ ] **2.6 Welcome a new sponsor**: `WelcomeComposer` inside `EmailPreviewDialog` (template, language, editable description, admin note), with **Send welcome to {donor}** / **Skip welcome** writing `sponsorship_welcomes`, and a `TodayRail` *Send welcome* item. Covers: a missing-language block, skip confirmation, and send failure. _New: `WelcomeComposer`. Depends on: 2.5, 2.2._
- [ ] **2.7 Renewal, endings, Needs decision**:
  - A daily `sponsorship-renewal` edge function (UTC, outside 1–3 AM): auto-renew when the free balance covers the next period, otherwise Needs decision; a 30-day reminder.
  - Archiving a student moves their sponsorships to Needs decision.
  - `NeedsDecisionPanel` offers **Renew** (disabled with the shortfall when short), **Reassign**, **Return to balance** (a `scholarship_releases` row) and **End**, each logged.

  Covers: covered, short, archived, and each resolution. _New: `sponsorship-renewal`, `NeedsDecisionPanel`. Depends on: 2.3._

## Responsive & Polish
- [ ] **2.8 Responsive + accessibility (sponsorship)**: a two-step mobile assign drawer (*Choose students* → *Set details*, focus on each step's heading); the composer stacked above the email; `SponsorsTab` details in an expander on tablet. A grouped listbox with arrow keys and Space, and disabled reasons in the accessible description. One polite live region for balance and fit. Language overrides announced. `lang` set on EN/ไทย fields.

## Review
- [ ] **Design review**: run `/design-review` against both briefs after phase 1, and again after phase 2.
- [ ] **Browser QA**: run `/spartan:qa` on the donor list, overview, drawers and the send dialog, with an admin test account.
