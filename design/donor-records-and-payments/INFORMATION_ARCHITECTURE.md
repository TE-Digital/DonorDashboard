# Information Architecture: Donor records and payments

Scope: the admin side of donors: the list, the overview, the add/edit drawer, and recording payments. It extends the existing admin IA; nothing here adds a top-level section. Read alongside [DESIGN_BRIEF.md](DESIGN_BRIEF.md).

**Audience.** Admins only. Donor login is unchanged and out of scope (see the brief). Agents, teachers and donors get no new entry points from this work.

**The 80% view is the donors list.** Most donor work is scanning (who has given, whose money is sitting unallocated, who runs short next month) and acting on one row without leaving the table. The overview is opened for one donor at a time. The list therefore carries the actions, filters and at-a-glance columns; the overview carries depth.

## Site Map

Admin area, donor section. Everything shown already exists except where marked.

- Admin `/admin`
  - Donors `/admin/donors` ← **primary view**
    - Add donor (drawer over the list) `/admin/donors?add=1` ← *new: replaces the page*
    - Donor overview `/admin/donors/:donorId`
      - Overview tab `/admin/donors/:donorId` (default; `?tab=overview` also accepted)
      - Payments tab `/admin/donors/:donorId?tab=payments` ← *new tab*
      - Students tab `/admin/donors/:donorId?tab=students` ← *new tab*
      - Edit donor (drawer over the overview) `/admin/donors/:donorId?edit=1` ← *new: replaces the page*
      - Record payment (drawer over the overview) — local state, not in the URL (see URL Strategy)
      - Allocate (panel over the Students tab) — local state, not in the URL (existing `AllocationPanel`)
  - Retired routes, kept as redirects:
    - `/admin/donors/new` → `/admin/donors?add=1`
    - `/admin/donors/:donorId/edit` → `/admin/donors/:donorId?edit=1`

Neighbouring sections this touches, all unchanged in structure:

- Students `/admin/students/:studentId`: gains links to the donors who fund each student (see User Flows → From a student to their donors).
- Field reports `/admin/reports`: its existing `scholarship_awards.donor_id` link into donors keeps working.
- Admin overview `/admin/dashboard`: its "Allocate ฿X" action already links to `/admin/donors?balance=idle`. Today that link is dead; this work makes it land on a filtered list (see URL Strategy).
- Global search (⌘K, top bar): donor results currently open `/admin/donors/:id/edit` and match on `name` only. They'll open the overview instead, and also match email and contact person, because the donors list has no search box of its own.
- Scholarships `/admin/scholarships`: unchanged. A scholarship is a commitment, not a payment, and stays in its own section.

## Navigation Model

- **Primary navigation (sidebar)**: **unchanged.** `Donors` (wallet icon) already sits in the giving group beside `Requests` in `AppShellLayout`. No new sidebar item: payments are per-donor (decided), so a global "Payments" entry would lead nowhere yet. The sidebar highlights `Donors` for every URL under `/admin/donors`, including the overview and any open drawer.
- **Secondary navigation (tabs)**: the overview has three tabs, following `AdminTeacherOverviewPage` and `AdminStudentOverviewPage`: **Overview · Payments (count) · Students (count)**. Tabs are the only secondary navigation, with no sidebar sub-items and no second level of tabs. While the Edit drawer is open, the tabs stay visible behind the scrim and aren't disabled; the drawer is modal, so they can't be reached anyway.
- **Contextual navigation**:
  - Overview header: **Edit** (secondary) and **Record payment** (primary, the one blue button).
  - Students tab: **Allocate** (opens `AllocationPanel`).
  - Donors list: **Add donor** (primary, page header), and a row action menu **⋯ → Record payment · Edit · Open donor**.
  - Back: the overview has no explicit back button, matching the teacher overview. The sidebar and browser back return to the list. Column filters are local `TableSection` state and reset on return, as on every other list. Only a filter that arrived by link (`?balance=idle`, `?type=`, `?country=`, `?phone=invalid`) is restored, because only that lives in the URL.
- **Drawers are not navigation.** Add, Edit and Record payment open over the current page and return to exactly where you were. None of them change the page underneath, and none stack: Record payment isn't reachable from inside the Edit drawer.
- **Utility navigation**: unchanged (Accounts, Settings).
- **Mobile navigation**: unchanged app-shell behaviour (collapsible side nav). On the overview, the three tabs scroll horizontally if they don't fit. Drawers go full-screen at ≤640px, with the action bar pinned.

## Content Hierarchy

### Donors list `/admin/donors` (primary view)

1. **KPI row**: Donors · Actively giving · Students supported · Unallocated · Short next month. Existing, unchanged. It answers "is anything wrong across all donors?" before any row is read.
2. **Filter bar**: there's **no per-table search box**. Finding one donor by name is the global search's job (top bar, ⌘K), a platform decision recorded at the top of `TableSection`. Narrowing uses **column filters**, which `TableSection` builds automatically from each column's `filterValue`: **Type**, **Country**, and **Unallocated** (has money / none). A **Phone needs fixing (n)** control appears on the filter bar while any stored number fails validation, and sets `?phone=invalid`. A filter that arrived by link shows as a removable Lumen `Tag` (`onRemove`) above the table, exactly as the schools list does for `?province=`.
3. **The table**, one row per donor:
   - **Name**, with an Organisation badge where applicable, and the contact person on a second line for organisations.
   - **Contact** (email; phone on hover or second line).
   - **Country** (*new*).
   - **Students supported**.
   - **Given** (THB).
   - **Unallocated** (THB, warning tone when idle).
   - **Last payment** (*new*: date, replacing "Last scholarship" as the default-visible column, since "when did money last arrive" is the question the list is scanned for).
   - **⋯ row actions**.
4. **Secondary columns**: Agent and Last scholarship stay, moved to the end of the row. `TableSection` has no column hiding, so no column is optional. That makes ten columns, so check the table's width at 1280px during build before adding any more.
5. **Empty state**: "No donors yet", with **Add donor**.

### Donor overview `/admin/donors/:donorId`

1. **Header**:
   - Name (organisation name for organisations), an **Individual / Organisation** badge, and the actions **Edit** and **Record payment**. Identity and the two most common acts come first.
   - Subtitle: *contact person (organisations) · country · email · language*, so the admin can confirm they're on the right donor without opening a tab.
   - A neutral notice, only when relevant: *"Report emails are off for this donor."* or *"No email — reports can't be sent."* It's shown above the fold because it changes what happens the next time a report is sent.
2. **KPI row**: **Total given · Unallocated · Students funded · Last payment**. Money is always visible regardless of tab.
3. **Tabs**, defaulting to **Overview**:
   - **Overview**: field-grid sections, in order:
     - **Contact**: email, phone (national format with country code), other contact, address.
     - **Donor**: type, contact person, agent, country.
     - **Preferences**: report emails (On / Off), newsletter, preferred language, and dashboard access.
     - **Internal note**.
   - **Payments**: `ContributionsTable`, newest first. Each row shows date received, amount (THB), method and reference. Each row has **Edit** and **Void** (both existing). Voided rows are kept, struck through and greyed. Empty state: *"No payments recorded"*, with **Record payment**.
   - **Students**: the funded-students table from `scholarships` (student, monthly amount, coverage window, status Active / Ended), with **Allocate**, and the unallocated balance repeated beside the Allocate button, since that's the figure the admin is spending. Active rows first, ended rows beneath. Existing donors' history appears here only because old awards are migrated into `scholarships` first, so that migration must run before this tab replaces the edit page. Empty state: *"Not funding anyone yet"*, with **Allocate** (disabled with a reason when there's no unallocated balance: *"Record a payment first — there's nothing to allocate."*).

### Add / Edit donor drawer

1. **Donor type** (Individual · Organisation), first because it reshapes the fields below it.
2. **Donor**: name or organisation name, contact person (required for organisations), agent.
3. **Contact**: email (required for new donors), country (optional), phone (prefixed from country, or typed with + when there's none), other contact, address.
4. **Preferences**: preferred language (English · Thai), send report emails, newsletter, dashboard access.
5. **Internal note**: last, because it's never seen by the donor and is rarely filled on creation.
6. **Pinned action bar**: Cancel · **Create donor** / **Save changes**, with the validation summary beside the button.

### Record payment drawer

1. **Amount (THB)**: the fact being recorded.
2. **Date received**, defaulting to today.
3. **Method** · **Reference**: how it arrived, for reconciliation.
4. **Internal note**.
5. **Pinned action bar**: Cancel · **Record payment**.

## User Flows

### Add a donor

1. Admin is on **Donors** `/admin/donors`.
2. Admin presses **Add donor**. The drawer opens over the list and the URL becomes `?add=1`.
3. Admin chooses **Individual** or **Organisation**.
   - If **Organisation** → the name label becomes *Organisation name*, and **Contact person** appears.
4. Admin fills Contact. Country is optional; choosing one sets the phone prefix, and without one the phone must start with +.
5. Admin presses **Create donor**.
   - If **invalid** → every problem field is marked, the summary appears by the button, and focus moves to the first problem. The admin stays in the drawer.
   - If the **email matches another donor** → a blocking error names that donor with a link. Following it closes this drawer, after confirming if anything was typed, and opens that donor's overview.
   - If **valid** → the drawer closes, `?add=1` is removed, and the list reloads with the new row highlighted. A notification appears: *"Acme Foundation added"*, with **Open donor**.
6. The admin either carries on scanning the list, or presses **Open donor** to go to `/admin/donors/:id`.

### Record a payment from the list (the reconciliation path)

1. Admin is on **Donors** with a bank statement open.
2. Admin finds the donor's row by sorting, a column filter, or paging, then chooses **⋯ → Record payment**. (Found through ⌘K instead, the admin lands on the overview and uses **Record payment** in its header.)
3. The payment drawer opens **over the list**, with no navigation.
4. Admin types the amount in THB, as credited on the statement, and the date received.
5. Admin presses **Record payment**. The drawer closes, the row's *Given*, *Unallocated* and *Last payment* update in place, and the list keeps its scroll position and filters.
6. Admin moves to the next statement line.

### Record a payment from the overview

1. Admin is on `/admin/donors/:id` on any tab.
2. Admin presses **Record payment** in the header.
3. Steps 4–5 are as above. On save, the KPI row updates, and if the admin isn't on the Payments tab, the notification offers **View payments** (→ `?tab=payments`).

### Edit a donor

1. Admin is on `/admin/donors/:id`.
2. Admin presses **Edit**. The drawer opens pre-filled, the URL gains `?edit=1`, and any `?tab=` is kept.
3. Admin changes fields.
   - If the **email changes** → the duplicate check excludes this donor's current address.
   - If **Send report emails** is turned off → the next report email leaves this donor out.
   - If the stored **phone doesn't validate** → the field shows it with an error, and saving is blocked until it's fixed or cleared.
4. Admin presses **Save changes**.
   - If **invalid** → same as Add.
   - If **valid** → the drawer closes, `?edit=1` is removed, and the header, KPI row and Overview tab update in place. The admin stays on the tab they were on.
5. An old bookmark to `/admin/donors/:id/edit` lands at step 2.

### Allocate unallocated money

1. Admin is on `/admin/donors/:id?tab=students`, or opens the Students tab.
2. Admin presses **Allocate**, and the existing `AllocationPanel` opens.
   - If the **unallocated balance is zero** → Allocate is disabled with its reason. **Record payment** is the way forward.
3. Allocation proceeds as defined in the `donor-funding-and-allocation` brief, and the Students tab and KPI row refresh.

### From a student to their donors *(new entry point)*

Today no student screen names the student's donors. The Scholarships tab reads `scholarship_awards`, and its rows carry no donor field. This flow adds them.

1. Admin is on `/admin/students/:studentId`, Scholarships tab.
2. A **Funded by** line above the scholarships table names each active donor. The names come from the `student_donors` view (one row per active commitment, with `donor_id` and `donor_name`), which **exists only once the funding migration is applied**.
   - If there's **no active donor** → "Not funded by any donor", in neutral tone, with no link.
3. Each name links to `/admin/donors/:donorId?tab=students`, landing on the tab that shows this student in context.

## Naming Conventions

| Concept | Label in UI | Notes |
| --- | --- | --- |
| A person or body that gives money | **Donor** | Never "sponsor", "funder" or "giver". Matches the sidebar, table and routes. |
| Donor kind | **Individual** / **Organisation** | British spelling, matching "Organisation" across the platform (e.g. `DonorProfileTab`). The field label is **Donor type**. |
| Person to address at an organisation | **Contact person** | Not "representative" or "primary contact". |
| Money received from a donor | **Payment** | UI word everywhere: "Record payment", "Payments" tab, "Last payment". **This is a rename.** The screens built on this branch say *contribution* today, in 14 user-visible strings across `ContributionDrawer` (title, button, error), `ContributionsTable` (section title, empty states, void dialog, row icon labels, error), `DonorBalanceCard` (empty states), `donorMoney.ts` (save errors) and the dashboard's CSV export ("Contributions recorded this year"). All of them change. `donor_contributions`, the `Contribution` type and the component file names stay; they're code, and the UI never shows them. |
| Recording one | **Record payment** | Not "Add payment", "Log" or "New contribution". "Record" says the money already arrived; iCare doesn't collect it here. |
| Total received | **Given** / **Total given** | The existing list column is *Given*; the overview KPI is *Total given*. |
| Money received but not yet committed to a student | **Unallocated** | Existing term (list KPI, list column, `DonorBalanceCard`). Never "free balance" in the UI; `free_balance_thb` is the column name only. |
| Committing money to a student | **Allocate** | Existing term (`AllocationPanel`). |
| A payment's amount | **Amount (THB)** | Existing field label. Payments are THB only. |
| Whether a donor gets report emails | **Send report emails** (field, the existing `wants_email_updates`) / **Report emails off** (display) | Replaces the old label *Wants email updates*. Not "unsubscribe", which implies a link in the email that doesn't exist yet. |
| Where a donor lives | **Country** | |
| Report language | **Preferred language** | Existing label; English · Thai only. |

## Component Reuse Map

| Component | Used on | Behavior differences |
| --- | --- | --- |
| `AppShellLayout` + `SideNav` | All admin pages | None. `Donors` is active for every `/admin/donors*` URL. |
| `TableSection` | Donors list; Payments tab; Students tab | The list has KPIs, filters, search and row actions. The tabs have no KPIs and no filters, just sort and an empty state. |
| `KpiRow` | Donors list; donor overview | The list shows aggregates across donors (5 items). The overview shows one donor's figures (4 items). |
| `Tabs` | Donor overview (and, already, teacher, student and school overviews) | Donors copy the student overview's URL-backed `?tab=` pattern with `replace`, not the teacher overview's local state, so a link can target a tab. |
| Overview header (`<h1>` + `Badge` + actions) | Teacher overview, student overview, donor overview | The donor badge is the type (Individual/Organisation), where teachers' is the role. The donor header has two actions; the teacher header has access actions. |
| Field-grid sections | Teacher overview, donor Overview tab | Identical layout; donor sections are Contact · Donor · Preferences · Internal note. |
| `FormDrawer` | Student, teacher and school drawers; **donor drawer**; **payment drawer** | Donor: size 880, like the student drawer. Payment: narrower (~560) since it's one column. Neither uses breadcrumb steps: the donor drawer creates nothing else mid-flow. |
| `DonorForm` | Add drawer, Edit drawer | Edit pre-fills, excludes the donor's own email from the duplicate check, and labels the button *Save changes*. |
| `ContributionDrawer` (payment drawer) | Donors list row action; overview header; Payments-tab row **Edit** | Identical form in all three, with its two existing modes (record and edit). Only its wording changes, from *contribution* to *payment*. On the list it updates the row in place; on the overview it updates the KPI row and offers *View payments*. |
| `AllocationPanel` | Donor Students tab | Unchanged, but opened from the tab now rather than the page body. |
| Row action menu (`⋯`) | Students list (existing); donors list | Copy the students list exactly: an `actions` column holding a Mantine `Menu` behind `IconDotsVertical`, wrapped in `styles.rowActions` with `stopPropagation` so opening the menu doesn't also open the row. Lumen has no menu component of its own. |

## Content Growth Plan

| Content | Grows? | How the IA holds it |
| --- | --- | --- |
| **Donors** | Yes, steadily (tens → low hundreds) | The list is already paginated (`TableSection`: 25/50/100/250). Column filters (Type, Country, Unallocated) narrow before scrolling, and finding one donor by name goes through global search. Column filters are local state and reset when you leave the page. That's how every list behaves, and changing it for donors alone would make one table behave unlike the rest. |
| **Payments per donor** | Yes: roughly monthly per active donor, so dozens per donor within a few years | The Payments tab is paginated newest-first, with the tab count in the label. Grouping by year is the next step when any donor passes ~50 payments. No global ledger yet (decided); `/admin/payments` is reserved for when reconciliation volume needs one. |
| **Students per donor** | Slowly (a handful) | Plain table; no pagination needed. |
| **Countries** | Fixed (ISO list) | Searchable select, with Thailand pinned first. |

## URL Strategy

- **Pattern**: `/admin/donors` (list) and `/admin/donors/:donorId` (one donor). There are no deeper path segments: tabs and drawers are query parameters, because they're states of a page, not pages. This matches the existing `/admin/students/:studentId?tab=` convention.
- **Dynamic segments**: `:donorId`, the UUID. It's the only path parameter.
- **Query parameters**:

  | Parameter | On | Values | Behavior |
  | --- | --- | --- | --- |
  | `tab` | Overview | `overview` · `payments` · `students` | Written with `replace` (no history entry per tab click), as `AdminStudentOverviewPage` does. Unknown or absent → Overview. |
  | `add` | List | `1` | Opens the Add drawer. Removed on close or save. The target of the `/admin/donors/new` redirect. |
  | `edit` | Overview | `1` | Opens the Edit drawer, and keeps any `tab`. Removed on close or save. The target of the `/admin/donors/:id/edit` redirect. |
  | `balance` | List | `idle` | **Already sent by the dashboard** and **currently ignored**. The "Allocate ฿X" action links to `/admin/donors?balance=idle`, but `AdminDonorsPage` doesn't read the URL, so the link lands on the unfiltered list. Reading it fixes that dead link. `idle` means `free_balance_thb > 0`, the dashboard's own definition in `dashboardMetrics`. |
  | `type` | List | `individual` · `organisation` | Entry filter, set by links. |
  | `country` | List | ISO alpha-2, e.g. `GB` | Entry filter, set by links. |
  | `phone` | List | `invalid` | Entry filter for **Phone needs fixing**: donors whose stored phone doesn't validate. Set by the filter-bar control and shown as a removable `Tag`. |

- **List filter params are one-way.** Like `?province=` on schools, they're read on arrival and shown as a removable `Tag`, and removing the tag deletes the param with `replace`. Ticking a column filter inside the table doesn't write to the URL. There's no search param: search is global.
- **Deliberately not in the URL**: the **Record payment** drawer and the **Allocate** panel. Both are short, write-once acts whose half-filled state shouldn't survive a reload or be shareable as a link. A refreshed or shared URL would open an empty money form with nothing to show for it. Add and Edit are in the URL only because old routes must redirect into them.
- **Redirects**: `/admin/donors/new` and `/admin/donors/:donorId/edit` stay as routes, rendering `<Navigate replace>` to their query-parameter equivalents, so bookmarks keep working. Internal links are updated to the new targets rather than left to the redirect: the overview's Edit button, the old create page's post-save redirect, and **global search**, which today sends every donor result to `/edit`. Left alone, searching for a donor would open the edit drawer.
- **Reserved**: `/admin/payments`, for a future cross-donor ledger. Not built now.
