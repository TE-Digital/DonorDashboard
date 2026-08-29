# Design Brief: Donor funding, allocation, and the donor-facing report

## Problem

A donor gives iCare 60,000 THB. Somebody at iCare has to turn that into "Mali and Nan are in school this year, and here is their report card." Between those two facts the platform offers nothing.

**Money has nowhere to sit before it is spent.** Every money row in the database is born attached to a student — `scholarship_awards` requires a `student_id` before it will hold an amount. So a transfer that arrives on Monday and is assigned on Friday does not exist for four days. There is no donor balance, no "unallocated" number, no record that money came in at all. An admin asking "how much of Khun Somchai's gift is still unspent?" has to add it up from memory.

**Two money systems disagree.** Everything the admin writes goes to `scholarship_awards`. Everything the donor pages read comes, through `student_current_donor` and `students_for_donor`, from `scholarships` — a table no application code writes to. The donor screens and the admin screens are reading two different ledgers. Neither is wrong on its own; together they are unreliable, and nobody can tell which one to trust.

**The student's need is written down and then ignored.** `students.monthly_support_expected` is on the form, is in the profile-completion checklist, and shows on the student overview as a number with "THB" after it. Nothing compares it to what the student actually receives. An admin assigning a donor cannot see which student is short, or by how much, so allocation is done by whoever is remembered rather than by who is uncovered.

**The donor sees things they should not, and misses things they should.** `DonorStudentDetailPage` reads `term_updates` with no status filter — a donor signed in today can read a teacher's unfinished draft. The same query pulls `info`, the older duplicate of the donor text, and falls back to a 200-character truncation of it. Meanwhile there is no donor overview at all: no page that says how many students you support, what you have given, what is still unallocated, and which reports arrived this term. And a donor who reads a report and has a question — "is she still living with her grandmother?" — has nowhere to put it.

**Approval is a dropdown.** A report goes to the donor when somebody changes a select from "Submitted" to "Approved". There is no screen where a person reads the teacher's words next to what the donor will read, and no moment where anyone deliberately decides this is fit to send.

## Solution

Money becomes something you can hold, see, and spend down.

A donor's gift is recorded when it **arrives**, not when it is assigned. Each donor carries a running balance: what they have contributed, what is committed to students, what is still free. Adding more money later is one act on the donor's page — a contribution row, dated, with a reference — and the balance moves. Corrections are edits to that row, not silent adjustments to a total.

Allocation starts from the donor. Open a donor, see their free balance, press **Allocate**, and the panel lists students ranked by **funding gap** — what they need against what they already receive. Choosing a student and an amount creates a scholarship, draws the balance down, and links that donor to that student's reports from here on. A student short by 800 THB a month sorts above a student short by 200, so the screen answers "who needs this next" without anyone having to know.

Reports get a real gate. When a teacher submits, an admin opens a **verification screen**: the teacher's submission on one side, the donor-facing version on the other, editable. Internal notes stay on the left and never cross. Attachments are marked public one by one. The commit is *Approve & send to donor* — one deliberate act, after which the report is visible to exactly the donors funding that student, enforced in the database rather than by a filter in the browser.

And the donor gets an actual home: an overview of the students they support, the money they have given and what remains, the reports waiting to be read, and the ability to respond — a comment on a report, or a flag when something needs an answer. A flag is not a complaint; it is a question that lands on the admin's desk with the report attached.

## Experience Principles

1. **Money is a ledger, not a number** — Every balance on every screen is the sum of rows a person can open, dated and referenced. Nothing is adjusted invisibly; a correction is an edit with a trail. An admin who does not trust the number will go back to a spreadsheet, and then the platform is decoration.
2. **The gap is the unit of attention** — Students are ranked by what they lack, not by name or by when they were added. Coverage is shown as need against received on every surface that mentions a student and money. A fully funded student is quiet; a short one is not.
3. **Nothing reaches a donor by default** — Draft, internal note, private photo, unverified grade: all invisible until a person deliberately sends them. The gate lives in the database, so a new screen built next year inherits it instead of re-earning it.

## Aesthetic Direction

- **Philosophy**: Lumen — the existing system. Operational software for people managing real students and real money: spreadsheet-familiar tables, a rationed blue spent only where an action or a state matters, warm off-white chrome. The donor-facing side is the same system in a warmer register — fewer tables, more cards, larger photographs — but the same tokens, never a second visual language.
- **Tone**: Admin side calm and administrative; handling money is routine bookkeeping, not an event. Donor side warm and plain-spoken — a person who gave money wants to know a child is doing well, not to read a finance dashboard. The only things that raise their voice on either side are an uncovered student, an unallocated balance sitting idle, and a flagged report.
- **Reference points**: Stripe's balance and payouts screens for the money ledger — a headline number that decomposes into rows you can open. Linear's directories for the allocation table. For the donor overview, a school's end-of-term letter: a photograph, a name, a paragraph that sounds like a person wrote it.
- **Anti-references**: Not a crowdfunding page — no progress thermometers, no urgency copy, no "3 children still need you". Not a fintech dashboard for the donor — no sparklines on generosity, no portfolio framing of children. And not a generic admin CRUD grid where a contribution, a scholarship, and a report all render as the same grey row.

## Existing Patterns

- **Typography**: `--font-core` is Figtree with a system fallback; one family throughout (`--font-display`, `--font-mono`, `--font-numeric` all alias it). Ramp: `--fs-h1` 24px, `--fs-h2` 19px, `--fs-h3` 16px, `--fs-body` / `--fs-sm` 14px, `--fs-xs` 12px, `--fs-micro` 11px. Table text is `--text-table` (14px). Money uses `--font-numeric` with tabular figures so columns of THB line up.
- **Colors**: Blue ramp `--blue-25` `#f3f5fe` → `--blue-800` `#041461`, primary `--blue-500` `#072ac8`. Surfaces `--surface-card` / `--surface-raised` white, `--surface-sunken` `--n-25`, nav `#f6f5f2`, rail `#efedea`, hover `--n-100`, selected `--blue-50`. States use the existing `success / info / warning / danger / neutral` tones — reused verbatim for coverage (funded = success, partial = warning, uncovered = danger) so the vocabulary matches the report badges an admin already reads. 183 custom properties in `src/design-system/lumen/tokens.css`; this feature adds none.
- **Spacing**: 4px base scale (`--sp-2` = 8px upward).
- **Radii**: one value — `--radius` 8px aliased across every size; `--radius-pill` 999px for chips and circles only.
- **No field subtext**: helper text under input labels was removed platform-wide; `.mantine-InputWrapper-description` is hidden in `global.scss`. Label and placeholder carry the meaning. Money fields follow this — currency lives in the label or as a suffix, never as a hint line.
- **Stack**: React 18 + Vite, react-router 6, Mantine 7 under a Lumen wrapper layer, Supabase JS, `@tabler/icons-react` and `lucide-react` through `Icon.tsx`. SCSS modules per component; no Tailwind, no Storybook.
- **Components this feature stands on**: Lumen `Button`, `IconButton`, `Input`, `Field`, `Select`, `Badge`, `Tag`, `Card`, `Banner`, `Dialog`, `Tooltip`, `DataTable` (with `DataColumn`, `ColumnFilter`, `SortState`), `FilterBar`, `KpiCard`, `Pagination`, `EmptyState`, `PageHeader`, `TileCard`, `AppShell`, `SideNav`. Plus `TableSection`, `SectionCard`, `StatCard`, `FormDrawer`, `FormLayout`, `FormActions`, `InlineMessage`, `KpiRow`, `LoadingState`, `ContactCell`.
- **Report vocabulary already defined**: `reportStatus.ts` owns the lifecycle — `draft`, `submitted`, `under_review`, `changes_requested`, `approved` — plus the derived cycle states `not_started`, `due_soon`, `overdue`, their tones, their sort ranks, and the 6-month default cycle. This feature adds `flagged` to that vocabulary and changes nothing else in it.
- **Report record already unified**: `reportRecord.ts` is the single definition of a report; `donor_comment` is what the donor reads and `info` is the legacy duplicate written alongside it for older screens. The donor render reads `donor_comment` only, and the legacy fallback is removed.

## Data Model Changes

Decided in grilling; recorded here because every screen below depends on it.

- **`donor_contributions` (new)** — `donor_id`, `amount_thb`, `received_on`, `method`, `reference`, `note`, `created_by`, timestamps. Money in, no student. This is the only place a gift is recorded, and the only thing an admin edits when a donor sends more.
- **`scholarships` + `scholarship_payments` become the truth.** `scholarship_awards` data migrates in and the table retires. This is the largest single cost in the plan — roughly ten admin pages read it today — and it is unavoidable: `scholarship_awards` requires a student on every row, so unallocated money has nowhere to live while it exists.
- **Donor balance** — a view: contributions − active commitments. Never a stored column, so it cannot drift.
- **Student coverage** — a view: `monthly_support_expected` against the sum of active scholarships. Yields the funding gap that ranks the allocation panel. Multiple donors per student are allowed; `student_current_donor` is rewritten from "the donor" to "the donors".
- **`term_updates` gains** `flagged_at`, `flagged_by`, `approved_at`, `approved_by`, and a `report_comments` child table (`report_id`, `author_id`, `body`, `audience`) so a donor question and an admin answer sit on the report rather than in email.
- **RLS** — a donor may read a `term_updates` row only when its status is `approved` and an active scholarship links them to that student; may read an attachment only when it is marked public; may never read `internal_note`. Enforced on the table, not in the query.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| `DonorBalanceCard` | New | Headline free balance, with given / committed / free decomposed beneath. Admin donor page and donor overview both use it, at different sizes. |
| `ContributionsTable` | New | The ledger: date, amount, method, reference, who recorded it. Built on `DataTable`. Row menu edits or voids. |
| `ContributionDrawer` | New | Record or edit a contribution. `FormDrawer` + `FormLayout` + `FormActions`, matching `StudentFormDrawer`. |
| `AllocationPanel` | New | Balance at top, students ranked by gap, amount and coverage dates per allocation, running "remaining after this" figure. `FormDrawer` shell. |
| `CoverageBar` | New | Need vs received as one bar with a number beside it. Appears in the allocation panel, the students table, and the student detail page. Tones reuse success / warning / danger. |
| `CoverageCell` | New | The compact `DataTable` cell form of the above; sorts by gap. |
| `ReportVerifyPage` | New | Two panes: teacher submission left, donor-facing version right and editable. Per-attachment public toggle. Commits *Approve & send to donor*. |
| `DonorReportCard` | New | The donor render of a report: photo, grade, donor comment, public attachments. Never renders `internal_note`. |
| `ReportCommentThread` | New | Comments on a report, with the donor/internal audience distinction visible in the composer. |
| `FlagButton` + `FlagBanner` | New | Donor raises a question on a report; the banner shows an open flag to admin and donor alike, with who raised it and when. |
| `DonorOverviewPage` | New | Donor's home: students supported, balance, reports this term, open flags. |
| `AdminDonorDetailPage` | New | Currently only create and edit pages exist for a donor. This is the money-and-students view an admin opens. |
| `AdminAllocationsPage` | New | Every allocation across every donor, filterable — the reconciliation view. |
| `DonorDashboardPage` | Modify | Becomes a students list under the new overview rather than the donor's entry point. |
| `DonorStudentDetailPage` | Modify | Reports section switches to `DonorReportCard`; the unfiltered `term_updates` read and the `info` fallback are removed. |
| `AdminDonorsPage` | Modify | Gains balance, students supported, and unallocated columns; rows link to the new detail page. |
| `AdminScholarshipsPage` | Modify | Repoints from `scholarship_awards` to `scholarships`. |
| `AdminStudentsPage` | Modify | Gains a coverage column; repoints off `scholarship_awards`. |
| `AdminStudentDetailPage` / `AdminStudentOverviewPage` | Modify | Show coverage and all funding donors, not one. |
| `AdminReportsPage` | Modify | Adds a flagged filter and routes submitted reports to verification instead of a status dropdown. |
| `reportStatus.ts` | Modify | Adds `flagged` to the state vocabulary, its tone, hint, and sort rank. |
| `DataTable`, `KpiCard`, `FormDrawer`, `Badge`, `Banner`, `Dialog`, `PageHeader`, `EmptyState` | Exists | Used as-is. |

## Key Interactions

**Recording money.** Admin opens a donor, presses *Record contribution*. A drawer asks amount, date received, method, reference, note. On save the drawer closes, the balance figure animates from old to new value, and the new row appears at the top of the ledger. If the donor already has money and this is a top-up, nothing about the flow differs — the balance simply moves. Editing a contribution opens the same drawer with values loaded; the balance recalculates on save. Voiding asks for confirmation in a `Dialog` naming the amount and date, because a voided gift changes what is allocatable and may push the donor's free balance negative — which is allowed, shown in danger tone, and reads *Over-allocated by 4,200 THB* rather than being silently clamped to zero.

**Allocating.** *Allocate* opens a panel with the free balance pinned at the top. Beneath it, students sorted by funding gap, each with name, school, need, currently received, and the gap. Selecting one reveals an amount field pre-filled with the gap and coverage dates defaulted from the grant type's duration. As the amount is typed, the balance at the top updates live to show what remains after this allocation. Multiple students can be allocated in one pass; the panel commits them together. A student already fully covered still appears, greyed, sorted last, and selectable — over-funding is a decision, not an error.

**Verifying a report.** From the reports table, a submitted report opens the verification screen rather than a form. Left pane, read-only: everything the teacher wrote, internal note included, every attachment. Right pane, editable: the donor comment, the grade as the donor will see it, and each attachment with a public toggle, default off. A persistent footer names the donors who will receive this — "Goes to Khun Somchai and one other" — and holds *Request changes* and *Approve & send to donor*. Approving stamps `approved_at`, the report becomes visible to those donors, and the screen returns to the reports table with the row moved to Approved. *Request changes* asks for a sentence back to the teacher and sets `changes_requested`.

**Reading, commenting, flagging.** The donor's overview lists reports newest first. Opening one gives the `DonorReportCard`. Below it, a comment box: plain, one field, *Send*. A comment posts immediately and shows as pending until an admin replies. *Flag this report* is a quieter secondary action asking for a reason; flagging turns the report's badge amber on every admin screen and puts it at the top of the reports table's sort. An admin resolving a flag writes a reply, and the resolution shows in the same thread the donor already opened — the donor is never sent elsewhere to find the answer.

**Seeing coverage.** Wherever a student appears next to money, the `CoverageBar` shows need against received. Fully funded reads as a quiet green line with the amount beside it. Partial reads amber with the gap in words — *1,200 THB short each month*. Uncovered reads danger. The students table sorts by this column by default when reached from the allocation flow, and by name otherwise.

## Responsive Behavior

Admin screens are desktop-first; the target is a laptop in an office. Below 1024px the money tables drop the lowest-value columns (method, reference, recorded-by) into a row expander rather than scrolling horizontally, matching how the existing directories degrade. Below 768px, `AllocationPanel` and every `FormDrawer` go full-screen rather than sliding from the edge.

`ReportVerifyPage` is the one screen that changes behavior rather than size: the side-by-side panes cannot survive a narrow viewport, so below 1024px they become two tabs — *Teacher's report* and *What the donor sees* — with the approve footer pinned. Below 768px it warns that verification is better done on a larger screen but does not block, because a report waiting on somebody's laptop is a report the donor does not get.

Donor screens are mobile-first; a donor reads a report on a phone, often from an email link. The overview stacks to a single column, `DonorBalanceCard` becomes a compact two-line summary, report cards go full-bleed, and photographs keep their aspect ratio rather than cropping to a grid. Comment and flag actions stay reachable without a menu.

## Accessibility Requirements

- WCAG 2.1 AA. Body text at `--fs-body` on `--surface-card` clears 4.5:1; money figures and coverage numbers are body-weight or heavier and never rely on `--n-400` or lighter.
- **Coverage and status never rest on color.** Every coverage bar carries its number and a word; every status badge carries its label. A flagged report is amber *and* says "Flagged". This is already the rule in `REPORT_STATE_META` and extends unchanged.
- Money is marked up so screen readers read "one thousand two hundred baht", not "1,200". Tabular figures are a visual choice and must not change what is announced.
- Full keyboard path through the allocation panel: student list is a listbox with arrow navigation, amount fields are in tab order, and the running balance is an `aria-live="polite"` region so a keyboard user hears the remaining figure change.
- `ReportVerifyPage` manages focus deliberately — approving moves focus to the reports table with a live-region confirmation naming the report and the donors it went to. The two-tab mobile form is a real tablist.
- Destructive and irreversible confirmations (voiding a contribution, ending a scholarship) trap focus in the `Dialog`, return focus to the invoking control on cancel, and name the specific amount and person in the prompt rather than saying "this item".
- Every form error is bound to its field with `aria-describedby`, and the drawer scrolls the first error into view on failed save.

## Out of Scope

- **Multi-currency.** THB is hardcoded across `donors`, `grant_types`, `scholarships`, and `scholarship_payments`. Everything here stays THB-only; a currency column is a separate piece of work.
- **Payment processing.** No card capture, no bank integration, no receipts issued. Contributions are recorded by an admin after money has already arrived by other means.
- **Donor self-service allocation.** A donor cannot choose their own student or move money between students. Allocation is an admin act; the donor sees the result.
- **Tax receipts and formal donation statements.** Related and likely next, but a document-generation problem, not this one.
- **Teacher report authoring.** `ReportForm` and its drawer are untouched. Verification consumes what they produce.
- **Notifications.** No email or LINE message when a report is approved or a flag is raised. Both surfaces show state; delivery is separate work.
- **Agents.** `agents`, `agent_donors`, and `agent_students` exist and `scholarship_awards` carries an `agent_id`. Whether an agent sees balances or allocations is deliberately unanswered here.
- **Historical backfill accuracy.** The migration off `scholarship_awards` preserves what is stored. It does not reconstruct contributions that were never recorded, so donors will start with a balance derived from existing awards and no contribution history before go-live.

## Open Questions

1. **Report CRUD for donors.** The request named "basic CRUD functions" on reports alongside flag and comments. Read as: donors **read** reports, **create** comments and flags, and edit or delete **their own** comments — never the report itself, which stays admin- and teacher-owned. Full CRUD on the report record remains an admin capability, and lives on the existing report form rather than the donor side. Confirm before build.
2. **Money returning to the pool.** Assumed: ending a scholarship early returns the uncommitted remainder to the donor's free balance, and the ledger shows the release as its own row. Assumed rather than decided.
3. **Donor visibility of money.** Assumed: a donor sees their own balance — given, committed, free. If donors should see only students and reports, `DonorBalanceCard` drops off the donor overview and stays admin-only.
