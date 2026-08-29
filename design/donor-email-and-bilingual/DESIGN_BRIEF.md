# Design Brief: Reports by email, in two languages

## Problem

A teacher in Chiang Rai writes a report about Mali in Thai. Khun Somchai in Bangkok, who pays her school fees, would rather read Thai. An American donor funding the girl at the next desk would not. And neither of them is ever going to sign in to a web application to find out.

**The report has nowhere to go.** Everything built so far assumes a donor who logs in: a dashboard, a report card on a page, a comment box under it. That donor does not exist. Reports are approved and then sit in a database, and the only way a donor learns their student finished top of her class is if somebody at iCare remembers to tell them.

**The language a donor asked for is written down and ignored.** `donors.preferred_language` has existed since the beginning. There is a Preferred language select, English or Thai, on the add-donor form *and* the edit form, and both save it. Nothing anywhere reads it. It is the third field in this product — after `monthly_support_expected` and `line_id` — collected from a person and then never used, and each one teaches staff that filling forms in carefully does not matter.

**A Thai teacher works in an English interface.** Every string in seventy-seven page files is hardcoded English JSX, and no translation library is installed. The people writing these reports work in rural Thai schools; the software they use to do it speaks a language many of them read slowly, in a product whose own code comments note that LINE is "the channel teachers actually answer on" because the platform is not where they are comfortable.

**Money runs out silently.** A donor's free balance is now visible on their page, and nothing watches it. An admin discovers a donor cannot cover next month's commitments when a student's funding lapses — which is to say, after the fact, from the wrong end.

## Solution

The report leaves the building.

When an admin approves a report, they see the email before it sends: the real thing, in the language that donor asked for, with the recipients named. It reads like a letter from a school — the child's photograph, her name, her grade, what her teacher said, and a line from iCare. Not a newsletter, not a fundraising appeal. One child, one email, one term.

Language stops being a checkbox and becomes a fact the product acts on. A report carries both languages: the teacher writes in whichever they think in, and the admin writes or checks the other on the verification screen already built for exactly this kind of second look. Two stored columns, both approved by a person. Nothing is machine-translated into a donor's inbox without somebody having read it — a sentence about a child's guardian is not a thing to hand to an API and hope.

The interface learns Thai. A control in the top bar switches the whole application between English and ไทย, starting with the pages teachers live in. The switch is immediate and total: labels, buttons, empty states, error messages, dates.

And a donor whose money will not cover next month says so, on the donors table and on the admin dashboard, before the month arrives rather than after it fails.

## Experience Principles

1. **Nothing is sent that nobody has read** — The email is the delivery; there is no screen a donor can visit to see a corrected version. So the preview is not a courtesy step, it is the last gate, and no translation reaches it without a person having approved those exact words.
2. **A language is a fact about a person, not a setting** — Once a donor says Thai, every artefact addressed to them is Thai, or it does not go. Falling back to English "just this once" tells that person their preference was decorative, and they were right not to trust the form.
3. **Warn before the failure, not after it** — A balance that will not cover next month is a problem this month. Every alert in this feature fires while there is still time to act on it.

## Aesthetic Direction

- **Philosophy**: Lumen for the application — the existing system, unchanged, now speaking two languages. The email is its own surface: same palette, same restraint, but laid out as correspondence rather than as software.
- **Tone**: The application stays calm and administrative. The email is warm and plain — the voice of a school telling a family how a child is doing. It says what happened, shows the photograph, and stops. No exclamation marks in the chrome, no "amazing news!", no counters, no calls to action.
- **Reference points**: A school's end-of-term letter. The report card that comes home in a satchel. For the language control, the quiet locale switchers in Wise or GOV.UK — a labelled control that changes everything and draws no attention to itself.
- **Anti-references**: Not a crowdfunding email — no progress thermometer, no "she still needs your help", no donate button under a photograph of a child. Not a marketing newsletter — no banner image, no brand slogan, no unsubscribe-bait. And not a system notification: "Report #4821 has been approved" is not what a person who paid for a child's school year should receive.

## Existing Patterns

- **Email already works.** [`send-donor-card`](../../supabase/functions/send-donor-card/index.ts) is the pattern: a Deno edge function posting to `https://api.resend.com/emails` with `RESEND_API_KEY`, table-based HTML with inline styles, an `escapeHtml` helper, and — importantly — a clear "Email is not configured on the server" message when the key is absent rather than a silent failure. The report email follows this file's shape rather than inventing a second approach. `invite-donor` and `admin-create-user` show the auth pattern for an admin-only function.
- **Branding is stored.** `branding_settings` carries `logo_url`, `primary_color`, `secondary_color`, `font_family`, `button_radius` and `donor_contact_email`. The email uses the logo, the primary colour and that contact address as its reply-to, so a change on the branding page reaches the inbox without a code deploy.
- **The language field exists.** `donors.preferred_language`, default `'en'`, already written by [AdminCreateDonorPage.tsx:256](../../src/modules/admin/AdminCreateDonorPage.tsx#L256) and [AdminEditDonorPage.tsx:500](../../src/modules/admin/AdminEditDonorPage.tsx#L500). No new field, no new form. This feature reads it.
- **Thai names have a precedent.** `profiles.full_name_th` from the teacher migration, with the `isMissingColumnError` degradation pattern. Students and schools get the same treatment.
- **The verification screen is the natural home.** `ReportVerifyPage` already splits "what the teacher wrote" from "what the donor sees" and holds the commit. The second language and the email preview attach there rather than becoming a third screen.
- **Typography**: `--font-core` is Figtree. Figtree has no Thai glyphs, so Thai text currently falls through to a system font mid-sentence. A Thai face is added to the stack — Noto Sans Thai, matched for weight — so a bilingual line does not change texture halfway across.
- **Colors, spacing, radii**: unchanged. 183 tokens in `tokens.css`, no additions. The email's inline styles are hand-written hex values taken from those tokens, because email clients do not support custom properties.
- **Stack**: React 18 + Vite, react-router 6, Mantine 7 under Lumen, Supabase JS, SCSS modules. No i18n library — one is added.

## Data Model Changes

- **`term_updates` gains** `donor_comment_en`, `donor_comment_th`, `grade_text_en`, `grade_text_th`. The existing `donor_comment` stays as the source of truth for whichever language the teacher wrote in, and is mirrored into the matching column so no existing screen breaks.
- **`term_updates` gains delivery state**: `sent_at`, `sent_to` (jsonb: donor ids and addresses), `send_error`. A report that was approved but whose email bounced is a different state from one that was never approved, and the reports table must be able to say so.
- **`students` and `schools` gain** `name_th`, optional, falling back to `name`.
- **`donor_balance` view gains** `covers_next_month boolean` — `free_balance_thb >= monthly_committed_thb`. The alert reads one column rather than every screen doing the arithmetic and disagreeing.
- **Scholarship release**: ending a scholarship early writes a `donor_contributions` row with a negative-offsetting release note, so the returned money appears in the ledger as an event rather than as a total that silently moved. (Carried over from the previous brief's open question — in scope here because it changes the balance the alert watches.)
- **No new column for UI language.** The interface language lives in `localStorage`, per browser. Not persisted to the user's profile — a deliberate choice, revisitable, and the reason a teacher switching devices picks Thai again.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| `LanguageSwitch` | New | The top-bar control. Two states, EN / ไทย, each written in its own script so neither is a translation of the other. |
| `i18n` provider + `useT()` | New | Thin wrapper over the chosen library, so pages import one hook and never the library directly. |
| `en.json` / `th.json` | New | The string catalogues. Keyed by screen, not by English text, so a copy change is not a translation change. |
| `BilingualField` | New | A labelled textarea with an EN/ไทย toggle above it, showing which language is written and which is missing. Used twice on the verify screen. |
| `EmailPreviewDialog` | New | The exact email, rendered in an iframe, in the donor's language, with the recipients and reply-to named. Holds the real send button. |
| `report-email` edge function | New | Renders and sends via Resend. Follows `send-donor-card`; degrades with a legible message when the key is unset. |
| `reportEmailTemplate.ts` | New | The HTML, shared by the preview and the function so the preview cannot drift from what sends. |
| `BalanceAlertBadge` | New | Amber chip on a donor row: "Short for next month". |
| `ReportVerifyPage` | Modify | Gains the language toggle on the donor pane, the missing-language block, and the preview-then-send commit. |
| `AdminDonorsPage` | Modify | Gains the balance alert column and a "Short next month" KPI. |
| `AdminDashboardPage` | Modify | Gains the count of donors who cannot cover next month. |
| `AdminReportsBetaPage` | Modify | Status column distinguishes approved-and-sent from approved-and-failed. |
| `AppShellLayout` | Modify | Hosts `LanguageSwitch`. |
| `DonorOverviewPage`, `DonorReportCard`, `ReportCommentThread`, flag flow | Park | Routes stay, unlinked from navigation. The comment thread returns as the staff-side record of an emailed reply. |
| Teacher pages, shared chrome | Modify | First tranche of translated strings. |

## Key Interactions

**Writing the second language.** On the verify screen's donor pane, the update field carries a toggle: **EN · ไทย**. The language the teacher wrote in is filled and marked as the original; the other is empty and marked *Not written yet*. The admin types it. The footer will not send while the language a recipient asked for is missing — it says so by name: *Khun Somchai reads Thai. The Thai version is empty.* Approving without it is still possible; sending is not.

**Previewing.** *Approve & send* opens the email itself, rendered in an iframe at the width a phone would show it, in the recipient's language. Above it: who it goes to, which address, and the reply-to. If two donors read different languages, the preview has a recipient switcher and both are sent. The dialog's primary action is *Send to Khun Somchai* — the person's name, not the word "confirm". Sending stamps `sent_at`, records the addresses, and returns to the reports table with a live-region confirmation naming the recipient.

**When sending fails.** Resend errors, or the key is missing. The report stays approved, `send_error` is stored, and the row in the reports table reads *Approved · not sent*, in danger tone, with *Retry send* on it. Nothing silently swallows the failure, because nothing else in the product would ever reveal it.

**Switching the interface.** The control sits in the top bar beside the account menu. Pressing it re-renders the application immediately — no reload, no flash of English. Numbers and dates follow: `formatDate` already returns "12 Mar 2026" with a translatable month list, and that list becomes the Thai one. The choice is remembered in this browser.

**Running short.** A donor whose free balance will not cover next month's committed outflow carries an amber *Short for next month* chip on the donors table, sorted to the top, and is counted on the admin dashboard. Opening the donor shows the shortfall as a sentence on the balance card: *Needs ฿8,400 more to cover next month.* The alert clears the moment a contribution is recorded — no acknowledging, no dismissing, because a dismissed alert for a problem that still exists is a lie.

## Responsive Behavior

The application's existing behaviour is unchanged. Two additions:

`LanguageSwitch` is a two-state control on desktop; below 768px it collapses into the existing mobile menu as a labelled row rather than shrinking into an unlabelled globe icon, which would be a symbol requiring the language a person may not read.

`EmailPreviewDialog` renders the email at 375px inside its frame at every breakpoint — the preview must show what a phone shows, since that is where it will be read, not what a 1440px desktop would.

The email itself is a single-column table at 600px maximum, with the photograph at 100% width. Table-based layout with inline styles throughout: not a stylistic choice, a compatibility one.

## Accessibility Requirements

- WCAG 2.1 AA across both languages. Thai renders taller than Latin at the same size, so line heights are checked in Thai, not assumed from English.
- `LanguageSwitch` is a real toggle with an accessible name in **both** languages — a control that announces itself only in the language you cannot read is unusable by exactly the person who needs it.
- `<html lang>` updates with the switch, so screen readers change voice rather than reading Thai with English phonetics.
- The bilingual field's toggle is a tablist; the missing-language state is announced, not only coloured, and the blocked send names the reason in text.
- The preview iframe carries a title. The dialog traps focus and returns it to the approve button on cancel.
- The balance alert reads as words on the row — "Short for next month" — never as an amber dot alone.
- The email: real text, never an image of text; alt text on the photograph naming the child; contrast checked against both light and dark email clients; a plain-text alternative part so a text-only client shows the report rather than nothing.

## Out of Scope

- **Machine translation.** No API, no auto-fill, no draft. Rejected deliberately: an unreviewed sentence about a child, sent to the person paying for her, is the failure this product cannot have.
- **A donor login.** The donor screens already built are parked, not extended. No magic-link reply page, no unauthenticated surface.
- **Languages beyond English and Thai.** The catalogue structure allows a third; nothing here adds one.
- **Translating existing content.** Reports already in the database keep the one language they were written in. Only new reports carry both.
- **Email scheduling, digests, or batching.** One report, one email, sent when a person approves it. No queue, no termly roll-up.
- **Donor-facing PDF or printable report.** Mentioned as an alternative to email; not built.
- **Admin-page translation.** Teacher pages and shared chrome only, in this pass.
- **Bounce handling and delivery tracking beyond the send call.** A failed API call is recorded; a mail that is accepted by Resend and later bounces is not tracked.

## Open Questions

1. **Who is "iCare" in the sign-off?** The email closes with a line from the organisation. A named person reads better than a department, but a named person who leaves makes every old email wrong. Assumed: the organisation name plus `donor_contact_email`.
2. **The Thai typeface.** Noto Sans Thai is assumed — free, matches Figtree's weight reasonably, loads from Google Fonts. If iCare has a licensed Thai face, it goes here instead.
3. **Whether the release row for an ended scholarship needs its own reason vocabulary** (student left, school changed, donor withdrew) or a free-text note is enough. Assumed free text.
