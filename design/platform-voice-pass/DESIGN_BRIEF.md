# Design Brief: Platform voice pass

## Problem

The platform speaks in three voices, and people notice.

An admin creating a teacher account sees "User could NOT be created. The server returned an error. See console for details." They don't know what a console is. A teacher in Chiang Rai switches the interface to ไทย, opens her students, and every word is still English, because the four pages she lives in never went through the translation files. A donor opens their student's page and reads "Mali – Grade 5", "1 Jan 2026 – 30 Jun 2026", "12,000 THB", and a line from the renew page about how "the impact of your kindness is invaluable".

None of this is broken code. It's copy written at different times by different hands, before there was a voice to write towards. The result is a product that feels warm in the report email and like a database console two clicks away. Admins learn to ignore error messages because they never say what to do. Teachers learn the Thai switch only half works. Donors get a mix of charity sentiment and system labels.

A review against [docs/VOICE.md](../../docs/VOICE.md) on 11 Sep 2026 found about 280 places where the copy breaks the voice. They fall into these groups:

- raw system errors shown to people (about 60)
- dashes and hyphens (about 45)
- a bare "—" where a value is missing (about 30)
- placeholders that state rules or start with "e.g." (about 20)
- errors with no fix (about 50)
- no Thai on the teacher pages
- a mix of smaller rules: "&" instead of "and", Title Case, "THB" in labels, "Log out" instead of "Sign out", and required-field messages with no reason

## Solution

Every word on the platform sounds like the same kind people, in both languages.

An error tells an admin what happened and what to try next, and the technical detail goes to the console, where developers look. An empty table says why it's empty and offers the first action. A placeholder shows what's worth writing and why it will help later. A missing value says "Not recorded" rather than a dash. A teacher who picks ไทย gets Thai on every page she uses. A donor reads their student's name, a date written the way their language writes dates, and an amount in ฿. Nothing in this pass changes a layout, a colour, or a flow. Only the words change.

## Experience Principles

1. **Say what to do, not what broke.** Every error names the problem in plain words and gives one next step. Technical detail (error codes, table names, env vars, migration files) is logged with `console.error` and never rendered.
2. **A missing value is information, not a gap.** "Not recorded", "No school yet", "Add the first one". Never a bare symbol, never an empty cell, never "N/A".
3. **One rule set, two languages.** English and Thai follow the same rules and change together. A string doesn't exist until it exists in both `en.json` and `th.json`. Thai is never an afterthought translated from finished English.

## Aesthetic Direction

- **Philosophy**: Lumen, unchanged. This is a copy pass. The visual system is not touched.
- **Tone**: Warm and personal everywhere, including admin screens. Speak as "we" to "you", use the student's first name when it's known, use contractions, no exclamation marks, no emoji, no dashes. Thai is polite and warm (สุภาพ เป็นกันเอง): คุณ and เรา, with ค่ะ or นะคะ on full sentences and no particle on labels. Full rules are in [docs/VOICE.md](../../docs/VOICE.md).
- **Reference points**: GOV.UK error messages (what happened plus how to fix it). Wise's empty states. A school's end-of-term letter for anything a donor reads.
- **Anti-references**: developer tools ("Entity not found", "Op: eq"). Crowdfunding sentiment ("your kindness is invaluable", "she still needs your help"). Generic SaaS helper text ("Update the school details.").

## Existing Patterns

- **Voice source of truth**: [docs/VOICE.md](../../docs/VOICE.md), rules R1 to R10, plus before and after examples.
- **Reviewer**: [.claude/agents/copy-reviewer.md](../../.claude/agents/copy-reviewer.md), a read-only agent. Rerun it after each phase as that phase's acceptance check.
- **i18n**: i18next through `src/i18n/index.ts`, `fallbackLng: "en"`. `src/i18n/locales/en.json` and `th.json` each hold about 340 keys. `LanguageSwitch.tsx` is in the top bar.
- **Modules already close to the voice**: calendar, sponsorship, `EmailPreviewDialog`, `ReportCommentThread`, `AssignTeacherModal`, `send-donor-card`. They show what "done" looks like.
- **Typography, colours, spacing**: `tokens.css` (183 tokens), Figtree plus Noto Sans Thai, Mantine 7 under Lumen. No changes.
- **Components**: `InlineMessage` for banners and errors, Mantine notifications for toasts, form fields with `label`, `placeholder` and `description`.

## Component Inventory

| Component | Status | Notes |
|---|---|---|
| `common.none` locale key | Modify | Change "—" to "Not recorded" / "ยังไม่ได้บันทึก". Every consumer inherits the fix. |
| `PLACEHOLDER` in `schoolProfile.ts` | Modify | Change "—" to "Not recorded", or use `t("common.none")`. Root cause of several dash findings. |
| Date range formatter | New or modify | One `formatDateRange(start, end, lang)` that returns "1 Jan to 30 Jun 2026" / "1 ม.ค. ถึง 30 มิ.ย. 2026" (Western year in Thai for now; Buddhist Era years come in a later release, per VOICE.md §7). It replaces every hand-joined `–` range and every direct `toLocaleDateString()` call. Extend the existing formatter if one exists. |
| Friendly error helper | New | `toFriendlyError(err, fallbackKey)` logs the raw error with `console.error` and returns a human message from the locale files. Used by forms, `entityForm.ts` and the Supabase call sites. |
| Pending-update notices | Modify | The notes in `TEACHER_FIELDS_PENDING_NOTE`, `DONOR_FIELDS_PENDING_NOTE`, `STUDENT_LIFECYCLE_PENDING_NOTE`, `userAccess.ts`, `SchoolForm` and `TeacherForm` keep a plain sentence on screen. The migration file name moves to `console.info`. |
| Edge function error bodies | Modify | `admin-create-user`, `invite-donor`, `admin-user-access`, `donor-renew-request` return human messages and log the raw error on the server. |
| Report email template | Modify | `report-email/template.ts`: subject "{name}'s term report", date range with "to" / "ถึง", replace "her teacher" with the student's name, remove "simply", warmer Thai reply note. |
| Teacher pages | Modify | `TeacherDashboardPage`, `TeacherStudentsPage`, `TeacherStudentDetailPage` and `TeacherProfilePage` move every string to `t()` under `teacher.*`, with Thai values. Reuse the existing keys (`teacher.profileNotFound`, `student.*`, `errors.*`). |
| `AdminReportsPage` | Modify | Rewrite its copy in plain language: "Term updates / reports" becomes "Reports", and `eq`/`neq` become "is"/"isn't". The page and its logic stay. |
| `DonorStudentDetailPage` | Modify | Live: donors reach it from `DonorOverviewPage` and `DonorDashboardPage`. Fix the dashes, "THB", the hand-written dates and "not found". |
| `DonorRenewPage` | Modify | Remove the organisation name, the slogan and the sentiment. Plain "we" copy. |
| Thai plural keys | No change | `th.json` uses bare keys where `en.json` has `_one`/`_other`. This is deliberate (see `src/i18n/index.ts`): Thai has no plural forms, and i18next resolves the bare Thai key before falling back to English. The review flagged it wrongly. |

## Key Interactions

- **Error on save**: the button returns to its idle state, and an inline message under the form says what failed and what to try ("We couldn't save these changes. Check your connection and try again."). The raw error goes to the console. The form keeps everything the person typed.
- **Validation**: messages are imperative and give a reason when it isn't obvious ("Add Mali's name in Thai. Teachers and Thai donors see this version."). They're shown next to the field, not only in a summary.
- **Empty state**: explains why it's empty and gives the first action as a link or button where one exists.
- **Success**: specific. "Araya's invitation was sent to araya@school.ac.th", not "User created successfully".
- **Language switch**: on the four teacher pages, switching to ไทย changes every label, placeholder, empty state, error and date immediately, with no reload.
- **Confirm dialogs**: "Delete Grade 10 to 12? This can't be undone." instead of "Are you sure you want to…". Replacing `window.confirm`/`alert` with app dialogs is out of scope; this pass fixes the words only.

## Phases

Rerun `copy-reviewer` over each phase's scope after that phase. A phase is done when that scope has no findings, apart from agreed exceptions.

| Phase | Scope | Approx. size |
|---|---|---|
| 1. Shared roots | `common.none`, `PLACEHOLDER`, date range formatter, friendly error helper, pending-update notices | 6 changes, fixes about 40 downstream |
| 2. Simple swaps | Dashes, "&", "e.g.", sentence case, bare "—", Log out to Sign out, "THB" in labels, across every file not owned by another session | ~130 |
| 3. Errors | Every "Could not…", "not found", "Unexpected error", raw `error.message`, and edge function bodies | ~60 |
| 4. Guidance copy | Placeholders (R8), repeated headings (R9), generic subtext (R5), required-field reasons, empty states, success specifics | ~50 |
| 5. Locales and email | `en.json`/`th.json` wording, Thai register fixes, report email template | ~25 |
| 6. Teacher Thai | Move the 4 teacher pages to `t()` with Thai values | 4 files |
| 7. Query page | `AdminReportsPage` plain-language rewrite | 1 file |
| 8. Donor records files | `AdminCreateDonorPage`, `AdminEditDonorPage`, `DonorForm`, `ContributionDrawer`, `ContributionsTable`. **Starts only after the donor records session commits.** | ~45 |

## Responsive Behavior

No layout changes. Rewritten strings must fit the space the old ones had. Check at 375px:

- Buttons must not wrap to 3 lines. Thai runs roughly 20% longer, so check the Thai version of every changed button.
- "Not recorded" replaces a 1-character dash in table cells. Check that narrow columns truncate with an ellipsis and a `title` tooltip rather than breaking the row height.
- Longer error messages wrap inside `InlineMessage`. They never get truncated.

## Accessibility Requirements

- Each field keeps an accessible name when its visible label is removed under R9 (`aria-label` or `aria-labelledby` pointing at the section heading).
- `alt` text follows the same rules: no dashes, and the student's name where it's known.
- Error messages keep `role="alert"` or are linked to their field with `aria-describedby` so screen readers announce them.
- Date ranges read "1 January to 30 June 2026" to a screen reader. No symbols for a screen reader to read out.
- Every `t()` key is set in both languages, so a Thai screen reader never jumps to English partway through a sentence.

## Agreed exceptions

- Example email addresses and domains keep their hyphens (`contact@your-organization.org`).
- CSV export column headers keep "(THB)", because the cells hold bare numbers.
- Thai "ชื่อ-สกุล" is a standard form and stays.
- Phone numbers, IDs and formatter-generated dates are outside the dash rule.
- No gendered pronouns unless the record states gender. Use the student's name, or "their".

## Out of Scope

- Moving the admin module to Thai (23 form files, about 400 strings). It gets its own brief.
- Replacing `window.alert`/`window.confirm` with app dialogs. The words change; the component doesn't.
- Removing `AdminReportsPage` or `DonorStudentDetailPage`. Both stay and get copy fixes.
- The calendar and sponsorship modules, which the other session is building. They already follow the voice. The Thai plural key fix is handed to that session.
- `src/modules/designsystem/` demo pages.
- Any change to layout, colour, spacing, flow, or database schema.
- Machine translation. Every Thai string is written or checked by a person before it ships.
