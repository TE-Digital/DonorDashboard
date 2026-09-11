# Design Brief: Assign student to donor (sponsorship)

## Problem

A donor gives iCare money. Somewhere in the programme a child is waiting for exactly that. Every student is in the programme because they need a sponsor, so connecting the two is the core act of the whole platform, and today the platform barely supports it.

**Nobody tells the admin that someone can be helped.** A donor is added, money is recorded, and the product carries on as if nothing happened. To learn that there is unspent money *and* a child who needs it, the admin has to open two screens and compare them in their head.

**"Sponsored" is not a thing the product knows.** `AllocationPanel` writes a `scholarships` row: a donor, a student, an amount, a date range. It says nothing about the kind of support, and nothing about whether this donor wants this child's reports. The student overview does not even read those rows. It reads the retired `scholarship_awards` table and assumes one scholarship per student.

**A new sponsor hears nothing.** After money is assigned, the donor gets no word about who they are now supporting until the next report cycle, which can be up to six months away.

**The report leaves without a voice.** An approved report goes out in one fixed shape. The admin cannot choose the wording, and cannot see or change the language for a particular send.

**Endings are silent.** A sponsorship reaches its end date, or the child leaves school, and nothing prompts anyone to decide what happens to the donor's money or the relationship.

## Solution

One flow, start to finish, where every step is visible and every decision stays with the admin:

1. **Money arrives.** The admin adds the donor and records the payment.
2. **The system suggests who it can help.** Right after saving, the admin sees *"฿60,000 recorded. It fully covers 3 waiting students."* with **Assign students**.
3. **Assign.** The drawer lists unsponsored students first. Each is labelled *Fully covered by this gift* or *Partly covered*, based on their monthly gap over the sponsorship length. The admin searches, ticks one or several, confirms support type, amount and dates, and saves. Only students who are ready to be shown to a donor can be picked. Anyone else is visible but greyed, with the reason.
4. **Welcome.** Each new sponsorship adds *Send welcome* to the admin's queue. The admin opens a preview of a short, warm letter: the child's approved photo, their name, what and where they study, their approved description, and a note from the admin. It closes by saying updates will follow. The admin checks it, picks the language (defaulted to the donor's preference) and sends it.
5. **Reports.** At the end of each Thai semester (see `thai-calendar-and-field-alignment`), the teacher submits and the admin reviews and approves. The approved report goes by email to every active sponsor of that child who has report emails on. The admin chooses a template and confirms each recipient's language.
6. **Renewal and endings.** At the end date, the sponsorship renews automatically if the donor's free balance covers the next period, and the admin is told. If the balance is short, or the child is archived, the sponsorship moves to **Needs decision**: emails pause, the money stays where it is, and the admin decides after talking to the donor.

Money only counts when it is actually allocated to an active sponsorship. Nothing is promised, reserved, or held for later.

## Experience Principles

1. **Only real money, only ready children.** A sponsorship exists only when money is allocated and the child is cleared to be shown to a donor. There are no pledges and no half-states that inflate a balance or email a child's story before the family agreed.
2. **The system suggests; the admin decides.** Matching, renewal and endings all surface a recommendation with the numbers, and none of them silently moves money or ends a relationship. Auto-renew happens only when the balance plainly covers it, and even then the admin is told.
3. **Defaults from the record, choices at the send.** Recipients come from the child's sponsors, and language from each donor's saved preference. Both can be changed for a single send, visibly, per recipient, before anything goes out.

## Aesthetic Direction

- **Philosophy**: Lumen, the existing system, unchanged. No new tokens. Sponsorship moves onto patterns the platform already has: `FormDrawer`, `Tabs` + `DataTable`, `EmailPreviewDialog`, and `TodayRail`.
- **Tone**: Admin side calm and administrative. The welcome email is the warmest thing the product sends: a short letter introducing a child, not a receipt and not a pitch.
- **Reference points**: The add-teacher drawer for the assign panel. Linear's assignee picker for choosing students. Mailchimp's pre-send check for the send step. For the welcome, a handwritten note tucked into a school photo.
- **Anti-references**: Not a child-matching marketplace (no swiping through faces, no "3 children still need you"). Not a fundraising email (no donate-again button, no progress thermometer). Not a CRM automation builder: templates are letters with a few placeholders.

## Existing Patterns

- **Typography**: `--font-core` Figtree, with Noto Sans Thai for Thai. `--fs-h1` 24px down to `--fs-xs` 12px. Money uses tabular figures.
- **Colors**: `--action-primary` (`--blue-500`) for the one primary action per region. States reuse `success / info / warning / danger / neutral`: **Active = success, Needs decision = warning, Ended = neutral**. `CoverageBar` tones are unchanged.
- **Spacing and radius**: 4px base, a single `--radius` of 8px, and `--radius-pill` for chips.
- **No field subtext**: helper text under labels is hidden platform-wide. Reasons go into `Badge` + `Tooltip` or `InlineMessage`.
- **Drawer contract**: `FormDrawer` with `EntityFormHandle` / `EntityFormOwnerProps`.
- **Readiness gates already modelled**: `students.status` (`enrolled | archived`), `consent_status`, and `donor_profile_status`, with `CONSENT_META`, `DONOR_PROFILE_META` and `sendBlockedReason` in `studentProfile.ts`. Eligibility reuses `sendBlockedReason`; there is no second rule.
- **Donor card already built**: `DonorProfileTab` holds `donor_display_name`, `donor_description` (420 chars) and `donor_photo_path`, which are deliberately separate from the internal record. The welcome email reads **only these three fields plus school and grade level**, and never the bio, guardian, phone, village or address.
- **Money already built**: `donor_contributions`, the `donor_balance` view (given − **active** scholarships), `student_coverage`, `student_donors`, `scholarship_releases`, `AllocationPanel` (gap ranking, live remaining balance, multi-student commit), `CoverageBar`, and `donorMoney.ts`.
- **Report cycle**: today `reportingCycle.ts` uses Jan–Jun / Jul–Dec. The `thai-calendar-and-field-alignment` brief replaces this with two Thai semesters per school year and retires `schools.reporting_period_months`. This brief assumes the semester model.
- **Donor card is bilingual** per the same brief: `donor_display_name(_th)` and `donor_description(_th)`. The welcome reads the recipient's language and is blocked if it is missing.
- **Send already built**: `ReportVerifyPage` → `EmailPreviewDialog` (switcher for recipients in different languages, blocked when a language is missing), the `report-email` function, `report_email_payload`, `term_updates.sent_to`, and `donors.preferred_language`. The email brief's rule stands: **no machine translation and no silent fallback to the other language.**
- **Nudge surface**: `TodayRail` with its existing `allocate` item kind. There is no new notification system.
- **Activity log**: `studentEvents.ts` `logEvent`.

## Data Model Changes

Following `SCHEMA.md` (TEXT, TIMESTAMPTZ, no new FKs).

- **`scholarships` is the sponsorship.** There is no second table. It gains:
  - `support_type` TEXT: `'full' | 'partial' | 'specific_item'`. Existing rows are backfilled as `full` where `monthly_amount_thb >= monthly_support_expected`, and `partial` otherwise.
  - `item_description` TEXT, used only for `specific_item`.
  - `report_emails_enabled` BOOLEAN, default `true`.
  - `auto_renew` BOOLEAN, default `true`.
  - `decision_reason` TEXT: `'student_archived' | 'renewal_short' | 'graduated'`, set while status is `needs_decision`. `graduated` comes from the calendar brief's 31 March graduation job.
  - `decision_since` TIMESTAMPTZ.
  - `renewed_from_id` UUID, which links a renewal to the period before it, so history reads as a chain.
  - `welcome_sent_at` TIMESTAMPTZ and `welcome_skipped_at` TIMESTAMPTZ.
- **Status vocabulary**: `active | needs_decision | ended`. `inactive` migrates to `ended`, and the check constraint is replaced. **There is no pending state.**
- **Money**: `donor_balance.committed` counts `active` **and** `needs_decision`. The money stays allocated until the admin decides, because returning it silently is a decision too. `student_coverage` counts `active` only.
- **`programme_settings` (new, single row)**: `school_year_start` TEXT (`'05-16'`) and `school_year_end` TEXT (`'03-31'`), the Thai academic year, stored as month-day so the organisation can change it without a deploy. Semester dates and per-school overrides are defined in the `thai-calendar-and-field-alignment` brief, so one sponsorship year = one school year = two semester reports.
- **`student_sponsor_eligibility` (view)**: `is_eligible` and `missing_gates text[]` (`archived`, `consent_pending`, `consent_declined`, `profile_unpublished`). It drives the picker and the "Waiting for a sponsor" filter. There is no `accepting_donations` column: every enrolled student is in the programme to be sponsored.
- **Renewal job** (a scheduled edge function, daily, UTC, outside the 1–3 AM window): for each `active` sponsorship with `auto_renew` whose `coverage_end` is today or earlier:
  - **Free balance ≥ next period's amount** → end the current row, insert a renewed row covering the **next full school year** (16 May → 31 Mar), with the same monthly amount, support type and toggles, and `renewed_from_id`, and log it. A `TodayRail` info item reports *"Renewed: Mali, sponsored by Khun Somchai, to 31 Mar 2028."*
  - **Balance short** → `needs_decision` with `decision_reason = 'renewal_short'`, and a `TodayRail` warning: *"Couldn't renew Mali: Khun Somchai is ฿8,400 short."*
  - A reminder item also appears **30 days before** `coverage_end`, so the admin can contact the donor before a shortfall happens.
- **Archive hook**: archiving a student moves all their active sponsorships to `needs_decision` with `decision_reason = 'student_archived'`, and a `TodayRail` warning per sponsor.
- **Resolving Needs decision** writes one of these, each logged:
  - **Renew**: only when the balance now covers it, typically after a payment was recorded.
  - **Reassign**: end this sponsorship and open the assign drawer, pre-filled with the unspent remainder, on the same donor.
  - **Return to balance**: end the sponsorship and write a `scholarship_releases` row, so the money becomes free.
  - **End**: same as return, with a reason such as "donor withdrew".
- **`email_templates` (new)**:
  - `id`, `kind` (`'welcome' | 'report'`), `name`, `description`.
  - `subject_en/th`, `intro_en/th`, `closing_en/th`.
  - `is_default` (one per kind), plus timestamps and `deleted_at`.
  - For **report** templates, the report block (photo, grade, teacher's comment) is always inserted by the system between intro and closing, so a template cannot drop or rewrite the report.
  - For **welcome** templates, the student block (photo, display name, school, grade level, donor description, admin note) is inserted instead.
  - Placeholders: `{donor_name}`, `{student_name}`, `{school_name}`, `{grade_level}`, `{report_period}`, `{organisation}`.
  - The migration seeds one default of each kind. The welcome default's closing says updates will follow at the end of each semester.
- **`sponsorship_welcomes` (new)**: `scholarship_id`, `donor_id`, `student_id`, `template_id`, `language`, `description_text` (as edited for this email), `admin_note`, `sent_at`, `send_error`. Edits here never change `students.donor_description`.
- **`term_updates.sent_to`** entries gain `template_id` and the `language` actually sent.
- **Routing**: `report_email_payload` recipients are every sponsorship with `status = 'active'`, `report_emails_enabled`, donor `wants_email_updates` on (null counts as on), and an email present. `needs_decision`, ended, emails-off, opted-out and no-email sponsors come back with an `excluded_reason`. **Emails never mention a child's other sponsors.**
- **Supersedes**: `AdminStudentOverviewPage` stops reading `scholarship_awards`. The funding brief's allowance of several donors per student is confirmed.
- **Reconciled with `donor-records-and-payments` (2026-09-11).** That brief is built first, and these points override anything above:
  - **Report opt-out is the existing `donors.wants_email_updates`**, relabelled *Send report emails*. There's no `email_opt_out` column. Migration `20260911090000_report_recipients_email_pref.sql` already filters `report_email_payload` on it.
  - **Old `scholarship_awards` history is copied into `scholarships`** by that brief's awards migration, which must run before `AdminStudentOverviewPage` stops reading awards. Otherwise every student's funding history disappears.
  - **`donor_balance` is re-created once**, combining this brief's committed rule (`active` + `needs_decision`) with that brief's `last_received_on`, not in two competing migrations.
  - **The donor Students tab says *Allocate*** (the existing `AllocationPanel`) until this brief's `AssignSponsorDrawer` replaces it and renames it *Assign students*.
  - **The send dialog gains *Add recipients*** (extra one-off addresses, each with EN · ไทย, default English) and an inline *Add their address* for sponsors with no email, as specified in the email brief. This brief's *Not sending to* list still names every excluded sponsor with its reason, and a no-email sponsor whose box is left empty is also kept as a draft in *Waiting to send*.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| `AssignSponsorDrawer` | New (evolves `AllocationPanel`) | Two modes. **From donor**: free balance pinned at the top, then students grouped as *Waiting for a sponsor* then *Already sponsored* (collapsed), each with a `FitLabel`, search, and multi-select, plus one `SponsorshipFields` row per selection. **From student**: a donor picker showing free balance, then one row. Ineligible students are greyed with the reason and cannot be ticked. `AllocationPanel` retires. |
| `FitLabel` | New | Judged by how many months the money covers, not a fixed 12. Months covered = remaining free balance ÷ student's monthly gap, counted up to the end of the current school year. It reads *Fully covered to 31 Mar* (success) when the money reaches the school-year end, and *Covers 5 of 8 months* (warning) when it runs out sooner. Recomputed live as rows are added, because each selection spends balance the next one can't use. |
| `SponsorshipFields` | New | Support type (segmented), monthly amount (hidden for specific item), one-off amount + item description, start and end dates, report emails toggle, auto-renew toggle. |
| `SponsorshipStatusBadge` | New | Active / Needs decision / Ended. Needs decision carries its reason in words. |
| `NeedsDecisionPanel` | New | Opens from a `TodayRail` item or a Sponsors row. States what happened, shows donor, student, remaining amount and balance, then offers four actions: **Renew** (disabled with a reason when short), **Reassign to another student**, **Return to donor's balance**, **End sponsorship**. A `Dialog` confirms, naming the amount and people. |
| `SponsorsTab` | New | On the admin student overview: `DataTable` of sponsorships (donor, support type, amount, dates, status, emails, auto-renew, welcome sent). Row actions: edit, toggle emails, toggle auto-renew, send welcome, end. Primary action: *Assign sponsor*. |
| `SponsorChips` | New | Active sponsor names, compact. Used in the student overview header and the directory column. |
| `WelcomeComposer` | New (inside `EmailPreviewDialog`) | Template (welcome kind), language (default = donor preference, with a *Changed from English* marker), donor description (prefilled from the approved card, editable here only), admin note (optional). A live preview sits beside it. The photo, name, school and grade are read-only. |
| `AdminStudentOverviewPage` | Modify | The legacy scholarship KPI becomes "Sponsors: 2 active" (or "Waiting for a sponsor" in warning tone) and links to `SponsorsTab`. It stops reading `scholarship_awards`. |
| `AdminStudentsPage` | Modify | Adds a *Sponsors* column and filters: *Waiting for a sponsor*, *Needs decision*, *Sponsored*. |
| `AdminDonorDetailPage` (Students tab) | Modify | Lists this donor's sponsorships with status. *Assign students* opens the drawer in donor mode. |
| `AdminDonorsPage` / `DonorFormDrawer` / `ContributionDrawer` | Modify | The post-save notification carries **Assign students** when free balance > 0 and at least one eligible student is waiting. |
| `TodayRail` + `dashboardMetrics.ts` | Modify | New items: *Can help N students* (allocate), *Send welcome* (per new sponsorship), *Ends in 30 days*, *Renewed* (info), *Needs decision* (warning, until resolved). **Escalation**: after 30 days unresolved, the item turns danger tone, moves to the top of the rail, and is counted on the admin dashboard (*"3 sponsorships waiting over 30 days"*), because that child's reports are not reaching anyone in the meantime. Each opens the screen that owns the work. |
| `EmailTemplatesPage` | New | Settings → Email templates. The list is grouped by kind. The `FormDrawer` editor has an EN · ไทย tablist per field, an *Insert field* menu, and a live preview with a sample student. Soft delete. A kind's default cannot be deleted. |
| `EmailPreviewDialog` | Modify | Report send: per recipient **Template** (report kind) + **Language** (default = preference, override marked), an excluded list with reasons, and recipients can be unticked. Send is blocked if any ticked recipient's chosen language has empty text. Welcome send hosts `WelcomeComposer`. |
| `report-email` function + `template.ts` | Modify | Renders both kinds from `email_templates`, per-recipient template + language, escaped placeholders. Welcome mode reads only the donor-card fields, school and grade. |
| `sponsorship-renewal` function | New | The daily renewal/reminder job described in Data Model Changes. |
| `TeacherStudentDetailPage` | Unchanged | Teachers see no sponsorship information. |
| `FormDrawer`, `DataTable`, `Badge`, `Tooltip`, `Dialog`, `InlineMessage`, `KpiRow`, `Tabs`, `EmptyState`, `CoverageBar` | Exist | Used as-is. |

## Key Interactions

**Money in → suggestion.** The admin records ฿60,000 from Khun Somchai. The notification reads *"฿60,000 recorded. It fully covers 3 waiting students."* with **Assign students**. If ignored, a `TodayRail` item keeps it visible until the free balance is spent or nobody eligible is waiting. The item only appears when the balance covers at least one waiting student's smallest monthly gap, so a balance too small to help anyone does not keep reminding. A new donor with no payment does not trigger it.

**Assigning (from a donor).**
1. The drawer opens with the free balance pinned. *Waiting for a sponsor* is ranked by best fit, then by gap.
2. Each row shows name, school, grade, need, and `FitLabel`. A greyed row reads, for example, *"Not ready: waiting on family consent"*, with a link to that student's Donor profile tab.
3. Ticking a student adds a `SponsorshipFields` row with these defaults:
   - Support type: **Full** if the gift covers the gap, **Partial** otherwise.
   - Amount: the gap.
   - Dates: today → the end of the current school year (31 Mar). When the gift can't reach that far, the end date defaults to the last month it fully pays for, and the row says so: *"Money covers to 31 Oct. Renewal will need a new payment."*
   - Report emails and auto-renew: on.
4. The remaining balance and every `FitLabel` update live. Going over is shown in danger tone (*Over-allocated by ฿4,200*) and blocks save: there is no promised money.
5. The footer button is **Assign 3 students**. On save, the sponsorships are active, the Students tab highlights them, and each gets a `TodayRail` *Send welcome* item plus an activity entry.

**Assigning (from a student).** *Assign sponsor* on `SponsorsTab` opens a donor picker, with donors that have free balance first, each showing "฿X free · covers this student fully/partly". The admin picks one donor and fills one row.

**Welcoming a new sponsor.**
1. *Send welcome* opens `EmailPreviewDialog` in welcome mode for that one donor.
2. The left side is `WelcomeComposer`:
   - Template: the welcome default, preselected.
   - Language: the donor's preference, preselected.
   - Description: prefilled from the approved card and editable.
   - Admin note: empty.
3. The right side is the email at phone width: greeting, the child's photo, display name, *"Grade 5 at Ban Huai School"*, the description, the admin's note, and the closing (*"You'll hear how Mali is doing at the end of each semester."*).
4. The button reads **Send welcome to Khun Somchai**. On success, it stamps `welcome_sent_at` and clears the `TodayRail` item.
5. **Skip welcome** is a quiet secondary action that asks for confirmation and stamps `welcome_skipped_at`. Use it when the admin has already spoken to the donor.
6. If the chosen language's description is empty (for example, a Thai donor and an English-only description), send is blocked with the existing message until the text is written.

**Sending a report (each semester).**
1. The teacher submits. The admin reviews on `ReportVerifyPage` and presses *Approve & send*.
2. `EmailPreviewDialog` lists each active sponsor with emails on, and for each: **Template** (report default preselected) and **Language** (preference preselected; an override shows *Changed from Thai*).
3. Below the list, under *Not sending to*: sponsors in Needs decision, with emails off, opted out, or without an email, each with its reason.
4. The button reads **Send to Khun Somchai and 1 other**. `sent_to` records the template and language per person.

**Renewal.** Thirty days before an end date, a reminder appears in `TodayRail`. On the end date:
- **Covered** → the sponsorship renews silently and an info item reports it.
- **Short** → Needs decision: *"Couldn't renew Mali: Khun Somchai is ฿8,400 short."* Emails for this sponsorship pause. The admin contacts the donor, then in `NeedsDecisionPanel` records the payment and **Renews**, **Reassigns** the child to another donor, or **Ends** it.

**Student archived.** Archiving a sponsored student puts each of their sponsorships into Needs decision (*"Mali has left the programme"*). Emails stop at once, and the money stays allocated. For each donor, the admin chooses:
- **Return to balance**: the remainder becomes free money and shows as a release row in the ledger.
- **Reassign**: the drawer opens on that donor, pre-filled with the remainder, and lists waiting students.

**Turning report emails off.** An inline toggle in `SponsorsTab`. The sponsor stays a sponsor; they simply stop receiving this child's reports and are listed as excluded at send.

**Managing templates.** In Settings → Email templates, *New template* asks for the kind first (Welcome or Report), then name, then Subject / Opening / Closing, each with EN · ไทย and a *Missing* marker. A template missing a language can be saved but cannot be chosen for a recipient in that language; the picker shows why.

## Responsive Behavior

- **Desktop (≥1024px)**: the drawer is 880px, with the list above the selected rows. `NeedsDecisionPanel` is a 560px drawer. `EmailPreviewDialog` puts the controls or `WelcomeComposer` beside a 375px email frame.
- **Tablet (641–1023px)**: the drawer is full width minus a gutter, and `SponsorshipFields` wraps to two lines. In `SponsorsTab`, emails, auto-renew and welcome move into a row expander.
- **Mobile (≤640px)**: the drawer is full-screen as two steps, *Choose students (3)* → *Set details*. `SponsorChips` becomes a count. The preview dialog stacks the composer above the email, with a *Preview* tab. `NeedsDecisionPanel` is full-screen, with the actions stacked and the primary one last and pinned.

## Accessibility Requirements

- WCAG 2.1 AA using existing tokens. Status, fit, eligibility and decision reasons **always carry words**, never tone alone.
- The student list is a grouped listbox: arrow keys, Space toggles, group labels announced, and a disabled option's reason in its accessible description.
- The remaining balance and `FitLabel` changes are announced through one `aria-live="polite"` region, not one per row.
- Language overrides are announced ("Language: Thai, changed from English"). The excluded list is a real list with reasons as text.
- `NeedsDecisionPanel` has its heading as the accessible name. The disabled *Renew* states why ("Khun Somchai is 8,400 baht short"). Confirm dialogs trap focus, name people and amounts, and return focus on cancel.
- In `WelcomeComposer`, the editable description and note are labelled fields with `lang` set to the chosen language. The preview iframe carries a title.
- Template editor: `lang` on each EN/ไทย field, keyboard-operable placeholder menu, placeholders announced by name.
- The two-step mobile drawer moves focus to each step's heading.

## Out of Scope

- **Pledges or promised money.** No pending sponsorships and no reserved balance. Money counts only when allocated.
- **Campaigns.** No campaign entity or campaign-tagged gifts.
- **Donor self-selection** and the donor portal. Donors receive emails; they do not log in to choose or view.
- **Teacher visibility** of sponsorship.
- **Excerpts from past reports in the welcome.** The welcome introduces the child; progress arrives in the reports.
- **Mentioning other sponsors** in any email.
- **Email to staff.** All admin notifications are in-app (post-save notification and `TodayRail`).
- **Template logic** beyond placeholders: no conditions, scheduling, attachments, or per-sponsorship default template.
- **Machine translation.**
- **Contacting donors from the platform** about shortfalls. The admin reaches out by their own means; the platform records the outcome.
- **Currency.** Sponsorship amounts stay THB.

## Decided After Grilling

- **Renewals follow the school year**: the Thai academic year, 16 May → 31 Mar, set once in `programme_settings`.
- **"Fully covered" depends on the amount**: it is measured in months the money pays for, up to the school-year end, not a fixed 12 months.
- **Needs decision escalates** after 30 days unresolved.
- **Welcome emails**: none on renewal. A new donor–student pairing, including a reassignment to a new child, gets a welcome.

## Open Questions

1. **The April → mid-May break.** The school year ends 31 Mar and the next starts 16 May. Assumed: the renewal runs on 31 Mar and the new period starts 16 May, with no money counted for the six-week break. Confirm that iCare does not support students through the holiday.
2. **Mid-year starts.** A sponsorship assigned in, say, October runs only to 31 Mar before its first renewal. Assumed this is fine, and that renewal then moves it onto full school years.

