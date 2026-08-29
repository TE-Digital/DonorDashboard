---
name: icare-design-system
description: Authoritative UI spec for iCare Donor Dashboard. Load before writing or changing any page, component, colour, spacing, type, table, form, or status treatment in src/. Trigger on any UI/visual/layout/styling work in this repo.
---

# iCare — design specification

Single-source reference for building iCare interfaces. `src/design-system/tokens.ts` is authoritative; if code and this document disagree, **the token file wins and this document is stale** — fix the document, or fix the token, never the page.

iCare is operational software for a social-impact organization: donors, students, teachers, scholarships, schools, progress reports. Its users are accountable for other people's money and for children's records. The brief: enterprise capability, humane surface. Highly readable type, calm neutral chrome, one rationed blue, no boxiness, nothing chirpy.

**Contents** — [Rules](#the-five-rules) · [Colour](#colour) · [Typography](#typography) · [Space & shape](#space--shape) · [Motion](#motion--interaction) · [Components](#components) · [Layout](#layout-patterns) · [UX conventions](#ux-conventions) · [Language](#language) · [Iconography](#iconography) · [Privacy](#privacy-rules-non-negotiable) · [Files](#files)

---

## The five rules

1. **Only the primary button is filled.** One filled button per screen region — normally Add or Save. Everything else is `variant="default"` (outline) or `subtle`. This is the single rule that keeps a dense screen calm.
2. **One radius: `radius.md` (8px).** Panel, card, button, input, modal, popover. Circles (`radius.xl`) only for avatars and status dots.
3. **One stroke.** Every box is a single 1px `border.default` border. Shadows carry no ring. Boxes are never nested inside boxes — a `SectionCard` does not contain another `SectionCard`.
4. **Everything comes from a token.** Spacing, radius, shadow, font size, icon size, duration, z-index, breakpoint. A literal `#hex`, `px`, or `rem` in a page file is a bug.
5. **Colour means something.** Saturation appears in badges, status dots and stat-card accents only. Chrome and table rows stay neutral — no zebra striping.

---

## Colour

Values live in `color` (`tokens.ts`). Branding may override primary/secondary at runtime via `BrandingProvider`, so **never hardcode the blue** — read it from the Mantine theme.

### Primary

| Token | Value | Use |
| --- | --- | --- |
| `brandDefaults.primaryColor` | `#1c7ed6` | The one important action, active nav item, focus ring, selected row |
| `brandDefaults.secondaryColor` | `#228be6` | Secondary emphasis, chart/accent support |

Organization branding replaces both. Any component that needs the brand colour must consume the Mantine theme (`theme.primaryColor`), not the token literal.

### Neutrals — `color.neutral.0…9`

`#ffffff` · `#f6f8f7` · `#edf2f0` · `#e3eae7` · `#d5dfdb` · `#bdcbc6` · `#91a49d` · `#6a7d76` · `#41554e` · `#1c302a`

### Surfaces & borders

| Token | Value | Where |
| --- | --- | --- |
| `color.surface.page` | `#f6f8f7` | App canvas |
| `color.surface.card` | `#ffffff` | `SectionCard`, `StatCard` |
| `color.surface.sunken` | `#edf2f0` | Table header, hover on white, nav |
| `color.surface.auth` | `#eef4f2` | Sign-in / invite background only |
| `color.surface.overlay` | `rgba(0,0,0,.55)` | Modal scrim |
| `color.border.subtle` | `#e3eae7` | Default hairline, table row divider |
| `color.border.default` | `#d5dfdb` | Card and control borders |
| `color.border.strong` | `#aabbb5` | Hovered / focused control border |

### Text

`text.primary` `#1c302a` headings and body · `text.secondary` `#41554e` supporting copy · `text.dimmed` `#6a7d76` labels, captions, metadata · `text.inverse` `#ffffff` on filled surfaces.

`text.dimmed` on white is the lightest permitted text colour. Do not go lighter for "subtlety".

### Status — meaning is fixed

A badge tone is a claim about state, not decoration. Status colours are Mantine colour keys (`color.status`), consumed through `StatusBadge` / `getStatusMeta`.

| Alias | Mantine key | Means |
| --- | --- | --- |
| `success` | `green` | Active, paid, approved, up to date |
| `warning` | `orange` | Pending, planned, expiring, no report yet |
| `danger` | `red` | Overdue, unpaid, cancelled, rejected, open request |
| `info` | `blue` | Completed, informational, neutral progress |
| `neutral` | `gray` | Inactive, handled, unknown, not applicable |

**Never introduce a status colour in a page.** Add the value to the registry in `semantic.ts` and render it with `StatusBadge`. Badge variant is `light` by default; `filled` and `outline` exist but need a reason.

**Never signal state with colour alone** — always colour + text label, optionally + icon. Colour-blind users and grayscale printouts are real.

---

## Typography

One face: `brandDefaults.fontFamily` — the system stack, for performance and script coverage. Branding may replace it; pages must not name a font.

Never set a size or weight by hand. Spread a **role** from `typography.ts`: `<Text {...textRole("body")}>`.

| Role | Size | Weight | Line height |
| --- | --- | --- | --- |
| `hero` | 34 | semibold | tight 1.2 |
| `pageTitle` | 28 | semibold | tight |
| `pageSubtitle` | 14 | regular, dimmed | normal |
| `sectionTitle` | 22 | semibold | tight |
| `cardTitle` | 18 | semibold | tight |
| `fieldLabel` | 14 | medium | normal |
| `body` / `bodyStrong` | 14 | regular / semibold | normal 1.5 |
| `bodyLong` | 16 | regular | relaxed 1.7 |
| `caption` | 12 | regular, dimmed | normal |
| `metricValue` | 28 | **bold** | tight |
| `metricLabel` | 12 | medium, dimmed | normal |
| `tableHeader` | 12 | semibold | normal |

Titles are **semibold, not bold** — bold headings on a dense admin screen read as shouting. `metricValue` is the one place bold is correct. `hero` belongs on auth and landing surfaces only, never inside the app shell.

`bodyLong` is for prose a person reads rather than scans (report text, descriptions); it carries the relaxed line height because Thai renders taller than Latin. Raw `<Title order={n}>` matches the same scale via `headings`.

Numeric columns should use tabular figures so amounts align down the page.

---

## Space & shape

**Space** — `space`: `none` 0 · `3xs` 2 · `2xs` 4 · `xs` 8 · `sm` 12 · `md` 16 · `lg` 24 · `xl` 32 · `2xl` 40.
Every step is a multiple of 4 except `3xs` 2, which is for optical nudges (icon/text baseline) and never for layout. Inside a card: `md`. Between cards: `lg`. Between page sections: `xl`.

**Radius** — `radius`: `sm` 4 (badges, chips) · `md` 8 (**default: everything**) · `lg` 12 (modals, large panels) · `xl` 9999 (avatars, dots only).

**Shadow** — a hairline border is the default separator; shadow only when something genuinely floats.

| Token | Use |
| --- | --- |
| `shadow.xs` | Resting card — barely there |
| `shadow.sm` | Card hover |
| `shadow.md` | Dropdown, popover |
| `shadow.lg` | Modal, drawer |

No shadow carries a ring, so a box never shows two overlapping strokes.

**Icons** — `iconSize`: `xs` 14 (inside table cells / badges) · `sm` 16 (buttons, nav) · `md` 18 (default) · `lg` 20 (page header) · `xl` 24 (empty states).

**Layout** — `layout.navWidth` 220 · `layout.mobileBarHeight` 56 · `layout.drawerWidth` 260 · `layout.authMaxWidth` 420 · page padding `32px 40px` desktop, `72px 16px 24px` mobile.

**Z-index** — `zIndex`: nav 100 · drawer 200 · modal 300 · overlay 400 · notification 500. Never write a raw z-index.

**Backgrounds** — flat colour only. No gradients, no texture, no pattern. Imagery appears only as deliberate content (student photo, org logo), never as page decoration.

---

## Motion & interaction

| Token | Duration | Used for |
| --- | --- | --- |
| `duration.fast` | 120ms | Hover, colour and border changes |
| `duration.normal` | 200ms | Disclosure, tab switch, inline message |
| `duration.slow` | 320ms | Modal, drawer |

No bounce, no spring, no attention-seeking entrance — data that jiggles reads as unreliable.

**Hover** lifts the surface one step (transparent → `neutral.1`) and darkens the border one step. **Nothing scales, shrinks, or moves** under the cursor. **Focus** is always visible: a brand-coloured ring that does not shift layout. Keyboard reachability is a requirement, not a polish item.

---

## Components

Import everything from `src/design-system` — never from an individual file, never a raw Mantine primitive where a shared component exists.

```tsx
import { PageHeader, SectionCard, StatCard, StatusBadge, EmptyState, LoadingState, InlineMessage, FormActions } from "../../design-system";
```

| Component | Purpose |
| --- | --- |
| `PageHeader` | Title, short context line, page-level primary action |
| `SectionCard` | One bordered group of related content |
| `StatCard` | A single dashboard metric with label and optional context |
| `StatusBadge` | Any semantic state — always via `getStatusMeta` |
| `EmptyState` | No rows: icon + title + one sentence naming the way out |
| `LoadingState` | Any pending fetch — never a blank screen |
| `InlineMessage` | Information that must stay visible in context |
| `FormActions` | Save / cancel / destructive row, consistent order and emphasis |
| `ContactCell` | Email / phone / LINE as copy-to-clipboard icons in one narrow cell |

Everything else comes from **Mantine**, themed by `buildTheme()`. If a pattern repeats in three pages, promote it to `src/design-system/components/` rather than copying it a fourth time.

### Mantine defaults already set in `theme.ts`

Do not re-declare these on a page — passing them again is noise, and passing something else is a divergence.

| Component | Defaults |
| --- | --- |
| `Card` / `Paper` | `withBorder`, `radius="md"`, `shadow="xs"` |
| `Modal` | centered, `radius="md"`, `padding="lg"`, scrim 0.55 |
| `Drawer` | `padding="md"`, scrim 0.55 |
| `Table` | **`striped={false}`**, `highlightOnHover`, spacing `md`/`sm` |
| `Badge` | `variant="light"`, `size="sm"`, `radius="sm"` |
| `Button` and all inputs | `size="sm"` |
| `ActionIcon` | `variant="subtle"`, `size="md"` |
| `Tooltip` | arrow, 250ms open delay |
| `Menu` | `radius="md"`, `shadow="md"`, portalled |
| `Alert` / `Notification` | `radius="md"`, light variant |
| `Avatar` | `radius="xl"` — the only circle |

`Button` keeps Mantine's `filled` default, so the one primary action per region needs no prop. **Secondary actions must pass `variant="default"`, dismissals `variant="subtle"`, destructive `color="red"`.** This rule is enforced by review, not by the theme.

Non-colour tokens are also on the theme at `theme.other` (`space`, `shadow`, `duration`, `layout`, `zIndex`, `border`, `surface`, `textColor`, `iconSize`) for styles that cannot take a Mantine prop.

**Feedback split** — Mantine notifications for "what just happened" (transient outcome). `InlineMessage` for what must persist (validation, sync warning, data-quality note).

---

## Layout patterns

### App frame

```
Desktop                              Mobile
┌────────┬──────────────────┐        ┌──────────────────┐
│ Nav    │  Page content    │        │ Bar 56px         │
│ 220px  │  32px 40px pad   │        ├──────────────────┤
│        │                  │        │ Content          │
└────────┴──────────────────┘        └──────────────────┘
                                     nav in 260px drawer
```

All authenticated pages sit inside `AppShellLayout`. Navigation is grouped by the user's work, never by database table names, and shows only what the role can act on.

### Standard data page — render in this order

1. `PageHeader` — title, one context line, one primary action
2. Optional `StatCard` row and/or filters
3. `LoadingState` / error `InlineMessage` / `EmptyState` when applicable
4. Main table, cards, form, or detail body
5. Secondary and destructive actions, clearly labelled

Every asynchronous page handles **loading, empty, error and success** explicitly. A blank screen during auth or fetch is a bug.

### Forms

Visible labels always (placeholder is not a label). Sensible defaults. One obvious submit. Preserve user input when a recoverable request fails. Destructive operations require confirmation that states the impact in plain words.

### Responsive

Works from narrow mobile upward. Stack fields and action groups on small screens. Tables scroll horizontally or become cards where scanning improves — but essential actions must never require horizontal scrolling. No fixed content widths except intentionally focused flows (auth, `layout.authMaxWidth`).

---

## UX conventions

Rules about **behaviour**, so two agents working on two pages produce the same product. Follow these and a change stays small; ignore them and the next person rewrites the page.

### Change discipline

Prefer the smallest change that satisfies the request.

- Reuse an existing page in the same module as the template. Copy its structure, not a new invention.
- Do not restyle, reorder, or "tidy" a page you were not asked to change.
- Do not introduce a new library, wrapper, abstraction or layout primitive for a single use.
- New shared component only after the same pattern appears in **three** pages.
- A visual change that touches more than one page belongs in `tokens.ts` / `theme.ts`, never in the pages.
- If the request seems to require breaking a rule here, say so and propose the change to this document instead of quietly diverging.

### Navigation and hierarchy

- One level deep: list → detail. Two levels max (list → detail → edit). Deeper means the model is wrong.
- Any page more than one level deep shows a back link or breadcrumb to its parent.
- Nav is grouped by the user's work, never by table name. A role sees only what it can act on.
- The route is the state for anything a user might bookmark or share — active tab, selected record, filter. Not for a modal's open/closed.

### Actions

- One primary action per screen region, and it is the thing the user came to do.
- Destructive actions are never the primary, never adjacent to save, and always confirm.
- A confirmation states the object and the consequence in plain words: "Delete the report for 12 Mar 2026? This cannot be undone." Never "Are you sure?".
- Disabled buttons must explain why (helper text or tooltip). A dead control with no reason is a dead end.
- Every action gives feedback within `duration.normal`: pending state on the control, then a notification or an updated row.

### Tables and lists

- Show the count next to the title ("Students · 84").
- Most-identifying column first (name), status second, dates and amounts right-aligned.
- Row click opens detail. Row-level actions live at the end of the row, and never conflict with row click.
- No zebra striping. Hover is the only row emphasis.
- Sort defaults to the column the user cares about (most recent, or overdue first), not database order.
- Long lists get search before they get pagination.
- **Contact details are icons, not columns.** An email column and a phone column cost ~370px to show values nobody reads off the screen. One `ContactCell` replaces both: hover reads the value, click copies it. Icons keep their position on every row, so a missing value reads as missing.
- Anything copied confirms twice: the control itself changes for a moment, and a notification names what is now on the clipboard, because a clipboard is invisible. One notification at a time — a second copy replaces the first.

### Status vocabulary

A state that appears on two screens is defined once, in one file, with its label, its tone and its sentence of explanation. `reportStatus.ts` is the pattern: the students table and the student record both read `reportCycle()`, so the list and the record cannot disagree about whether something is late.

| State | Colour | Means |
| --- | --- | --- |
| Not started · Draft | gray | Nothing is happening, and nothing is late |
| Submitted · Under review | blue | In motion, with somebody else |
| Changes requested · Due in X days | amber | Needs attention soon, or from us |
| Overdue | red | Late |
| Approved / Sent | green | Done and gone to the donor |

Each row shows **one** pill, for the current open cycle only. History is on the record, not in the list.

### Wide tables: pin the ends

A table wider than a screen pins identity on the left and status on the right, and scrolls the reference data between them. Scrolling to read a village must never cost you the name of the child whose village it is.

- **Left:** who is this — name, photo, and the identifier folded in as a subtext line rather than a column of its own.
- **Middle:** everything you look up rather than scan — village, age, dates, amounts.
- **Right:** what you must do about this row — status pills, completion, coverage.
- Pinned columns carry `pin: "left" | "right"` on the column and need a numeric `width`. The edge column shows a shadow, so it is visible that more scrolls past. Pinning more than about a third of the width leaves nothing to scroll and is worse than not pinning.

### Archive, never delete

A record about a child is the programme's memory of them. Archiving takes a student out of the working lists and changes nothing else — no cascade, no nulled column, every report, scholarship and note kept — and it goes back the same way from the same menu. Deletion exists only where a record has no history worth keeping. Confirmations say what is kept, not only what changes.

### Counting the record

Profile completion is one list of fields in one file (`COMPLETION_FIELDS`), so the percentage on the record and the percentage in the directory are the same calculation. A number that means one thing in a list and another on a page is a number nobody checks twice.

- A missing field reads "— missing" in amber, never a dash. A dash says "nothing here"; this says somebody still has to find it out.
- The percentage is always beside the bar, and the tooltip names what is missing. Colour never carries the message alone.
- Clicking the KPI takes you to the first gap and marks it for a few seconds. Telling somebody a record is 73% complete without showing them the other 27% is half an answer.

### Reports and privacy

A term report is written by a teacher and read by a donor, and the line between those two audiences runs through the middle of the form.

- "Comment for donor" is sent to the sponsor as written. "Internal note" never leaves the organisation. The labels say which is which; neither is inferred.
- An attachment is **private until somebody ticks it**. Sharing is per file, never per report, and never defaulted on — it is a decision about one photograph of one child.
- A file marked for removal stays visible, struck through, until save. Removing something from a child's record should not happen invisibly.
- Deleting a report states the consequence: a term's observations cannot be written again from memory.

**The donor card** is its own record, not the student record with fields hidden. It holds a display name, a description and a photo, and has no route to anything else — a card assembled by filtering the student row is one careless edit away from putting a child's address in front of a stranger. Two independent gates guard it: **consent** (the family's decision) and **profile status** (our own readiness). Both are re-checked on the server, because the browser check is a courtesy to the admin, not a control. When sending is unavailable the screen names which gate is closed. The preview and the exported file are the same SVG string, not the same design.

### Account access

Whether a person can sign in is a separate question from what their record says, and it is never stored on the record. It is read from `auth.users` through `admin_user_access_state()`; the actions run in the `admin-user-access` edge function, which is the only thing holding the service role.

| State | Means | Offered |
| --- | --- | --- |
| Active | Has signed in | Send password link · Remove access |
| Invited | Invitation sent, not used | Send again · Copy sign-in link · Remove access |
| Invite not used | Sent over a week ago, still unused | Same as Invited — chase on another channel |
| Access removed | Sign-in blocked, record untouched | Restore access |
| No account | No sign-in exists | Send invitation · Copy sign-in link |

- The badge states what is true now; the menu offers only what fits that state. An active account is never offered an invitation.
- A generated sign-in link **is a credential**. It is confirmed before copying, never printed on screen, never logged, and never stored — only the fact that somebody copied one is recorded.
- Removing access is reversible and deletes nothing. Say so in the confirmation.
- Every access action is recorded in `user_access_events` with who did it, so "did anyone chase this teacher?" has an answer.

### One record, one set of fields

A record that can be created and edited is **one set of fields in one file**, rendered by both screens. `StudentFields` is the pattern: the add form and the edit screen import it, so a field cannot exist on one and not the other, and the order and grouping cannot drift.

- Group by **how a person is described**, not by how the table is shaped. A student reads: personal details (including the guardian, because that is how the student is reached), then school, then teacher and support.
- Required means required **to save**. A field that can be filled in later from the record's own page is optional on the create form — asking for it up front only stops the record being created at all.
- Anything a record needs but does not have yet gets an **Add** button on the section rule. On a page it opens a drawer; inside a drawer it becomes a step of that same drawer, with a breadcrumb back and the half-typed record still mounted behind it.
- A file keyed by the record's id (a photo) is held until the first save, then uploaded. Say so on the control. On the edit screen the same control uploads immediately, because the id exists.

### Forms

- Visible labels always; placeholder is an example, not a label.
- **Never `<input type="date">`.** The browser's own control is a different height from every other field, carries its own calendar glyph, and shows `28/08/2026` or `08/28/2026` depending on the reader's locale — the two are indistinguishable. Use Mantine `DateInput`, which the theme sets to `DD MMM YYYY` everywhere. Read and write the stored `yyyy-mm-dd` through `parseDateInput` / `toDateInputValue`, never `new Date(iso)` — that ISO-parses to UTC and moves a birthdate back a day west of Greenwich.
- Group related fields in one `SectionCard`. Long forms are split into sections, not steps, unless the flow genuinely branches.
- Validate on submit, and on blur only after a field has already failed once. Never validate while typing a first attempt.
- Errors sit next to the field that caused them, plus one summary line if the failure is page-level.
- Preserve input on a failed request. Losing a teacher's half-written report is the worst bug this product can have.
- Warn before discarding unsaved changes.
- Required is marked; optional is not. Do not mark both.

### The four states

Every asynchronous surface handles all four, explicitly:

| State | Treatment |
| --- | --- |
| Loading | `LoadingState`, in place, keeping page structure. Never a blank screen. |
| Empty | `EmptyState`: what would be here, and the one action that creates it. |
| Error | `InlineMessage` in context with a retry. Never a raw Supabase message. |
| Success | Updated data visible, plus a notification if the change is not obvious on screen. |

"No results after filtering" is a different empty state from "nothing exists yet" — the first offers to clear filters, the second offers to create.

### Accessibility

- Everything reachable and operable by keyboard, in visual order. Focus is always visible.
- Modal traps focus and returns it to the trigger on close. Escape closes.
- Labels tied to inputs. Icon-only controls carry an accessible name.
- Never state-by-colour-alone. Never information by position alone.
- Touch targets at least 44px on mobile.

---

## Language

Copy is **supportive, simple English**, written so it can be translated into Thai without rework. Donor language preference already exists in the data (`en` / `th`), and the product serves iCare Thailand Foundation — assume every string will be translated.

### Voice

Plain, warm, factual. Calm competence — a well-kept ledger, not a bank statement and not a marketing email. The reader is accountable for other people's money and for children's records; copy respects that by being specific, never chirpy, never cold.

Supportive means: the product explains, offers the next step, and never makes the user feel at fault. It does not mean cheerful, apologetic, or padded.

### Simple English rules

- Short sentences. One idea each. Aim under 20 words.
- Common words over formal ones: *use* not *utilise*, *send* not *submit*, *fix* not *rectify*, *about* not *regarding*.
- Active voice, present tense: "The report saved", not "The report has been saved".
- No idioms, metaphors, humour, or wordplay — they do not survive translation.
- No jargon from the database. Users see *scholarship*, not *award record*; *student report*, not *progress entry*.
- No abbreviations invented here. Well-known ones only.
- Spell out what an action does. "Save changes" beats "Confirm".

### Translation-ready

- **Full sentences in one string.** Never build a sentence from fragments joined in code — Thai word order differs.
- **No string concatenation for grammar.** Use a whole template with a placeholder: `"{count} students need a report"`, not `count + " students " + ...`.
- **Allow 30–40% expansion.** No fixed-width buttons, labels, or table headers. Text wraps; it does not truncate a label.
- **Do not encode meaning in casing.** Thai has no upper and lower case.
- **Do not rely on plural -s.** Thai has no plural form. Prefer "Students: 1" over "1 student" where a count stands alone.
- **Keep proper nouns, IDs, currency codes and dates out of translated strings** — pass them as values.
- Thai renders taller than Latin. Use `lineHeight.normal` minimum, `relaxed` for any paragraph, and never a fixed line height in px.
- Keep user-generated content (student names, report text) untouched, in the language it was written.

### Casing and length

Sentence case everywhere: buttons, headings, column headers, tabs, menu items. No Title Case. ALL CAPS only for nav group labels — and even there, it carries no meaning in Thai, so it is style, never signal.

Buttons 1–3 words starting with a verb (*Add student*, *Save changes*, *Request renewal*). Column headers 1–3 words with the unit in parentheses (*Awarded (THB)*). Empty states are a title plus one sentence naming the way out.

### Person

Use *you* when giving an instruction: "Clear a filter, or choose a wider date range." The system never says *I*. Name objects directly: "12 student reports are overdue", not "You have 12 overdue reports" — the data belongs to the organization, not the person reading it.

### Numbers, dates, currency

- Currency with symbol and separators; Thai baht as `฿4,200` or `4,200 THB`. Never mix formats on one screen.
- Dates as `12 Mar 2026` — unambiguous across locales, unlike `03/12/2026`. Format through one shared helper, not `toLocaleDateString()` per page.
- Counts never rounded in tables; may be rounded in stat cards. Percentages carry one decimal.
- Numerals stay Western Arabic (`2026`) in both languages. Buddhist-era year conversion is a product decision, not an agent's.

### Errors

State what happened, then what to do. "The report did not save. Check your connection, then try again."

Never blame the user. Never apologise twice. Never leak a raw Supabase error, an internal ID, or a personal field into an error string.

### Emoji

Never. Not in UI copy, not in empty states, not in status labels.

---

## Iconography

Mantine's bundled icon set, sized from `iconSize`, coloured `currentColor` except inside status components where they take the semantic hue.

Icons support labels, they never replace them — an icon-only control requires an accessible label and a tooltip. No emoji as icons. No hand-drawn SVG, no icon font, no PNG icons.

---

## Privacy rules (non-negotiable)

This UI renders information about students and donors. Follow `DATA_POLICY.md` plus:

- Display only the fields the current task needs. A detail page is not an excuse to render the whole row.
- No personal data in URLs, logs, analytics, error messages, or screenshots.
- Treat reports, exports and attachments as sensitive.
- Route guards are **not** a security boundary. Every read and write must also be permitted by Supabase RLS or a controlled edge function.
- No privileged credentials in Vite env vars or browser code.

---

## Files

| Path | What |
| --- | --- |
| `src/design-system/tokens.ts` | Raw values — the authority |
| `src/design-system/typography.ts` | Type scale mapping |
| `src/design-system/semantic.ts` | Status value → appearance registry |
| `src/design-system/format.ts` | Date, currency, number and count formatting — the only place |
| `src/design-system/branding.ts` | DB branding → theme conversion |
| `src/design-system/theme.ts` | `buildTheme()` for `MantineProvider` |
| `src/design-system/components/` | Shared page patterns |
| `src/modules/admin/userAccess.ts` | Account state, access actions and their copy — the only definition |
| `src/modules/admin/studentProfile.ts` | The student record: field shape, validation, lookups, photo |
| `src/modules/admin/StudentFields.tsx` | The student fields themselves — add form and edit screen render this |
| `src/modules/reports/` | The term report: record, attachments, form, drawer, list |
| `src/modules/reports/reportStatus.ts` | The reporting-cycle vocabulary — labels, tones, and what counts as late |
| `src/modules/admin/studentEvents.ts` | Notes and the activity timeline, and archiving |
| `src/modules/admin/donorCard.ts` | The donor-facing card: three fields, one SVG, preview and export |
| `src/design-system/index.ts` | The only import surface |
| `design.md` | Product, architecture, role and workflow reference |
| `.claude/Design-system.md` | This file |

### Changing the system

1. New reusable value goes in `tokens.ts` or `semantic.ts` — never in a page.
2. Reuse an existing page pattern and shared component before creating a new abstraction.
3. Update this document in the same change that moves a token.
4. Test loading, empty, error, success, keyboard, mobile and long-content states.
5. Run `npm run build` before merging — it is currently the only automated check.

### Known gaps — resolve before treating as settled

- **The green-grey neutral ramp is newly tuned.** Check contrast and Thai-script rendering against real content before treating it as final.
- **Status colours are Mantine keys**, so their exact hex is Mantine's, not ours. No control over the `light` tint.
- **No chart palette, no chart components.**
- **No table component.** Every list page hand-rolls a Mantine `Table`; density, sticky header and sort are inconsistent.
- **No logo asset.** Branding supplies one at runtime; there is no fallback mark.
- **No test suite or linter.**
- **Button variants are unaudited.** Most pages omit `variant`, so several screens likely render two or more filled buttons. Fix per page when touched.
- **No i18n layer.** Every string is hardcoded English in JSX. Donor `language` is stored (`en` / `th`) but nothing reads it. Thai support needs a translation library and a string extraction pass before the copy rules above can be enforced.
- **Pages do not use `format.ts` yet.** The helpers exist and are exported; roughly 10 pages still call `toLocaleDateString()` / `toLocaleString("en-US")` inline. Migrate a page when you touch it for another reason.
- **Currency assumed THB.** `format.ts` sets `CURRENCY = "THB"`, replacing the hardcoded `en-US` USD in donor and scholarship pages. Confirm amounts are actually stored in baht before migrating those pages.
