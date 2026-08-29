# Design Brief: Admin dashboard

## Problem

An admin signs in and lands on eight numbers in a row: students, teachers, schools, donors, active scholarships, total scholarships, overdue reports, open contact requests. Every one of them is a count of rows. None of them is a decision.

**The page cannot answer the question the admin actually arrived with.** That question is some version of *where does the next baht go*. Answering it today means opening the donors directory, reading balances one donor at a time, opening the students directory, sorting by coverage, and holding both in your head. The platform has all the parts — `donor_balance` and `student_coverage` are real views, `donor_contributions` is a real table — and the dashboard reads none of them. The money layer was built and the front door never learned about it.

**The dashboard does not know where the organisation works.** iCare operates across remote schools in different provinces. The `schools` table holds a name and a free-text address. Province and district are invented in `schoolProfile.ts` from the row id, deterministically, as placeholders — the file says out loud that no caller should treat them as facts. So nobody, including the admin who runs this, can look at one screen and say which provinces the work is concentrated in, or which of them are underfunded.

**It reads as a form, not a report.** The first thing on the page after the hero is four *Add* buttons. An admin arriving to understand the operation is greeted by four ways to create more of it. And a number on this page is a dead end — seeing "7 overdue reports" gives no way to reach those seven.

**Nothing leaves the page.** An admin asked to take the state of the programme into a meeting has nothing to bring. So the real dashboard is a spreadsheet somebody maintains by hand, and the one in the product is decoration.

## Solution

The dashboard becomes the page you read before you decide, and the page you print when someone asks how the programme is doing.

It opens on money, framed as one comparison: **what has been committed this year against what is still uncovered.** The committed figure decomposes — free balance sitting with donors, committed to students, and the count of students carrying a gap. The gap figure is honest about its own edges: students whose need nobody has recorded are counted separately and said out loud, because a gap that quietly excludes them looks smaller than it is.

Beneath money sits **the operation**: students in school, schools active, teachers reporting, donors giving. These stay, but each becomes a way in rather than a full stop — every number links to its own list, pre-filtered to exactly the rows behind it.

Then **where**: a table of provinces, ranked by funding gap, showing schools, students, covered and uncovered in each. Province becomes a real column on `schools` for the first time, entered by an admin on the school form. A map comes later, once the field is real and filled; it is not drawn on top of placeholders.

Then **movement**: one chart, twelve months, contributions received against amount allocated. Whether money is arriving faster than it is being placed, or the reverse.

**Quick actions are the queue, not a toolbar.** Three of them — allocate idle funds, verify submitted reports, answer contact requests — each carrying its count, each disappearing when the count is zero. An admin with nothing waiting sees nothing waiting. No *Add* buttons; creating things happens in the directories that own them.

And the whole thing exports. One button, CSV, the rows behind every number on the page, so the meeting version and the screen version are the same numbers.

## Experience Principles

1. **Every number is a door** — No figure on this page is terminal. Clicking a count opens the list it counted, filtered to those exact rows. An admin who has to re-find the underlying records by hand will stop trusting the summary and go back to the spreadsheet.
2. **Say what the number excludes** — The gap omits students with no recorded need; the yearly figure is committed, not disbursed. Both are labelled as what they are, on the page, next to the number. A precise-looking figure that quietly hides its own caveat is worse than no figure.
3. **The page is a report, not a console** — Reading is the default posture. Actions appear only when there is a queue to clear, and creating a record is not one of them. Calm at rest; the only things that raise their voice are idle money, an uncovered student, and a report waiting to be verified.

## Aesthetic Direction

- **Philosophy**: Lumen — the existing system, unchanged. Operational software for people managing real students and real money: spreadsheet-familiar tables, rationed blue spent only where an action or a state matters, warm off-white chrome. This feature adds no new custom properties.
- **Tone**: Calm and administrative, with one register shift. The money band at the top is allowed to be the largest type on the page because it is the reason the admin came. Everything below it is quiet reference. Nothing celebrates; nothing pleads.
- **Reference points**: Stripe's balance overview for the money band — a headline that decomposes into parts you can open. Linear's cycle overview for the queue: counts that vanish at zero rather than showing a proud zero. A government statistical release for the province table — dense, sorted, unglamorous, trustworthy.
- **Anti-references**: Not an analytics dashboard — no widget grid, no chart wall, no sparkline per metric. Not a crowdfunding page — no progress thermometers, no urgency copy. Not the current page — no wall of undifferentiated counts, no row of Add buttons above the fold. And no map drawn from data we do not have.

## Existing Patterns

- **Typography**: `--font-core` is Figtree with a system fallback; one family throughout. Ramp: `--fs-h1` 24px, `--fs-h2` 19px, `--fs-h3` 16px, `--fs-body` / `--fs-sm` 14px, `--fs-xs` 12px, `--fs-micro` 11px. Money uses `--font-numeric` with tabular figures so THB columns line up. The money headline is the one place this page goes above `--fs-h1`.
- **Colors**: Blue ramp `--blue-25` → `--blue-800`, primary `--blue-500` `#072ac8`. Surfaces `--surface-card` / `--surface-raised` white, `--surface-sunken` `--n-25`, nav `#f6f5f2`, hover `--n-100`, selected `--blue-50`. Coverage reuses the existing state tones exactly as the funding feature defined them — funded = success, partial = warning, uncovered = danger.
- **Spacing**: 4px base scale (`--sp-2` = 8px upward). **Radii**: one value, `--radius` 8px; `--radius-pill` for chips only.
- **Stack**: React 18 + Vite, react-router 6, Mantine 7 under a Lumen wrapper layer, Supabase JS, `@tabler/icons-react` / `lucide-react` via `Icon.tsx`. SCSS modules. **No charting library and none is being added** — the one trend chart is hand-authored SVG using existing tokens.
- **Components this page stands on**: `KpiRow` / `KpiItem` with its `mark` vocabulary (`students`, `teachers`, `schools`, `donors`, `ontrack`, `scholarships`, `overdue`, `requests`), `PageHeader`, `SectionCard`, `StatCard`, `LoadingState`, `EmptyState`, `InlineMessage`, `TableSection`, plus Lumen `DataTable`, `Badge`, `Banner`, `Button`, `Card`, `Tooltip`, `FilterBar`.
- **Money layer already exists**: `donor_balance`, `student_coverage`, `student_donors` views and the `donor_contributions` table shipped in `20260830090000_donor_funding.sql`, wrapped in `src/modules/donor/donorMoney.ts`. This page reads them; it writes nothing.
- **CSV export already has a precedent**: `AdminStudentsPage.tsx` builds a CSV string, wraps it in a `Blob`, and triggers a download link, behind a `Button variant="secondary" icon="download"` with a disabled-while-exporting state. The dashboard export follows that shape rather than inventing one.
- **Report vocabulary**: `reportStatus.ts` owns `draft`, `submitted`, `under_review`, `changes_requested`, `approved`, `flagged`, plus derived `not_started` / `due_soon` / `overdue` and the reporting-period cycle. The overdue count on this page uses that module, not the inline six-month arithmetic currently in `AdminDashboardPage.tsx`.

## Data Model Changes

- **`schools` gains `province` and `district`** (both `text`, nullable). Real columns, entered on the school create and edit forms. Everything geographic on this page reads these and nothing else; a school with a null province groups under an explicit "Province not recorded" row rather than being silently dropped. The derived `province` / `district` in `schoolProfile.ts` stop being used by any screen that shows geography as fact.
- **No other schema change.** Committed-this-year, annual gap, province rollups and the twelve-month trend are all derivable from `scholarships`, `donor_contributions`, `student_coverage`, `donor_balance` and `schools` as they now stand.
- **"Spent" is not available and is not claimed.** `scholarship_payments` exists but nothing writes it, so disbursement is unknown. The yearly figure is labelled **Committed this year** — the prorated sum of active scholarships whose coverage window overlaps the current year. Payment tracking is out of scope.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| `AdminDashboardPage` | Modify | Rebuilt around the new bands. Loses the four Add buttons and the inline overdue arithmetic. |
| `FundingSummaryBand` | New | The money headline: committed this year against annual gap, decomposed into free / committed / uncovered students, with the `need_unknown` caveat line. Built on `SectionCard` + `StatCard`. |
| `MetricTile` | Dropped | `KpiItem` already carries `label`, `value`, `mark`, `footnote` and `onClick`. Building a second tile beside it would have been a second KPI look. |
| `OperationBand` | Dropped | Same reason — the band is `KpiRow` with five linked items, not a new component. |
| `ProvinceTable` | New | Province, schools, students, monthly covered, monthly gap, sorted by gap descending. `DataTable`. Rows link to schools filtered by province. |
| `FundingTrendChart` | New | Twelve months, contributions received vs allocated. Hand-authored SVG, two series, no library. |
| `ActionQueue` | New | Allocate idle funds / verify reports / answer requests, each with a count, each hidden at zero. Renders nothing when all three are clear. |
| `DashboardExportButton` | New | CSV of the rows behind the page. Follows the `AdminStudentsPage` export shape. |
| `dashboardMetrics.ts` | New | One module owning every query and derivation on this page, so the numbers cannot disagree with the directories. |
| `SchoolForm` / `AdminEditSchoolPage` | Modify | `SchoolForm` already collected province and district and flattened them into the address; it now writes the columns too. `AdminEditSchoolPage` gains both fields, which it never had. Each write narrows on a missing-column error so a deploy ahead of its migration still saves. |
| `AdminStudentsPage` | Modify | `Focus` gains `gap` and `need-unknown`, and focus moves into the URL (`?focus=`) with a removable chip naming it. |
| `AdminSchoolsPage` | Modify | Reads the real `province` / `district` columns instead of the derived pair; accepts `?province=` (and `?province=none`). |
| `AdminReportsBetaPage` | Modify | Status filter moves into the URL (`?status=`). |
| `schoolProfile.ts` | Modify | Derived `province` / `district` deprecated in favour of the real columns; kept only for screens not yet migrated, and marked. |
| `HeroSection` | Exists | Stays at the top, unchanged. |
| `KpiRow`, `SectionCard`, `StatCard`, `PageHeader`, `DataTable`, `Badge`, `Banner`, `Button`, `EmptyState`, `LoadingState`, `Tooltip` | Exists | Used as-is. |

## Key Interactions

- **Arriving.** The page loads band by band rather than behind one blocking spinner: the money band resolves first because it is why the admin came; operation counts, province table and trend fill in beneath. Each band shows a skeleton in its own footprint, so nothing reflows once loaded.
- **Following a number.** Every `MetricTile` and every province row is a link. "12 uncovered students" opens the students directory already filtered to a gap above zero; "7 overdue reports" opens reports filtered to overdue; a province row opens schools filtered to that province. The destination shows its filter as a removable chip, so the admin can see where they came from and widen out.
- **The caveat.** The annual gap carries a quiet line beneath it: *N students have no recorded need.* It is a link too — to those students — because the fix for the caveat is recording the need.
- **The queue.** Each action states its count and its verb: *Allocate 84,000 THB idle across 3 donors*. At zero the row is not rendered; when all three are zero the queue is absent entirely rather than showing three proud zeroes.
- **Exporting.** One press starts the export, the button goes disabled with a working label, and a CSV downloads containing the rows behind the page — funding summary, per-province rollup, per-student coverage, per-donor balance — as labelled sections in one file. Failure surfaces as an `InlineMessage` in the page, not a silent no-op.
- **The trend chart.** Hover a month to read exact received and allocated figures; the chart is also given as a table to screen readers, so the numbers are not locked inside a picture.

## Responsive Behavior

- **Desktop (≥1200px)**: money band full width with the decomposition inline; operation tiles five across; province table and trend chart side by side, table wider.
- **Tablet (768–1199px)**: operation tiles wrap to three; province table and trend stack, table first — the table answers more than the chart does.
- **Mobile (<768px)**: money band stacks headline over decomposition; tiles go two across; the trend chart drops to a compact form with fewer labelled ticks; the province table becomes a stacked list of province cards rather than a horizontally scrolling grid. The action queue moves above the operation band on mobile, because a phone screen shows one thing at a time and the queue is the actionable one.

## Accessibility Requirements

- Contrast 4.5:1 for text, 3:1 for large text and for the chart's series strokes against the surface.
- Coverage state is never carried by colour alone — funded / partial / uncovered each carry a label or a value beside the tone.
- Every tile and province row is a real link, reachable by keyboard in visual order, with a visible focus ring using the existing focus token. A tile is one tab stop, not one per element inside it.
- The trend chart has an accessible name, a text summary, and an equivalent data table available to assistive technology.
- Loading skeletons are `aria-busy` regions; the export button announces its working and finished states via a live region.
- Touch targets 44×44px minimum on mobile — relevant for the tiles, which are otherwise dense.
- Respect `prefers-reduced-motion`: the trend chart draws without animation, skeletons do not shimmer.

## Out of Scope

- **The map.** Province becomes a real column and ships as a table. A choropleth is a later feature, once provinces are entered on real schools and there is something true to draw.
- **Payment / disbursement tracking.** `scholarship_payments` stays unwritten; "committed" is not upgraded to "spent" here.
- **A superadmin or board role.** The page is gated by the existing `is_admin()`. No action on it is load-bearing, so a read-only board view is a later trim, not a rebuild.
- **Creating records.** No Add buttons, no drawers. `StudentFormDrawer` comes off this page; creation stays in the directories.
- **PDF export.** CSV only.
- **Per-donor drill-down on this page.** The dashboard aggregates; `AdminDonorDetailPage` is where a single donor is read.
- **Backfilling province onto existing schools.** The migration adds the column; filling it is admin data entry, not a data migration.

---

# Design Brief v2: Ledger + KPI band + today's rail

Written after the Crazy 8s. Concept 1 (Ledger) was chosen, with two changes: a
KPI band above the money, and a right-hand rail holding the work waiting today.
Everything in v1 above still stands unless contradicted here.

## What changed, and why

**The KPI band moves to the top.** v1 argued money should lead because it is the
question the admin arrived with. That was half right: money is the question they
arrived to *decide*, but it is not the first thing a person needs in order to
read a page. The counts are the orienting glance — 142 students, 18 schools, 24
teachers, 46 donors, 118 scholarships — and they tell you the size of the thing
the money figures are about. ฿112,800 uncovered means one thing across 20
students and another across 142. So: counts, then money.

**The action queue becomes a rail.** In v1 the queue was a horizontal band of
three tiles sitting between the money and the counts, and it had a structural
problem: three tiles can hold three counts, and a count is not a piece of work.
"4 reports to verify" is a number you have to open something else to act on. A
rail is a column, and a column holds *items* — this report, from this teacher,
about this child, waiting this long. That is the difference between a dashboard
that reports the work and one you can work from.

**Reports lead the rail.** They are the only items with someone on the other end
of them: a teacher who wrote a report and a donor who has not received it. Idle
money and unanswered contact requests are real work too, but nobody is blocked
on them in the same way.

## Problem

An admin lands on the page, reads the state, agrees with it, and then has to go
somewhere else to do anything. The counts describe; they do not offer. And the
thing most often waiting — a teacher's report sitting unread, invisible to the
donor it was written for until somebody opens it — is represented on the page as
the digit 4.

Meanwhile the money figures, arriving first, land before the reader knows how
big the programme is. The number is exact and the sense of scale is missing.

## Solution

Three columns of attention, in reading order.

**A KPI band across the top.** Five counts, each a link into its directory.
Nothing here is a decision; it is the shape of the operation, read in two
seconds and then mostly ignored — which is the correct amount of attention for a
number that changes twice a month.

**The money band beneath it**, unchanged from v1: committed this year against
the annual gap, decomposing into received, unallocated, students short, and need
not recorded, with the caveat line stated on the page rather than implied.

**A rail down the right**, headed *Today*, holding the actual work as items
rather than counts. Reports awaiting verification come first — student, teacher,
and how long the report has been waiting — then idle money and unanswered
contact requests. Everything open is in the list, ranked by how long it has
waited, so nothing falls out of view for the crime of having arrived yesterday.
The rail is why the standalone action-queue band disappears; the province table
and the trend chart move under the money band in the main column.

## Experience Principles

Carrying forward the three from v1, with one sharpened:

1. **Every number is a door** — unchanged.
2. **Say what the number excludes** — unchanged.
3. **Counts describe, items act** — a figure in the main column tells you what is
   true; a row in the rail is one thing you can finish. Nothing in the rail is a
   count you must open something else to act on, and nothing in the main column
   pretends to be a task.

## Layout

```
┌──────────────────────────────────────────────┬──────────────┐
│  KPI band — 5 counts, each linked            │  TODAY       │
├──────────────────────────────────────────────┤              │
│  Funding — committed vs gap, decomposed      │  Verify ·    │
│                                              │   Mali S.    │
├──────────────────────────────────────────────┤   9 days     │
│  Where we work — provinces by gap            │              │
│                                              │  Verify ·    │
├──────────────────────────────────────────────┤   Nan P.     │
│  Received against allocated — 12 months      │  ──────────  │
│                                              │  Allocate    │
└──────────────────────────────────────────────┴──────────────┘
```

- Rail is a fixed 320px on ≥1200px, sticky below the page header so it stays
  with the reader as the main column scrolls.
- 768–1199px: the rail drops beneath the KPI band as a full-width section, above
  the money band — it stays high because it stays actionable.
- <768px: single column, rail first, then KPIs two across, then money, provinces
  as cards, trend last. Consistent with the v1 mobile rule.

## The rail's contents

**Order** — everything open, sorted by how long it has waited, longest first.
Not "arrived today": a report submitted nine days ago and still unread is more
today's problem than one that arrived this morning. The heading is *Today*
because it is today's work, not today's arrivals.

**Report items** carry the student's name, the teacher who submitted, the school,
and the wait in days. Status is `submitted` or `under_review` — an approved
report is finished work and does not appear. A flagged report outranks
everything, because a donor asked a question and is waiting on a person.

**Money and requests** follow the reports, as one item each: *Allocate ฿84,000
across 3 donors*, *Answer 3 contact requests*. These stay counts because they
genuinely are one action apiece.

**Empty state** — when nothing is open the rail says so in one line and the main
column widens to fill. An empty rail is information, and it should feel like
finishing, not like a broken panel.

## Component Inventory (delta from v1)

| Component | Status | Notes |
| --- | --- | --- |
| `TodayRail` | New | The right column. Ordered items, sticky, its own empty state. |
| `RailItem` | New | One row: kind marker, title, subtitle, wait, whole row is a link. 44px minimum height. |
| `ActionQueue` | Retire | Superseded by the rail. Its three items become rail items. |
| `AdminDashboardPage` | Modify | Two-column shell; band order becomes KPIs, money, provinces, trend. |
| `dashboardMetrics.ts` | Modify | Gains `loadTodayItems()` — open reports with student, teacher and school names joined, plus the money and request items, sorted by wait. |
| `FundingSummaryBand`, `ProvinceTable`, `FundingTrendChart` | Exists | Unchanged; they move within the shell, not within themselves. |
| `KpiRow` | Exists | Now the top band. Same five linked items. |

## Data

Reports for the rail come from `term_updates` filtered to `submitted` /
`under_review`, joined to `students` for the name and school and to `profiles`
for the submitting teacher — the same shape `AdminReportsBetaPage` already
builds. Wait is `now − created_at` in days. Flagged reports are identified by
`flagged_at` with no `flag_resolved_at`, which `reportStatus.ts` already treats
as outranking every other state.

No schema change. The `flagged` vocabulary, the report statuses and the
reporting cycle are all already defined.

## Accessibility

- The rail is a `<nav aria-label="Today">` containing a list; each item is one
  tab stop and one link, not a nested set of controls.
- Wait times render as text ("9 days waiting"), never as colour alone.
- The sticky rail must not trap focus or scroll; at 768px it stops being sticky.
- Items keep the 44×44px touch minimum on mobile, where the rail is the first
  thing under the page header.

## Out of Scope

Everything v1 excluded, plus:

- **Acting inside the rail.** An item links to the screen that owns the work; it
  does not approve a report or allocate money in place. A verification decision
  is deliberate and belongs on `ReportVerifyPage`.
- **Live updates.** The rail is what was true when the page loaded. No polling,
  no websocket.
- **Per-user assignment.** "Today" is the organisation's open work, not a queue
  assigned to the signed-in admin. There is no assignee field to build it on.
