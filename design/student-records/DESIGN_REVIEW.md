# Design Review: Student overview + Add student

Reviewed against: `design.md` (product design doc) and `.claude/Design-system.md` (Lumen system rules) — no `DESIGN_BRIEF.md` exists in this project.
Philosophy: Lumen — flat surfaces, hairline separators, rationed blue, colour that carries meaning, clarity before density.
Date: 2026-08-29

Scope:
- `src/modules/admin/AdminStudentOverviewPage.tsx` (student record)
- `src/modules/admin/AdminCreateStudentPage.tsx`, `StudentForm.tsx`, `StudentFields.tsx`, `StudentFormDrawer.tsx` (add student, page and drawer)
- Supporting: `AdminDirectory.module.scss`, `design-system/components/FormLayout.tsx`, `design-system/lumen/core.tsx`

## Screenshots Captured

**None — visual pass is outstanding.** No browser automation is available in this environment (no Playwright MCP, no `cursor-ide-browser`), so this review is code-only. Findings below marked _[visual pending]_ cannot be confirmed or closed until screenshots exist.

Needed, saved into `.design/student-records/screenshots/`:

| Screenshot | Breakpoint | What to capture |
| --- | --- | --- |
| `review-student-overview-desktop-1280.png` | 1280×800 | Student record, Overview tab, a record with several missing fields |
| `review-student-overview-tablet-768.png` | 768×1024 | Same |
| `review-student-overview-mobile-375.png` | 375×812 | Same — this is where the field grid is suspected to break |
| `review-add-student-desktop-1280.png` | 1280×800 | `/admin/students/new`, full page |
| `review-add-student-mobile-375.png` | 375×812 | Same |
| `review-add-student-error.png` | any | Form submitted empty, error banner showing |
| `review-add-student-drawer.png` | 1280×800 | Add-student drawer opened from a school page |

## Summary

The information architecture is the strongest part of this work: the record is grouped in exactly the order the add-student form asks for the same fields, so an admin who filled the form in recognises the page, and `StudentFields.tsx` makes that a structural guarantee rather than a convention. Token discipline is high — almost no raw hex, sizes, or spacing anywhere in these files.

The biggest finding is responsive: the record's field grid is a hard 12-column grid with inline `span` values and no breakpoint, so at 375px a "span 4" field is roughly 100px wide and every label in Personal details wraps or clips. Second is a split personality in the add-student flow — the drawer guards unsaved work and the full page discards it silently, from the same form component.

## Must Fix

1. **The record's field grid never collapses.** `AdminDirectory.module.scss:255` sets `.detailFieldGrid { grid-template-columns: repeat(12, minmax(0, 1fr)) }`, and `AdminStudentOverviewPage.tsx:~660` writes `gridColumn: span ${entry.span}` inline. The only media query touching this area (`:453`) collapses `.detailOverview` to one column at 1080px — the 12-column grid inside it is untouched. At 375px a `span 4` field gets ~100px: "Relationship to student" and "Monthly support expected" have nowhere to go. _[visual pending — confirm with `review-student-overview-mobile-375.png`]_
   _Fix: add `@media (max-width: 760px) { .detailFieldGrid { grid-template-columns: repeat(4, minmax(0, 1fr)); } .detailFieldGrid > * { grid-column: span 4 !important; } }` — or better, stop writing the span inline and map `span` to a class so the breakpoint can override it without `!important`._

2. **Validation reports one error, at the top, and marks nothing.** `StudentForm.tsx:246` calls `validateStudentDetails(details)`, which returns a single sentence; `reportError` scrolls the banner into view but does not move focus and no input receives `error`/`aria-invalid`. On a form this long — 18 fields across three sections — "Guardian name is required" at the top does not tell anyone which of the two name fields is meant. The `Input` primitive already supports `invalid` (`core.tsx:229`), so the capability exists and is unused. _Fix: return a `{ field, message }` from the validator, set `error` on the offending Mantine input, and focus it. Keep the banner as the summary._

3. **Discarding a half-filled student behaves differently in the two entry points.** `AdminCreateStudentPage.tsx:50` wires `onCancel={() => navigate("/admin/students")}` — no confirmation, no dirty check, even though `StudentForm` reports `onDirtyChange`. The drawer path guards it properly (`FormDrawer.tsx:75-82` shows a discard confirmation). Same form, same typing, two outcomes. _Fix: hold `dirty` in the page and confirm before navigating, reusing the drawer's copy._

## Should Fix

1. **Touch targets under 44px.** `IconButton` defaults to `size="md"` = `--control-h-md` 36px (`core.tsx:139`, `tokens.css:225`). The "More actions" ⋯ on the record header (`AdminStudentOverviewPage.tsx:~528`) is a 36px square, and it is the only route to Archive/Restore. Below the 44px minimum in the brief's accessibility principle. _Fix: `size="lg"` for the ⋯ on touch widths, or a `@media (pointer: coarse)` floor on `IconButton`._

2. **KPI tiles mean three different things.** On the record, the Profile-completion tile is clickable *only when something is missing*, Reports and Scholarship switch tabs, and Teacher assigned is not clickable but contains a link. On the students list the same tiles now filter the table. Four interaction models in one component. _Fix: pick one rule — a KPI either navigates/filters or it does not — and make the clickable ones look clickable (the `active`/hover treatment added to `KpiRow` is a start). At minimum, make Profile completion clickable always; a tile that only sometimes responds teaches people not to try._

3. **The photo control's real input is invisible to focus.** `.photoInput` (`AdminDirectory.module.scss:668`) is the standard `clip: rect(0,0,0,0)` visually-hidden pattern and stays keyboard-reachable — but a keyboard user tabbing into it sees no focus indicator anywhere, since the visible "Choose photo" button is a separate element. _Fix: add `.photoInput:focus-visible + …` styling on the button wrapper, or `tabIndex={-1}` on the input and let the button be the only tab stop (it already triggers it)._

4. **"— missing" carries meaning in amber but repeats a lot.** `.fieldMissing` (`:806`) is `--amber-700` (#9a6200, ~5.4:1 on white — AA passes). On a sparse record, nine amber lines in one section read as nine warnings rather than one incomplete record. _[visual pending]_ _Fix: keep the amber for the completion KPI and the first missing field it jumps to; render the rest in `--text-subtle`._

5. **No empty/typing state on the teacher picker when a school has no teachers.** `StudentFields.tsx:~296` sets `nothingFoundMessage="No teacher matches — add one instead"`, but when the chosen school has zero teachers the grouped list silently falls back to the flat list of everyone (`:95-110`), so the admin sees teachers from other schools with no explanation. _Fix: when `atSchool.length === 0` and a school is chosen, show an inline note above the picker: "No teachers recorded at this school yet."_

## Could Improve

1. **`--font-numeric` exists and is unused here.** Monthly support and the scholarship amount are plain text; the design doc asks for tabular figures on numeric values. `fontVariantNumeric: "tabular-nums"` on `.detailFieldValue` for money fields would line the digits up.
2. **Section rules and subsection titles are the same 14px semibold.** `.detailSectionTitle` (:246) and `.subsectionTitle` (:701) differ only by the border. One more step of separation — letter-spacing or `--text-muted` on the subsection — would make the guardian block read as nested rather than sibling.
3. **The archived banner and the lifecycle-pending banner are visually identical.** Both use `.archivedBanner` with different icons. One is a state of this student, the other is a state of the database. _[visual pending]_
4. **Motion.** `.photoOverlay` transitions and `.fieldHighlighted` uses a 200ms box-shadow; nothing else on either screen animates, and there is no `prefers-reduced-motion` block anywhere in `AdminDirectory.module.scss`. Cheap to add, and the brief names accessibility as a principle.

## What Works Well

- **One field definition, two screens.** `StudentFields.tsx` is rendered by both the add form and the edit screen, with exactly two props for the two real differences (photo timing, where a drawer can open). This is the correct shape and the file header says why.
- **Missing data is named, not blank.** "— missing" instead of an em-dash, tied to the same `profileCompletion` set the KPI counts, with a jump-to-first-missing affordance. The record tells you what to do next instead of quietly looking finished.
- **Photo upload sequencing.** Held in memory, uploaded after the insert returns an id, and a failed upload is reported as a photo problem rather than a failed save — so nobody creates a second student record because a JPEG was too big.
- **Token discipline.** Across ~2,400 lines reviewed, the only raw colour is one `rgba()` scrim on the photo overlay. Sizes, spacing, radius and type all come from the scale.
- **Heading order is correct.** `h1` from `PageHeader`, `h2` per `FormSection` and record section, `h3` for the guardian subsection — clean for a screen reader, unusual to get right in an admin console.
