# Design Brief: Donor records and payments

## Problem

Adding a donor is the one record in the admin that still takes you off the page. A student or a teacher opens in a side panel over whatever you were looking at, validates as you go, and drops you back where you were. A donor sends you to a separate `/admin/donors/new` screen, then on save bounces you to a second, 800-line edit page, which is a different form with its own copy of the same fields.

The form also can't hold the donor iCare actually has. Many are companies and foundations, but the form treats everyone as a person. It has no country field. It rejects any phone number that isn't Thai, which is most overseas donors. It lets you save a donor with no email address, although email is the only way a report ever reaches them.

When money arrives there's nowhere natural to record it, and nowhere to see it afterwards. There's no donor overview in the shape the admin already knows from students and teachers: who this is, what they've given, what's still unallocated, and who they fund.

## Solution

Adding or editing a donor becomes the same side panel as a student or teacher, with the same width, sections, pinned action bar, and inline validation that marks every problem field at once and focuses the first. The panel opens by asking one question, individual or organisation, and the rest of the form reshapes to fit. An organisation gets a name and a contact person to address reports to. Country comes before phone, so the phone field already knows the dialling code.

Every donor gets an overview page shaped like a teacher's: a header with the name and a type badge, a row of four money figures, and three tabs (Overview, Payments, Students). **Record payment** opens its own side panel with the fields the funding work already built (amount in THB, date received, method, reference and note), renamed from *contribution* to *payment*.

## Experience Principles

1. **One form, wherever you are.** Add and edit use the same drawer, the same fields, and the same validation as students and teachers. An admin who can add a teacher can add a donor without learning anything new.
2. **Catch it at the field, not the inbox.** Every rule that decides whether a report can reach this person (email present, email well-formed, no duplicate donor, phone dialable) is checked before save, on the field it's about, in a sentence that says how to fix it.
3. **Record money once, in one currency.** Every payment is entered in Thai baht, the currency balances, scholarships and allocation already use. One figure per payment means the ledger, the balance and the bank statement can be compared line by line.

## Aesthetic Direction

- **Philosophy**: Lumen, the existing system, unchanged. This feature adds no tokens and no new visual language; it moves the donor record onto patterns the teacher and student records already established.
- **Tone**: Calm and administrative. Recording a payment is routine bookkeeping, not a celebration. Nothing raises its voice except a validation error, and an unallocated balance, which already speaks through `DonorBalanceCard`.
- **Reference points**: The add-teacher drawer (`TeacherFormDrawer`) for the panel. `AdminTeacherOverviewPage` for the overview: header, `KpiRow`, `Tabs`, and field-grid sections.
- **Anti-references**: Not a CRM contact card with fifteen empty social-media fields. Not a second, visually different donor form living alongside the student and teacher ones.

## Existing Patterns

- **Typography**: `--font-core` is Figtree, with Noto Sans Thai for Thai script, one family throughout. `--fs-h1` 24px, `--fs-h2` 19px, `--fs-h3` 16px, `--fs-body` 14px, `--fs-xs` 12px. Money uses tabular figures so THB columns line up.
- **Colors**: `--action-primary` `--blue-500` is the only blue, used for the one primary action per region. `--bg-app` `#f6f5f2`, `--surface-card` white, `--text-heading` / `--text-body` / `--text-muted`, `--border-subtle`. States use the existing `success / info / warning / danger / neutral` tones. No new colors.
- **Spacing**: 4px base, `--sp-1` 4px through `--sp-11` 80px.
- **Radii and elevation**: a single `--radius` of 8px, and `--radius-pill` for badges. `--shadow-card`, `--shadow-overlay` for the drawer, `--focus-ring`.
- **No field subtext**: helper text under labels is hidden platform-wide (`.mantine-InputWrapper-description` in `global.scss`). The label and placeholder carry the meaning. The amount field names its currency in the label, "Amount (THB)", as it does today.
- **Drawer contract**: `FormDrawer` (title, subtitle, `size`, pinned `footer`, `status`, `busy`, `dirty` close-guard) wrapping a form that exposes `EntityFormHandle.submit()` and reports through `EntityFormOwnerProps` (`onErrorChange`, `onDirtyChange`, `onSavingChange`). The student drawer uses `size={880}`, with `FormSection`s titled per group.
- **Validation vocabulary**: `fieldValidation.ts` provides `FieldErrors`, `hasErrors`, `errorSummary`, `firstError`, `focusField`, `isEmail`, and `isPhone` (Thai-only, and staying that way for students and teachers).
- **Overview shape**: `AdminTeacherOverviewPage` has a header with `<h1>` plus a `Badge`, a `KpiRow` of four items, and `Tabs` with counts. The Overview tab is `section`s of label/value field grids.
- **Money already built on this branch**: `ContributionDrawer` (already THB-only: "Amount (THB)", date received, method, reference, note), `ContributionsTable`, `DonorBalanceCard`, `AllocationPanel`, `CoverageBar`, and `donorMoney.ts` (`CONTRIBUTION_METHODS`, `loadDonorBalance`, `loadContributions`).
- **Stack**: React 18 + Vite, react-router 6, Mantine 7 under Lumen, Supabase JS, SCSS modules. No Tailwind, no Storybook. There's no phone or country library yet.

## Data Model Changes

`donors` has no migration today; it exists only in the live schema. These columns arrive in a new migration, following `SCHEMA.md`: TEXT, not VARCHAR, TIMESTAMPTZ, and no new FKs.

- **`donors` gains**:
  - `donor_type` TEXT, `'individual' | 'organisation'`, default `'individual'`, so existing rows read as individuals.
  - `contact_person` TEXT, required in the form for organisations and unused for individuals.
  - `country` TEXT, an ISO 3166-1 alpha-2 code, e.g. `TH`, `GB`. Optional; blank means not recorded.
- **`donors.contact.phone`** is stored normalised in E.164 (`+66812345678`). The migration converts every existing number that parses (e.g. `081-234-5678` → `+66812345678`) and leaves the rest exactly as stored, for an admin to fix (decided; see Key Interactions → Phone numbers that need fixing).
- **`donors.contact.email`** is required for **new** donors only (decided). An existing donor saved without one can still be saved; the form warns instead of blocking. It isn't enforced as `NOT NULL` in the database. A case-insensitive uniqueness check against other donors runs in the form (see Key Interactions).
- **`donor_contributions` is unchanged.** Payments stay THB-only in `amount_thb`, as the funding migration defines them. No new columns, and no view, balance or reader changes.
- **`donors.wants_email_updates` is enforced: done ahead of the build, 2026-09-11.** It already existed and both forms already saved it, but nothing read it: `report_email_payload` listed every funding donor regardless, so donors who unticked it still got every report. `20260911090000_report_recipients_email_pref.sql` re-creates the view to include only donors with it on (null counts as on). There's no new opt-out column. The form still has to relabel it *Send report emails*.
- **`donor_balance` counts ended scholarships as committed (money fix, 2026-09-11).** Every scholarship counts at its `amount_thb`. An ended row holds what was actually used, and an early end trims it and records the remainder in `scholarship_releases`. Before, ending a scholarship freed its money again, including months already paid out. `monthly_committed` stays forward-looking (active and needs_decision only).
- **`donor_balance` gains `last_received_on`**: the latest `received_on` among non-voided payments, for the list's Last payment column and the overview KPI. The view was last re-created in `20260831090000_bilingual_and_email.sql`, so the new migration re-creates it from that version.
- **Migration version clash: fixed 2026-09-11.** `20260831090000_school_location.sql` was renamed to `20260831100000_school_location.sql`, so every migration has its own version. The new donor migration takes its own unique version too.
- **Old awards are migrated into `scholarships` before the edit page is retired** (decided). The funding migration never moved them; it mentions `scholarship_awards` only in a comment. The new overview reads `scholarships`, and the retiring edit page is the only screen that reads awards, so without this step existing donors' history would disappear. The rules:
  - **Copy, don't move.** `scholarship_awards` is left untouched, because 15 screens still read it, including donor and teacher screens.
  - **Period and status decide the result.** An `active` award whose period covers today becomes an `active` scholarship. Everything else becomes an ended scholarship (`status = 'ended'`, `ended_at` = the period's end), with `ended_reason` recording whether it was past, `completed` or `cancelled`. Only active ones count toward coverage and commitments. **The live constraint rejects this today:** the 14 June schema dump shows `scholarships_status_check` allows only `active` and `inactive`. So the same migration first replaces it with the sponsorship brief's vocabulary, `active | needs_decision | ended`, mapping `inactive` to `ended`.
  - **Paid awards also become payments** (decided). An award with `is_paid` true or a `payment_date` (the test `AdminStudentsPage` already uses for "donated") creates a `donor_contributions` row for `amount_for_period`, dated `payment_date` (otherwise `period_start`), with the note *Migrated from award*. Migrated donors start with a truthful balance instead of a negative one. A cancelled award that was paid still creates its payment, because the money arrived.
  - **Amounts.** `amount_thb` = `amount_for_period`; `monthly_amount_thb` = that over the period's months, the same derivation the funding migration uses. Award currency written as `THB`, `thb`, `Bhat` or blank counts as THB. Any other currency isn't migrated and is listed for manual handling, since payments are THB-only.
  - **Awards that can't become scholarships.** `scholarship_awards.donor_id` and `student_id` are nullable, but `scholarships` requires both. An award missing either is skipped and listed, never guessed. `scholarship_awards.created_at` is `timestamp without time zone` and is read as UTC.
  - **Traceable and safe to re-run.** Each created scholarship and payment stores `source_award_id` (a new UUID column on both, with no FK, per `SCHEMA.md`). A re-run skips awards already migrated. An award already covered by an active scholarship for the same donor and student over an overlapping period is skipped and listed, so current commitments aren't counted twice.
  - **Preview before write.** There's no test database, so the migration ships with a read-only preview query listing every row it would create, skip or flag. That preview is reviewed before the insert runs.
  - **Order:** funding migration → this awards migration → retire the edit page. The awards migration needs `monthly_amount_thb`, `ended_at` and `donor_contributions`, which exist only once the funding migration is applied.
- **Feeds the email brief**: `report_email_payload` (from `donor-email-and-bilingual`) filters on `wants_email_updates`, as above, and adds `donor_type` and `contact_person`, so an organisation's report is addressed to its contact person rather than "Dear Acme Foundation".

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| `FormDrawer` | Exists | Used as-is. Size 880, matching the student drawer. |
| `DonorForm` | New | The fields and save logic, exposing `EntityFormHandle`. One form for add and edit (pre-filled via a `donor` prop). Replaces the field markup in `AdminCreateDonorPage` and `AdminEditDonorPage`. |
| `DonorFormDrawer` | New | Wraps `DonorForm` in `FormDrawer`, following `TeacherFormDrawer` / `StudentFormDrawer`. Title "Add donor" or "Edit donor · {name}", footer Cancel + "Create donor" / "Save changes", error repeated in `status`. |
| `DonorTypeToggle` | New | A two-option segmented control (Individual · Organisation) at the top of the form. Built on existing Lumen/Mantine segmented control styling. |
| `CountrySelect` | New | A searchable, optional select (starts blank) showing the country name and dialling code, with no flags, from a static ISO list checked into the repo. Thailand first, then alphabetical. |
| `PhoneInput` | New | A dialling-code prefix driven by the selected country, plus the national number. With no country it expects international form starting with +. Validates and normalises to E.164 with `libphonenumber-js` (new dependency, "min" metadata). Thai numbers typed locally (`081 234 5678`) are accepted when the country is Thailand. |
| `fieldValidation.ts` | Modify | Adds `isInternationalPhone(value, country)` and `normalisePhone`. `isPhone` stays Thai-only for students and teachers. |
| `AdminDonorsPage` | Modify | "Add donor" opens `DonorFormDrawer` instead of navigating. On create, the new row highlights and the drawer offers "Open donor". Adds a Type column and a Country column. Reads `?balance=idle`, which the dashboard's "Allocate ฿X" action already sends and the page currently ignores, and `?phone=invalid` for the *Phone needs fixing* filter. |
| `globalSearch.ts` (`searchDonors`) | Modify | Donor results open the overview (`/admin/donors/:id`), not `/edit`; the comment saying donors have no read-only record of their own becomes false. Matches `name`, `contact->>email` and `contact_person`, not just `name`, since the donors list has no search box of its own. |
| `AdminCreateDonorPage` | Retire | The `/admin/donors/new` route redirects to `/admin/donors?add=1`, which opens the drawer. |
| `AdminEditDonorPage` | Retire | The `/admin/donors/:id/edit` route redirects to the overview with the drawer open (`?edit=1`). The page is more than a form: it also holds *Linked account & invitations* (the only caller of the `invite-donor` function) and the donor's scholarship-award history. Invitations are deferred, so that section isn't carried over, and `invite-donor` stays deployed but unused. The award history is carried by migrating old awards into `scholarships` (see Data Model Changes), so it appears on the overview's Students tab. The page is deleted only after that migration has run. |
| `AdminDonorDetailPage` | Modify (rebuild) | Becomes the overview in the teacher shape: header + `Badge` (Individual / Organisation) + actions (Edit, Record payment), `KpiRow`, `Tabs`. Keeps `DonorBalanceCard`, `ContributionsTable` and `AllocationPanel` inside the tabs. |
| `KpiRow` | Exists | Total given (THB) · Unallocated · Students funded · Last payment (date). |
| `Tabs` | Exists | Overview · Payments (count) · Students (count). |
| `ContributionDrawer` | Modify | Renamed in the UI only: title *Record payment* / *Edit payment*, button *Record payment*. Fields are unchanged and already THB-only. |
| `ContributionsTable` | Modify | Section title *Payments*, and every *contribution* string renamed. Columns unchanged. |
| `InlineMessage`, `Badge`, `Tooltip`, `EmptyState` | Exist | Used as-is. |

## Key Interactions

**Opening Add donor.** From the donors list, "Add donor" slides the drawer in over the table, and the table stays visible behind the scrim. Focus goes to the Individual/Organisation toggle. Closing with anything typed asks first; this is the existing `dirty` guard.

**Choosing the type.** Individual shows **Name**. Organisation relabels it **Organisation name** and reveals **Contact person** directly under it. Contact person is required for organisations (decided): *"Name the person reports go to."* Report emails to an organisation are addressed to that person. Switching back hides Contact person but keeps what was typed, so a mis-click loses nothing. The type is shown as a badge everywhere the donor appears afterwards.

**Field order.** It follows the three existing groups, as `FormSection`s:
1. **Donor**: type, name, contact person (organisations), agent.
2. **Contact**: email, country, phone, other contact (LINE, WhatsApp), address.
3. **Preferences**: preferred language (English · Thai), **Send report emails** (the existing `wants_email_updates`, relabelled, on by default), newsletter, and internal note.

The existing dashboard-access toggle stays on the form (decided: leave as-is). Login invitations are deferred: the *Send login invitation* button and the linked-account display aren't carried over from the edit page, and already-linked donors keep their accounts.

**Email validation**, the rule that decides whether reports arrive at all:
- Empty on save, **for a new donor**: *"Enter an email address — this is where their reports are sent."* For an **existing** donor already saved without one, the save goes through and the field shows a warning instead: *"No email — reports can't be sent to this donor."*
- Malformed (`isEmail`): *"That does not look like a complete email address, for example name@example.com."*
- Matches another donor, case-insensitive and ignoring surrounding spaces, checked on blur and again on save: *"Another donor already uses this email — Somchai P."*, with the name as a link that opens that donor. This is an error that blocks saving, because two donor records on one address means one person receives the same report twice.
- Matches a user account in `profiles`: **no notice.** The current form says the donor "will be automatically linked", but nothing links on save; linking only ever happened through the invitation, which is deferred. The false message is removed.
- On edit, the donor's own current email is excluded from the duplicate check.

**Country and phone.** Country is optional (decided) and starts blank. When a country is chosen, the phone field shows its dialling code (+66, +44, +1…) and accepts the number in national form, including a Thai number typed locally (`081 234 5678`). With no country, the phone must be typed in international form: *"Add the country code, for example +66 81 234 5678, or choose a country above."* Phone is optional, but if typed it must be valid: *"That is not a valid number for the United Kingdom. Include the area code, for example 7700 900123."* Changing the country after a number has been typed re-validates it rather than silently rewriting it. The number is saved in E.164 and displayed in its country's national format.

**Phone numbers that need fixing.** Old numbers the migration couldn't clean up are fixed deliberately, not left (decided). The donors list gets a **Phone needs fixing** filter with its count, reachable as `?phone=invalid`, listing every donor whose stored phone doesn't validate, so they can all be fixed now rather than only when a donor happens to be edited. Editing one of those donors shows the stored number in the field with *"That isn't a valid number. Fix it or clear the field."*, and **Save changes** is blocked until it's valid or cleared. Unlike a missing email, which only warns, an invalid number blocks saving.

**Send report emails.** The existing `wants_email_updates` field, relabelled from *Wants email updates* and on by default. It has always been saved and never read: donors who unticked it still received every report. Now `report_email_payload` leaves them out, and the Overview tab shows a neutral *"Report emails off"* line for them.

**Saving.** Pressing Create donor validates everything at once. Every problem field is marked, the count appears in the drawer's `status` beside the button ("2 fields need attention before this can be saved."), and focus moves to the first problem field. On success the drawer closes and a notification says *"Acme Foundation added."* with an **Open donor** action. The list reloads with the new row highlighted. On edit, the overview updates in place and the drawer closes.

**Donor overview.** The header shows the name (organisation name for organisations), an Individual/Organisation badge, and a subtitle line: *Organisation · United Kingdom · jane@acme.org · English*. For organisations, the contact person leads the subtitle. The actions are **Edit** (secondary, opens the drawer pre-filled) and **Record payment** (primary, the one blue button). The `KpiRow` shows Total given, Unallocated (warning tone whenever it's above zero, the same definition of idle money the dashboard uses: `free_balance_thb > 0`), Students funded, and Last payment.
- **Overview tab**: field-grid sections for Contact, Preferences, and Internal note, as on the teacher overview.
- **Payments tab**: `ContributionsTable`, newest first, with voided rows kept and struck through (existing behaviour).
- **Students tab**: the funded-students table and **Allocate**, which opens the existing `AllocationPanel`.

**Recording a payment.**
1. **Record payment** opens the payment drawer with the existing fields: **Amount (THB)**, **Date received** (today by default), **Method**, **Reference**, **Internal note**.
2. On save the drawer closes, the notification confirms what was added (*"฿21,450 recorded."*), and the KPI row and balance update.

**Editing a payment.** The pencil on a Payments-tab row opens the same drawer in edit mode, as it does today. Nothing changes except the wording.

## Responsive Behavior

- **Desktop (≥1024px)**: the drawer is 880px wide, and Donor and Contact sections use two-column field grids as the student form does. The overview's `KpiRow` shows four across.
- **Tablet (641–1023px)**: the drawer takes the full width minus a gutter, and the field grids stay two-column where they fit. The `KpiRow` wraps to two by two.
- **Mobile (≤640px)**: the drawer is full-screen, with the action bar still pinned to the foot. All fields are single-column. The Individual/Organisation toggle stretches full width. Tabs scroll horizontally, and tables scroll inside their own container. Touch targets meet 44px (see Out of Scope for the known Mantine button gap).

## Accessibility Requirements

- **Contrast**: text meets 4.5:1 and large text and UI boundaries meet 3:1, using existing tokens only.
- **Errors**: each invalid field sets `aria-invalid` and is described by its message. The summary in the drawer's `status` is announced via a polite live region. After a failed save, focus moves to the first invalid field (`focusField`), not to the top of the drawer.
- **Drawer focus**: focus is trapped while open, Escape closes (subject to the dirty guard), and focus returns to the button that opened it. The title is the drawer's accessible name.
- **Type toggle**: it's a radio group with a visible label ("Donor type"), operable with arrow keys. Revealing Contact person is announced by the field's own label, not by motion.
- **Phone**: the dialling-code prefix is part of the field's accessible description, so a screen reader user hears "+44" before typing.

## Out of Scope

- **Donor login and invitations.** Deferred. The dashboard-access toggle stays as a saved field. The *Send login invitation* button isn't carried over, and `invite-donor` stays deployed but unused until login is built.
- **Communication consent.** Decided against a consent checkbox. Every donor with an email receives reports unless **Send report emails** is off. No consent timestamps and no lawful-basis records. Revisit if PDPA or GDPR review asks for them.
- **A report email preference beyond on/off.** There's no "every report vs. termly summary" choice. It's all reports, or none via the opt-out.
- **Languages beyond English and Thai.** Report templates exist only for these two.
- **Multi-currency.** Payments are recorded in THB only, like the rest of the money model. A donor who pays in pounds or dollars is recorded at the baht the bank credited. Recording the original currency with an exchange-rate estimate was designed and deliberately deferred.
- **Bank reconciliation.** No bank-feed matching. Payments are entered by hand from the statement.
- **Archiving or removing donors.** No archive exists today and none is added. Turning *Send report emails* off covers a donor who wants no more contact.
- **Porting the 15 screens that still read `scholarship_awards`.** The migration copies awards into `scholarships`; it doesn't switch those screens over. Until they're ported, new allocations (written to `scholarships`) stay invisible on them. That split predates this work.
- **Receipts and tax statements.** No document is generated when a payment is recorded.
- **Voiding payments.** The existing void flow (reason required, row kept, struck through and greyed) is unchanged.
- **The 44px mobile touch-target gap on Mantine buttons.** A known, separate open issue from QA; this feature inherits whatever that fix delivers.
- **Deduplicating existing donor records.** The duplicate-email check prevents new duplicates. It doesn't merge ones already in the table.

## Open Questions

None open. Every question raised while briefing and grilling (2026-09-11) is decided and written into the sections above. Some things can only be counted against live data at build time: how many donors fall into the *Phone needs fixing* and no-email groups, and how many awards the migration skips. The schema facts above come from `full_schema.sql`, dated 14 June; re-check them on staging before running anything.
