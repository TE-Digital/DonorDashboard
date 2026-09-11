# Build Tasks: Assign student to donor (sponsorship)

Generated from: design/donor-sponsorship/DESIGN_BRIEF.md
Date: 2026-09-11

Visual direction for every task: **Lumen, unchanged** — no new tokens, calm administrative tone. The welcome email is the one warm surface. States reuse existing tones: **Active = success, Needs decision = warning, Ended = neutral**. All user-facing words follow `docs/VOICE.md`.

Conventions: PascalCase components in `src/modules/<area>/` with SCSS modules, migrations in `supabase/migrations/`, and edge functions in `supabase/functions/<name>/`. There are no test files yet (Playwright is installed, no specs). Each task passes when `npm run build` succeeds and its **Verify** checks hold by hand.

## Before starting — blocking work in other task lists

- [ ] **Donor records brief, awards migration**: `scholarship_awards` history must be copied into `scholarships` before any task below stops reading awards, or every student's funding history disappears. _From `design/donor-records-and-payments`._
- [ ] **Donor records brief, donor overview tabs**: `AdminDonorDetailPage` gains Overview / Payments / Students tabs. The Students tab keeps *Allocate* (`AllocationPanel`) until "Assign from a donor" below replaces it. _From `design/donor-records-and-payments`._
- [ ] **Calendar brief, settings foundation**: `programme_settings` and the `school_years` view exist, because dates, fit and renewal all read them. _From `design/thai-calendar-and-field-alignment`, first task._
- [ ] **Calendar brief, bilingual donor card**: `donor_display_name_th` / `donor_description_th`, which the welcome email needs. _From `design/thai-calendar-and-field-alignment`._
- [ ] **Coordinate on `EmailPreviewDialog`**: it has uncommitted edits in the working tree (`git status`), and the email brief's *Add recipients* is also going into it. Land or rebase those before "Report send" and "Welcome email" below.

## Foundation

- [ ] **Sponsorship data and status badge**: One migration:
  - Adds to `scholarships`: `support_type`, `item_description`, `report_emails_enabled`, `auto_renew`, `decision_reason` (`student_archived | renewal_short | graduated`), `decision_since`, `renewed_from_id`, `welcome_sent_at`, `welcome_skipped_at`.
  - Replaces the status check with `active | needs_decision | ended`, migrating `inactive` to `ended`.
  - Backfills `support_type` from `monthly_amount_thb` against need.
  - Re-creates `donor_balance` **once**, combining committed = `active` + `needs_decision` with the records brief's `last_received_on`.
  - Adds the `student_sponsor_eligibility` view (`is_eligible`, `missing_gates`).

  Build `SponsorshipStatusBadge` (label always in words; Needs decision shows its reason) and use it on the donor page's existing Students list. **Verify**: existing rows read Active or Ended, a donor's free balance is unchanged for active rows, and the eligibility view returns the right missing gates for one archived, one consent-pending and one unpublished student. _New component. Reuses: `Badge`, `Tooltip`._

- [ ] **Sponsors on the student overview**: Add `SponsorsTab` to `AdminStudentOverviewPage`: a `DataTable` of every sponsorship (donor, support type, monthly amount, dates, status, emails, auto-renew, welcome sent), read-only for now, with an *Assign sponsor* primary action. Replace the legacy one-scholarship KPI with "Sponsors: 2 active", or "Waiting for a sponsor" in warning tone, linking to the tab. Add `SponsorChips` to the header. Remove the `scholarship_awards` reads from this page. **Verify**: a student with two active sponsors shows both on the tab and in the header; a student with none shows the warning KPI; no `scholarship_awards` query remains in the page. _New: `SponsorsTab`, `SponsorChips`. Modifies: `AdminStudentOverviewPage`. Depends on: Sponsorship data and status badge, and the records-brief awards migration._

## Core UI

- [ ] **Assign from a donor** _(highest risk, so it comes first in Core UI)_: Evolve `AllocationPanel` into `AssignSponsorDrawer` in donor mode.
  - Free balance pinned at the top.
  - The student list is a grouped listbox: *Waiting for a sponsor*, ranked by best fit then gap, then *Already sponsored*, collapsed. It has search.
  - Ineligible students are greyed out, with *"Not ready: waiting on family consent"* and a link to their Donor profile tab.
  - Each ticked student adds a `SponsorshipFields` row. Defaults: Full if covered, otherwise Partial; amount = gap; dates today → school-year end, or the last fully paid month with *"Money covers to 31 Oct. Renewal will need a new payment."*; emails and auto-renew on.
  - `FitLabel` (*Fully covered to 31 Mar* / *Covers 5 of 8 months*) and the remaining balance recompute live through one `aria-live` region. Over-allocation shows in danger tone and blocks save.
  - The footer reads **Assign 3 students**. Saving writes active sponsorships and `student_events`.

  The donor Students tab's *Allocate* becomes *Assign students*, and `AllocationPanel` is deleted. **Verify**: with ฿60,000 free, ticking students reduces the balance and relabels later rows' fit; going over disables save; ineligible students can't be ticked; saved rows appear active on both the donor and student pages. _New: `AssignSponsorDrawer`, `SponsorshipFields`, `FitLabel`. Reuses: `FormDrawer`, `CoverageBar`, `donorMoney.ts`. Retires: `AllocationPanel`. Depends on: Sponsorship data and status badge._

- [ ] **Assign from a student**: Student mode of the same drawer, opened from *Assign sponsor* on `SponsorsTab`. A donor picker (search by name or email) lists donors with free balance first, each showing *"฿X free · covers this student fully/partly"*, then one `SponsorshipFields` row. **Verify**: assigning from the student creates the same row as from the donor, and donors with no free balance appear last and can't cover anything. _Modifies: `AssignSponsorDrawer`, `SponsorsTab`. Depends on: Assign from a donor._

- [ ] **Sponsorship row actions**: In `SponsorsTab` and the donor Students tab, add row actions:
  - **Edit** (opens `SponsorshipFields` in the drawer).
  - Inline **Reports for this student** and **Auto-renew** toggles. Reports is disabled with *"Donor has turned off all report emails"* when `wants_email_updates` is off.
  - **End sponsorship**: a `Dialog` naming donor, student and date, with a required reason. It writes a `scholarship_releases` row for the unspent remainder.

  **Verify**: ending returns the remainder to the donor's free balance as a release row; toggles persist; the reports toggle is disabled for an opted-out donor. _Modifies: `SponsorsTab`, `AdminDonorDetailPage`. Reuses: `Dialog`, `ContributionsTable` (release rows). Depends on: Sponsors on the student overview._

- [ ] **Students directory: sponsors column and filters**: `AdminStudentsPage` gains a *Sponsors* column (`SponsorChips`, or "None yet" in warning tone) and filters *Waiting for a sponsor* (eligible and unsponsored), *Needs decision* and *Sponsored*, readable from the URL (`?sponsor=none`). **Verify**: each filter returns the right students, and the URL filter survives reload. _Modifies: `AdminStudentsPage`. Reuses: `SponsorChips`, `FilterBar`._

- [ ] **"Can help N students" nudges**: After *Record payment* (and *Create donor*, when it includes money), the success notification carries **Assign students** when the free balance covers at least one waiting student's smallest monthly gap: *"฿60,000 recorded. It fully covers 3 waiting students."* It opens the drawer on that donor. `dashboardMetrics.ts` adds an `allocate` `TodayRail` item per such donor, which clears when the balance is spent or nobody eligible is waiting. **Verify**: a payment too small to cover anyone produces no nudge; spending the balance clears the rail item. _Modifies: `ContributionDrawer`, donor create flow, `dashboardMetrics.ts`, `TodayRail`. Depends on: Assign from a donor._

- [ ] **Email template library**: Migration creates `email_templates` (`kind` welcome/report, EN/TH subject, intro and closing, `is_default` per kind, soft delete) and seeds one default of each. The report default comes from today's hard-coded copy; the welcome default's closing says updates follow each semester. Build `EmailTemplatesPage` under Settings: a list grouped by kind, and a `FormDrawer` editor with an EN · ไทย tablist per field, a *Missing* marker, an *Insert field* menu (`{donor_name}`, `{student_name}`, `{school_name}`, `{grade_level}`, `{report_period}`, `{organisation}`) and a live preview with a sample student. A kind's default can't be deleted. **Verify**: create, edit and soft-delete a template; the preview substitutes placeholders; a template missing Thai saves but is marked. _New page. Reuses: `FormDrawer`, `BilingualField` (from the calendar list), `DataTable`._

- [ ] **Welcome email**: Migration creates `sponsorship_welcomes`. `EmailPreviewDialog` gains a welcome mode hosting `WelcomeComposer`:
  - **Template** (welcome kind).
  - **Language** (the donor's preference, with a *Changed from English* marker).
  - **Description**, prefilled from the approved donor card in that language and editable for this email only.
  - Optional **admin note**.
  - Read-only photo, name, school and grade.

  `report-email` gains welcome mode and reads only donor-card fields, school and grade. **Send welcome to Khun Somchai** stamps `welcome_sent_at`; **Skip welcome** (confirm) stamps `welcome_skipped_at`. Both clear the *Send welcome* `TodayRail` item that every new pairing creates (renewals do not; reassignment to a new child does). A missing language blocks the send with the named reason. **Verify**: the preview shows no village, guardian or phone; editing the description does not change `students.donor_description`; a Thai donor with no Thai description is blocked. _New: `WelcomeComposer`. Modifies: `EmailPreviewDialog`, `report-email` function + `template.ts`, `dashboardMetrics.ts`. Depends on: Email template library, and the calendar-list bilingual donor card._

- [ ] **Report send: template, language and exclusions**: In report mode, `EmailPreviewDialog` gives each ticked recipient a **Template** (report kind) and **Language** select (preference default, override marked *Changed from Thai*), and recipients can be unticked. `report_email_payload` requires `status = 'active'`, `report_emails_enabled`, `wants_email_updates` and an email, and returns `excluded_reason` for the rest. These are listed under *Not sending to*, alongside the email brief's *Add recipients* and *Waiting to send*. `sent_to` records `template_id` and `language` per person. The primary button names the people. **Verify**: a Needs decision sponsor and an emails-off sponsor both appear under *Not sending to* with reasons; overriding one recipient's language changes only their preview; `sent_to` holds the chosen template and language. _Modifies: `EmailPreviewDialog`, `ReportVerifyPage`, `report-email`, the payload view migration. Depends on: Email template library, and the EmailPreviewDialog coordination prerequisite._

- [ ] **Needs decision: archive, graduation and the panel**: Build `NeedsDecisionPanel` (560px drawer). It states what happened, shows donor, student, remaining amount and free balance, and offers **Renew** (disabled with *"Khun Somchai is ฿8,400 short"*), **Reassign to another student** (opens `AssignSponsorDrawer` on the donor, pre-filled with the remainder), **Return to donor's balance**, and **End sponsorship**, each confirmed in a `Dialog` that names amounts and people. The archive hook moves a student's active sponsorships to `needs_decision` / `student_archived`, and emails stop at once; the calendar list's graduation job uses `graduated`. A `TodayRail` warning per sponsorship escalates to danger after 30 days unresolved, with a dashboard count *"3 sponsorships waiting over 30 days"*. **Verify**: archiving a sponsored student creates one decision per sponsor; each of the four actions leaves the balance and ledger correct; a 31-day-old decision shows in danger tone and in the count. _New component. Modifies: archive flow in `AdminStudentOverviewPage`, `dashboardMetrics.ts`, `TodayRail`. Depends on: Assign from a donor, Sponsorship row actions._

- [ ] **Renewal job**: A scheduled edge function, `sponsorship-renewal` (daily, UTC, outside 1–3 AM):
  - 30 days before `coverage_end`, a reminder item appears.
  - On `coverage_end`, with `auto_renew` and a free balance that covers the next school year: end the row, insert the renewal (16 May → 31 Mar, same terms, `renewed_from_id`) and add an info item *"Renewed: Mali, sponsored by Khun Somchai, to 31 Mar 2028."*
  - Otherwise: `needs_decision` / `renewal_short`.
  - Renewals never send a welcome.

  **Verify**: run it against fixed dates for three cases — covered (renews), short (Needs decision) and 30 days out (reminder) — and check the balance after each. _New edge function. Reuses: `school_years` view, `donor_balance`. Depends on: Needs decision task._

## Interactions & States

- [ ] **States on every new surface**: Covers loading, empty, error and success.
  - Drawer: no eligible students (*"Everyone waiting is already sponsored"*), no free balance, save error (keeps the selections).
  - `SponsorsTab`: no sponsors yet.
  - Templates page: only defaults.
  - Welcome: already sent (shows the date), send error kept as `send_error` with *Retry*.
  - Report send: nobody to send to.
  - `NeedsDecisionPanel`: resolved elsewhere while open (shows the current state).
  - Renewal: a failed run surfaces as a `TodayRail` error item rather than disappearing.

  _Modifies: all new components above._

## Responsive & Polish

- [ ] **Responsive pass**:
  - Drawer: 880px on desktop; full width with two-line `SponsorshipFields` on tablet; on mobile, full-screen in two steps, *Choose students (3)* → *Set details*, with focus moving to each step heading.
  - `SponsorsTab`: emails, auto-renew and welcome move into a row expander on tablet.
  - `SponsorChips` becomes a count on mobile.
  - `EmailPreviewDialog`: controls beside the 375px frame on desktop, stacked with a *Preview* tab on mobile.
  - `NeedsDecisionPanel`: full-screen on mobile, primary action pinned last.

  Breakpoints: ≥1024px, 641–1023px, ≤640px.

- [ ] **Accessibility pass**:
  - Grouped listbox with arrow keys and Space, group labels announced, and a disabled option's reason in its description.
  - One polite live region for balance and fit.
  - Status, fit, eligibility and decision reasons always in words.
  - Language overrides announced ("Language: Thai, changed from English").
  - The excluded list is a real list.
  - Disabled *Renew* states why.
  - Confirm dialogs trap focus, name people and amounts, and return focus on cancel.
  - `lang` on the `WelcomeComposer` fields and on each template-editor language field; placeholders announced by name.
  - The preview iframe has a title.

  WCAG 2.1 AA with existing tokens.

- [ ] **Copy review**: Run the `copy-reviewer` agent over every new string (drawer, fit labels, nudges, decision panel, welcome and report dialogs, template defaults in both languages) against `docs/VOICE.md`, and check English–Thai parity.

## Review

- [ ] **Design review**: Run /design-review against `design/donor-sponsorship/DESIGN_BRIEF.md`.
