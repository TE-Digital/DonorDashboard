# Design Review: Donor records and payments

Reviewed against: DESIGN_BRIEF.md (with INFORMATION_ARCHITECTURE.md and TASKS.md)
Philosophy: Lumen, unchanged. Calm and administrative.
Date: 2026-09-11

Method: a static build of the `design` branch, every Supabase request answered by fixture data (a fake admin session, no database, nothing saved). Three donors: an organisation with a full record, an individual with no email and an unfixable old phone, and a UK individual. Eleven views at three widths, a keyboard pass on the add drawer, a dark-mode probe, an axe-core WCAG 2 A/AA scan of every desktop view, and per-shot measurements of horizontal overflow, touch targets under 44px, input font size and font loading.

## Screenshots Captured

All in `design/donor-records-and-payments/screenshots/`.

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `review-donors-list-{mobile-375,tablet-768,desktop-1280}.png` | 375 / 768 / 1280 | Donors list: KPI strip, *Phone needs fixing (2)*, Type/Country/Contact columns, row menu |
| `review-add-donor-drawer-{…}.png` | all three | Add donor drawer, Individual, empty |
| `review-add-donor-organisation-errors-{…}.png` | all three | Organisation chosen, Create donor pressed empty: three errors, summary in banner and footer |
| `review-add-donor-focus-desktop-1280.png` | 1280 | Where focus lands when the drawer opens from the keyboard |
| `review-donor-overview-{…}.png` | all three | Overview tab: header, badge, subtitle, KPI row, field grids |
| `review-donor-overview-dark-mode-desktop-1280.png` | 1280 | `prefers-color-scheme: dark`: no change (Lumen has no dark palette) |
| `review-donor-payments-{…}.png` | all three | Payments tab: ledger with a voided row |
| `review-donor-students-{…}.png` | all three | Students tab: *Unallocated: ฿60,000*, Assign students, active before ended |
| `review-edit-donor-drawer-{…}.png` | all three | Edit donor · Somchai Prasert: no-email warning, *Thailand · +66*, bad old phone |
| `review-record-payment-drawer-{…}.png` | all three | Record payment drawer |
| `review-send-dialog-{…}.png` | all three | Send this report: Add recipients, a donor with no address, recipient tabs, 375px email frame |
| `review-reports-waiting-{…}.png` | all three | Reports beta on *Waiting to send* |
| `review-waiting-dialog-{…}.png` | all three | Waiting to send · Mali's report: one waiting donor, one refused address |

## Summary

The structure the brief asked for is there and it holds together. Add and edit are one drawer in the student and teacher shape, the Individual/Organisation choice reshapes the form, validation marks every field at once with sentences that say how to fix it, and the overview reads like a teacher's. The biggest problem is the one thing the overview exists to show: **the money figures are truncated at every width**, and on a phone the KPI tiles show labels with no numbers at all. Close behind: tables on a phone clip their columns with no way to reach them, and a handful of contrast and labelling failures from axe.

## Must Fix

1. **The overview's money figures are cut off, and gone on a phone.** At 1280 *Unallocated* reads "฿…" and *Last payment* "2 Sep 2…"; at 768 the same; at 375 all four tiles show only their label (*Total given*, *Unallocated*, *Students funded*, *Last payment*) with no figure. The donors list's five tiles do the same ("Actively giving", "Students supported", "Unallocated" with no values). See `review-donor-overview-desktop-1280.png`, `review-donor-overview-mobile-375.png`, `review-donors-list-desktop-1280.png`. Cause: the strip `KpiCard` in `src/design-system/lumen/data.tsx:851–905` deliberately truncates the value before the label, which suits a long scholarship name but not a baht amount or a date, the only reason these tiles exist. _Fix: for these pages, use the stacked KpiCard (value above label, full width of the tile), or add a `keepValue` option to the strip variant that truncates the label and footnote first. Shorten the donors list's tile labels too. Then check the brief's layout: four across at desktop, 2×2 at tablet (today it wraps 3 + 1, `review-donor-overview-tablet-768.png`)._

2. **Donor avatar initials fail contrast at 1.98:1.** "AF" is Mantine's placeholder grey `#868e96` on the pink `profileAvatarStyle` ground (`AdminDonorDetailPage.tsx:416`). _Fix: set the initials colour in `profileAvatarStyle` (`src/design-system/profileAvatar`) to `var(--text-heading)`. It's shared, so the student and teacher overviews are fixed with it._

3. **Tables on a phone clip their columns and can't be scrolled.** On the donors list only Name and half of Type show; Country, Contact, Given and the *needs fixing* phone flag are unreachable. On the Students tab only the student's name shows, with no amount, coverage or status (`review-donors-list-mobile-375.png`, `review-donor-students-mobile-375.png`). Horizontal overflow measures 0, so the page isn't scrolling either: the columns are simply gone. The brief says *"tables scroll inside their own container"*. _Fix: in `DataTable`, give the table wrapper `overflow-x: auto` below 640px (or a card layout per row). This is task 1.17; it affects Reports beta too, where 1.15 worked around it with the pinned **Waiting to send** status._

4. **Unlabelled controls (axe, critical).** The DataTable column-settings button in the last header cell has no accessible name (`button-name`, donors list and Payments tab), and the *Rows per page* `<select>` has no label (`select-name`). _Fix: `aria-label="Choose columns"` on the header button, and `aria-label="Rows per page"` on the select in `Pagination`. Both are in `src/design-system/lumen/data.tsx`, so every table is fixed._

## Should Fix

1. **Focus goes to Close, not to the donor type, when the drawer opens.** The keyboard pass shows focus on the ✕ button (`review-add-donor-focus-desktop-1280.png`); the brief says focus goes to the Individual/Organisation toggle. Escape closes and focus returns to **Add donor**, as specified. _Fix: `data-autofocus` on the selected type radio in `DonorForm`, which Mantine's Drawer honours._

2. **Small text below 4.5:1.** "Contact: Jane Smith" under a donor's name (`AdminDonorsPage.tsx:320`, Mantine `c="dimmed"`, `#868e96`, 3.32:1), and the 12px `--text-subtle` `#857c72` KPI footnotes and filter chips (4.09:1). _Fix: `c="var(--text-muted)"` on the subline. Darken `--text-subtle` in `tokens.css` or stop using it below 14px. Sidebar section labels (`#aca49b`, 2.25:1) and the workspace name are shell-wide and pre-existing, but belong in the same pass._

3. **Touch targets under 44px on a phone.** The overview tabs are 34px tall; table header sort and filter controls are 24×24; the nav toggle is 26×26; the send dialog's recipient tabs are 36px (`review-send-dialog-mobile-375.png`). _Fix: `min-height: 44px` on `Tabs` below 640px, and a larger hit area (padding, not a larger icon) on header controls. The brief's out-of-scope note covers Mantine buttons, not these._

4. **Inputs are 14px on a phone.** iOS zooms the page when a field under 16px is focused, which will happen on every tap in the drawers. _Fix: `font-size: 16px` for inputs below 640px in `global.scss`._

5. **Record payment carries section subtext.** "What arrived, and when." and "Anything the next person opening this row should know." (`review-record-payment-drawer-mobile-375.png`) break the platform rule the brief restates (*no field subtext*, and VOICE R5 on generic subtext). _Fix: drop both `FormSection` descriptions in `ContributionDrawer`._

6. **The shell's Admin view menu puts `aria-haspopup` on a `<span>`** (axe `aria-allowed-attr`, every page). _Fix: render the Menu target as a `<button>`. It's the AppShell, not this feature, but it shows on every screen reviewed._

## Could Improve

1. **The type toggle's selected state is near-black**, not Lumen blue (`review-add-donor-organisation-errors-desktop-1280.png`). It reads as heavier than the one blue action in the footer. It matches the other segmented controls, so leave it unless those change too.
2. **The send dialog is long on a phone** (`review-send-dialog-mobile-375.png`, about 1,400px tall): Add recipients, the missing-address box, recipient tabs, the new per-recipient Language control and a 520px email frame. _Suggestion: collapse Add recipients to a single "Add someone" link until it's used, and cap the frame at 60vh on a phone._
3. **Dark mode.** Lumen has no dark palette; `prefers-color-scheme: dark` changes nothing (`review-donor-overview-dark-mode-desktop-1280.png`). It's consistent with the brief (*no new tokens*), so it isn't a defect of this feature, but it's a gap in the system.
4. **"Assign students" beside "Unallocated: ฿60,000"** wraps to two lines on a phone (`review-donor-students-mobile-375.png`). _Suggestion: put the amount on its own line above the button below 640px._

## What Works Well

- **One form, wherever you are.** The add and edit drawers look like the student and teacher drawers: same width, sections, pinned footer, and the error count shown in both the banner and the footer (`review-add-donor-organisation-errors-desktop-1280.png`). It goes full-screen with a pinned action bar at 375, and the type toggle stretches full width, all as the brief says.
- **Errors say how to fix them, on the field.** "Name the person reports go to." "Enter an email address. This is where their reports are sent." The no-email warning on an existing donor is a warning, not a block, exactly as decided (`review-edit-donor-drawer-mobile-375.png`).
- **Country before phone.** *Thailand · +66* in the country field, and a stored number shown nationally (*081 234 5678*).
- **The list surfaces its problems.** *Phone needs fixing (2)*, *No email*, and orange *needs fixing* flags make bad data visible without a separate report (`review-donors-list-desktop-1280.png`).
- **Voided payments stay legible.** Struck through with the reason as a tag, and **Restore** in place of edit (`review-donor-payments-desktop-1280.png`).
- **The Waiting to send dialog** names each person with their state and one action, in plain words ("The email service turned down aunt@example.com.") (`review-waiting-dialog-mobile-375.png`).
- **No horizontal page overflow at any width, and Figtree loads everywhere.** Nothing broke the page.
