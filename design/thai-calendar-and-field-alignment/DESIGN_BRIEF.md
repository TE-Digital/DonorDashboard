# Design Brief: Thai school calendar and donor ↔ student field alignment

## Problem

iCare's students attend Thai schools. The Thai school year starts in mid-May, splits into two semesters, and ends in March. The platform knows none of this.

**Reports are asked for at the wrong time.** The reporting cycle is the calendar year cut in half: January–June and July–December. A "mid-year" report due in June arrives about six weeks into semester 1, before a teacher has anything to report. A "year-end" report due in December lands in the middle of semester 2. Teachers are chased for reports at moments that match nothing in their school.

**Nobody knows what year it is.** There is no school year anywhere in the data. Sponsorships renew on arbitrary dates. Grades never move: a P4 student in May 2026 is still P4 in May 2027 unless someone remembers to edit every record.

**The same fact lives in several places, and they disagree.**
- **Email switches.** Three briefs each proposed a way to stop a donor's emails: `wants_email_updates` (now read by `report_email_payload`), the records brief's `email_opt_out`, and the sponsorship brief's per-student toggle. Without one rule, an admin trying to stop a donor's emails can't tell which switch matters.
- **The donor card has one language.** The display name and description a donor sees exist in only one language. The report, the student's name and the school's name each exist in both, so a Thai-reading donor gets a Thai report next to a card they can't read.
- **The need amount.** A student's need is written in three places: the student record, each sponsorship, and the grant type (with an undefined "per period").
- **The grant type.** It is written on the student twice (a link plus a free-text copy) and again on the sponsorship.
- **The donor's email.** It lives in the contact record, the invite record and the login profile.
- **The donor page's currency.** It is read from a table the platform has already retired.

Each duplicate is a place where two screens can tell an admin two different truths.

## Solution

The platform learns the Thai school calendar and uses it everywhere a date means something to a school.

- **One Settings page holds the school year**: 16 May to 31 March, with semester 1 (16 May–10 Oct) and semester 2 (1 Nov–31 Mar). A school with different dates overrides them on its own record.
- **Reports follow semesters.** A semester 1 report is due by 31 October and a semester 2 report by 21 April: three weeks after each semester ends. Each school can change its own dates and deadline. Each report is labelled *Semester 1 · 2026–27*. Old reports are re-labelled by the date they were written.
- **Western years everywhere, for now.** Dates read *12 Sep 2026* in English and use Thai month names with the same Western year in Thai. A school year reads *2026–27*. Buddhist Era years (2569) are deliberately left for later.
- **Every May, the admin reviews grades.** A promotion screen proposes each student's next grade (P4 → P5, M6 → Graduating). The admin fixes the exceptions (repeating a year, moving school), and confirms once. Grade history is kept per school year. On 31 March, graduating students are archived as *Graduated* and their sponsorships go to *Needs decision*.

Alongside this, each duplicated fact gets a single home, and every other place reads from it:
- **Emails**: one switch on the donor (*Send report emails*) and one per sponsorship (*Reports for this student*). Both must be on.
- **Donor card**: Thai and English side by side.
- **Need amount**: the student's need is the truth. A sponsorship records what this donor gives, and the grant type only prefills a need.

## Experience Principles

1. **The school's calendar, not the accountant's.** Anything a teacher or student lives by (report due dates, grades, sponsorship years, renewals) follows the Thai school year. Money totals stay on the calendar year, because that is how iCare's books and donors' tax years work. Every date on screen belongs clearly to one or the other, never a mix.
2. **One fact, one home.** Every field has a single place it is edited. Other screens display it and link to where it is changed. Where the old data disagrees, the migration keeps the most trustworthy value and lists the conflicts for a person to settle. It never silently picks one.
3. **The reader's language, all the way down.** A Thai reader sees Thai words and Thai month names; an English reader sees English. A missing translation blocks that one send and names what is missing. It never falls back to the other language.

## Aesthetic Direction

- **Philosophy**: Lumen, unchanged. No new tokens. This brief is mostly about data and dates; its visible surfaces are one settings page, one yearly review screen, and small changes to existing forms.
- **Tone**: Calm and administrative. The yearly grade review should feel like ticking off a class list with a pen, not running a data migration.
- **Reference points**: A school's printed academic calendar for the settings page (the year, two semesters, dates in both scripts). A teacher's class register for the promotion list.
- **Anti-references**: Not a date-picker playground (no calendar widgets where a date field will do). Not a data-cleaning tool that shows raw database conflicts; conflicts appear as plain sentences about a person.

## Existing Patterns

- **Typography, colors, spacing, radius**: as in the sponsorship brief. Figtree + Noto Sans Thai, `--fs-*` scale, `success / warning / danger / neutral` tones, 4px spacing, 8px radius.
- **Dates**: `format.ts` `formatDate` is the single date formatter ("12 Mar 2026"). Pages must not call `toLocaleDateString()`, but about 25 still do (for example `AdminScholarshipsPage`, `AdminSchoolsPage`, `TeacherStudentsPage`, the donor pages). This brief moves them all onto `formatDate`, which becomes language-aware.
- **i18n**: `i18next` + `react-i18next` with `src/i18n` (`LanguageSwitch`, `en.json`, `th.json`). The current language drives the date format.
- **Report cycle**: `reportingCycle.ts` (`cycleOf`, `previousCycle`, "2026 mid-year" keys) and `reportStatus.ts` (`CYCLE_MONTHS = 6`, `DUE_SOON_DAYS = 30`) are the only two files that define cycles. They are rewritten, not duplicated. `AdminSchoolDetailPage.tsx:65` has its own copy of the mid-year rule and is repointed to them.
- **School reporting period**: `schools.reporting_period_months` (1/3/4/6/12), with `REPORTING_PERIODS` in `schoolProfile.ts`.
- **Grades**: `GRADES` (K1–K3, P1–P6, M1–M6) and `gradeOptions` in `schoolProfile.ts` already follow the Thai system and keep legacy values as "(as recorded)".
- **Donor card**: `DonorProfileTab` (`donor_display_name`, `donor_description` 420 chars, `donor_photo_path`, with profile status and consent gates).
- **Bilingual field**: the `BilingualField` pattern from the email brief (an EN · ไทย tablist with a *Missing* marker) is reused for the donor card.
- **Money**: `donor_balance`, `student_coverage`, `scholarships.monthly_amount_thb`, `students.monthly_support_expected`, and `grant_types.amount_per_period` / `default_duration_months`.
- **Components**: `FormDrawer`, `FormSection`, `DataTable`, `Badge`, `Tooltip`, `InlineMessage`, `Dialog`, `TodayRail`, `Tabs`, `EmptyState`.

## Data Model Changes

Following `SCHEMA.md` and `TIMEZONE.md`. Dates are stored as plain `DATE` (Western calendar); timestamps are `TIMESTAMPTZ` UTC. Every screen shows Western (CE) years; Buddhist Era display is out of scope.

**Calendar**
- **`programme_settings`** (single row, introduced by the sponsorship brief) gains:
  - `semester1_start` `'05-16'` and `semester1_end` `'10-10'`.
  - `semester2_start` `'11-01'` and `semester2_end` `'03-31'`.
  - `school_year_start` `'05-16'` and `school_year_end` `'03-31'`.
  - `report_due_after_days` (default `21`), so semester 1 is due by 31 Oct and semester 2 by 21 Apr. The admin can change it on Settings.
- **`schools` gains** optional overrides for the same six dates **and** `report_due_after_days`. Null means the programme default applies. Programme defaults: semester 1 ends 10 Oct, and reports are due 21 days after each semester ends.
- **`school_years` (view)**: derives `school_year_start` (2026, the Western year it begins in), `label` (`2026–27`), `starts_on`, `ends_on` and each semester's dates per school, so every screen asks the database "which school year and semester is this date in?" rather than computing it.
- **`schools.reporting_period_months` retires.** Reporting is now per semester for every school. Schools currently on a non-6 value are listed in the migration report for the admin to confirm.
- **`term_updates` gains** `school_year_start` SMALLINT and `semester` SMALLINT (1 or 2). Existing rows are backfilled from `report_date`, using the student's school dates at the time. `due_date` becomes the semester's due date.

**Grades**
- **`student_grade_history` (new)**: `student_id`, `school_year_start`, `grade_level`, `school_id`, `outcome` (`'promoted' | 'repeated' | 'graduated' | 'moved_school' | 'left'`), `confirmed_by`, `confirmed_at`. `students.grade_level` stays the current grade, and history is the record of every year. The migration seeds one history row per student for the current school year.
- **`students.status`** gains `'graduated'` alongside `'enrolled' | 'archived'`. A graduated student is archived for working lists but labelled as a success, not a departure.
- Legacy grade values (`4`, `Grade 4`, `ป.4`) are mapped to `GRADES` in the migration. Values that can't be mapped are listed for the admin on the first promotion review.

**Emails**
- **`donors.wants_email_updates`** (existing, default `true`) is the donor-level switch, labelled *Send report emails*. There is no new column. `20260911090000_report_recipients_email_pref.sql` already filters `report_email_payload` on it, and the records brief's `email_opt_out` is not built.
- **`scholarships.report_emails_enabled`** stays (from the sponsorship brief), labelled *Reports for this student*.
- **Rule**: a report or welcome goes to a sponsor only if the donor has `wants_email_updates`, the sponsorship has `report_emails_enabled`, and the donor has an email. `report_email_payload` reads exactly this and returns an `excluded_reason` otherwise.
- `wants_newsletter` is untouched and separate.

**Donor card**
- **`students` gains** `donor_display_name_th` and `donor_description_th`. The existing columns become the English version, and the migration moves Thai-script content into the `_th` columns (detected by Unicode range).
- **Rule**: `donor_profile_status = 'published'` needs at least one complete language. A send to a reader of language X needs language X complete, and is otherwise blocked with the reason.

**Need and grant type**
- **`students.monthly_support_expected`** is the need: THB per month, and the one number `student_coverage` and `FitLabel` read.
- **`grant_types.amount_per_period` → `monthly_amount_thb`** (renamed). It is used only to prefill a new student's need when a grant type is chosen, and changing it never alters existing students. `default_duration_months` retires (the school year replaces it).
- **`students.grant_type_id`** is the student's programme. **`students.scholarship`** (free text) retires: the migration maps it to a `grant_types` row by name where one matches, and lists the rest.
- **`scholarships.grant_type_id` retires.** This supersedes the funding migration's column and the sponsorship brief. A sponsorship is money from a donor; the programme belongs to the student.

**Donor email**
- **`donors.contact.email`** is the single source for sending and for the duplicate check. `donors.invited_email` is kept as history of where an invite went. `profiles.email` is the login address, displayed read-only on the donor page when linked, and never used for sending. If they differ, the donor overview shows *"Signs in as x@…; reports go to y@…"*.

**Currency**
- The donor page's currency is read from `donor_contributions.currency` (records brief), not from `scholarship_awards`.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| `SchoolCalendarSettingsPage` | New | Settings → School calendar. The school year and two semesters as date-range rows (day + month, no year), the report due gap, and a live preview line: *"School year 2026–27: 16 May 2026 – 31 Mar 2027 · Semester 1 report due 31 Oct 2026"*. |
| `SchoolForm` | Modify | The *Reporting period* select is removed. A collapsed *School calendar* section is added: "Uses programme dates", or override dates. The school overview shows which dates apply. |
| `reportingCycle.ts` / `reportStatus.ts` | Modify | Cycles become `{ schoolYearStart, semester, start, end, dueOn }` from the `school_years` view. Keys become `2026-S1`. Labels read *Semester 1 · 2026–27* (with the word "Semester" translated in Thai). `CYCLE_MONTHS` retires. |
| `formatDate` / `formatDateTime` | Modify | Language-aware. `th` → Thai month abbreviations + Western year (`12 ก.ย. 2026`); `en` → `12 Sep 2026`. Takes an explicit language for emails, where the recipient's language matters rather than the admin's. |
| Pages using `toLocaleDateString()` / raw `Intl` | Modify | About 25 call sites move to `formatDate` (listed in the audit). |
| `report-email` template | Modify | Dates and "Semester 1 · 2026–27" labels in the recipient's language. |
| `GradePromotionPage` | New | Opened from a `TodayRail` item from 1 May: *"School year 2026–27 starts 16 May: review grades (214 students)"*. Grouped by school, it shows each student's current grade, proposed grade and an outcome select (Promote / Repeat / Graduate / Moved school / Left). Unmappable legacy grades are flagged at the top. The admin can **Confirm school** per school or **Confirm all**. Confirming writes history and updates `grade_level`. The page stays open 1 May – 30 June. After confirming, and after 30 June, the admin can still correct any student's grade or outcome from the student's record. The history row is updated, with who changed it and when. |
| `GradeHistoryList` | New | On the student overview: one line per school year (*2025–26 · P4 · Promoted*), each with an edit action for admins. |
| `DonorProfileTab` | Modify | Display name and description become `BilingualField`s (EN · ไทย, *Missing* marker). The preview card has a language toggle. The blocked-send message names the missing language. |
| `DonorForm` (records brief) | Modify | Two email-related controls only: **Send report emails** (switch) and **Wants newsletter** (switch). A linked login email is shown read-only when it differs. |
| `SponsorsTab` (sponsorship brief) | Modify | The per-row toggle is labelled *Reports for this student*. When the donor-level switch is off, the row shows *"Donor has turned off all report emails"* and the toggle is disabled with a link to the donor. |
| `StudentFields` | Modify | The free-text *Scholarship* field is removed. Choosing a *Grant type* prefills *Monthly support expected* if empty, and never overwrites a typed value. |
| `AdminCreateGrantTypePage` / `AdminEditGrantTypePage` | Modify | *Amount per period* becomes *Monthly amount (THB)*. *Default duration* is removed. |
| `AssignSponsorDrawer` (sponsorship brief) | Modify | No grant type field. Default dates come from the `school_years` view. |
| `MigrationReviewPanel` | New | A one-time admin screen after deploy that lists every conflict the migration couldn't settle: unmapped grades, unmatched scholarship text, schools with non-6 reporting periods, and donors whose three email values differ. One row per conflict, each with a plain sentence and a fix action. It disappears once empty. |
| `AdminDashboardPage` | Unchanged | Money totals stay on the calendar year (decided). |

## Key Interactions

**Setting up the calendar (once).** Settings → School calendar shows the Thai defaults already filled in. The admin checks them. The preview line updates as dates change, showing this year's real dates in both calendars. Saving recalculates every open report's due date. A notification says how many changed: *"Due dates updated for 186 open reports."*

**A school with its own dates.** On the school record, *School calendar* reads "Uses programme dates". *Use different dates* reveals the same six dates and the report deadline (days after semester end), prefilled from the programme. That school's students, reports and sponsorship years then follow them.

**A teacher's report cycle.** The teacher's dashboard shows *Semester 1 · 2026–27 · due 31 Oct 2026*, or the same with Thai words and month names in Thai. Due soon, overdue and so on keep their existing meaning, measured from the semester due date.

**Switching language.** The `LanguageSwitch` flips month names on screen between `12 ก.ย. 2026` and `12 Sep 2026` with no reload. The year is the same in both languages.

**Yearly grade review.**
1. From 1 May, `TodayRail` shows the review item.
2. The page opens on the first school. Rows are pre-set to Promote, except M6 (Graduate) and anything unmappable (flagged).
3. The admin changes the few exceptions, for example Repeat for a child held back or Moved school with a school picker.
4. They press **Confirm Ban Huai School (24 students)** and the next school opens.
5. After the last school, a summary reads *"214 students updated · 12 graduating · 3 repeating"*.
6. On 31 March, graduating students are archived as *Graduated*. Their sponsorships go to *Needs decision* (sponsorship brief), with the reason *"Mali has graduated"*.

**Turning a donor's emails off.** The donor asks to stop. The admin opens the donor and switches off **Send report emails**. Every sponsorship row for that donor shows that emails are off at donor level. The send dialog lists them as excluded: *"Khun Somchai has turned off report emails."* Turning it back on restores the per-student settings exactly as they were.

**Writing the Thai card.** On the Donor profile tab, the admin writes the English description. The ไทย tab shows *Missing*. Publishing is allowed. Later, assigning a Thai-reading donor and opening the welcome shows a blocked message: *"Khun Somchai reads Thai. This student's Thai description is empty."* with a link straight to the ไทย tab.

**Choosing a grant type for a new student.** The admin picks *Primary scholarship*, and *Monthly support expected* fills with ฿1,500. The admin changes it to ฿1,800 for this child. Changing the grant type's amount later does not touch this child.

**After deploy.** The first admin to sign in sees a banner: *"The update found 17 records that need a decision."* It opens `MigrationReviewPanel`, where each row is fixed in place. The banner disappears when the list is empty.

## Responsive Behavior

- **`SchoolCalendarSettingsPage`**: on desktop, the date ranges sit side by side with the preview line beneath. On mobile, each range stacks and the preview becomes a card at the top.
- **`GradePromotionPage`**: on desktop, a table grouped by school with an inline outcome select. On tablet, the school name becomes a sticky group header. On mobile, each student is a row with name, current → proposed grade, and a tap-to-change outcome sheet; the *Confirm school* button is pinned at the foot.
- **Dates**: Thai and English date forms use the same year and a similar width, so switching language does not reflow tables.
- **`BilingualField`** keeps its tablist at every width. It never shows two languages side by side on mobile.

## Accessibility Requirements

- WCAG 2.1 AA with existing tokens.
- `<html lang>` follows the interface language (already required by the email brief). Dates inside English text written in Thai, and the reverse, carry their own `lang`.
- Dates are marked up so a screen reader in Thai mode reads the Thai month name naturally. The school year "2026–27" is announced as "2026 to 2027".
- Semester labels are words, never "S1" alone.
- `GradePromotionPage`: each outcome select is labelled with the student's name ("Outcome for Mali, P4"). Flagged rows state the reason in text. After *Confirm school*, focus moves to the next school's heading, and a polite live region announces the count updated.
- Date-range inputs on Settings have explicit start/end labels ("Semester 1 starts"), and invalid ranges (end before start, overlapping semesters) are named on the field.
- In `MigrationReviewPanel`, every conflict is a sentence with a labelled fix control. Nothing relies on colour.
- The bilingual card toggle and the *Missing* state are announced, following the email brief.

## Out of Scope

- **Agents.** A donor can be linked to an agent, but no screen links students to agents (`agent_students` exists but is unused). There is no agent matching or checking. Revisit if agents start managing students.
- **Dashboard school-year totals.** Money totals stay on the calendar year (decided). There is no school-year switch on the dashboard.
- **Thai public holidays** and school closure days. Semesters are date ranges only.
- **Per-student calendars.** Dates are set per programme or per school, never per student.
- **Further study past M6.** Graduation ends the programme relationship. Vocational or university sponsorship is a separate brief.
- **A "graduated" email** to donors. Graduation surfaces as *Needs decision*; any message to the donor is written by the admin outside this flow.
- **Buddhist Era years (2569).** Skipped for now: every screen and email shows Western years. `formatDate` is the single place to add BE later. The database stays on Western dates either way.
- **Grade history before this school year.** History starts with the migration's seed row. Past years are not reconstructed.
- **Merging duplicate donors** whose emails collide (records brief).

## Decided

1. **Semester 1 ends 10 October** by default. Each school can change its semester dates on its own record.
2. **Reports are due 21 days after each semester ends** (31 Oct / 21 Apr) by default. Each school can change its deadline.
3. **Western years only.** School years read *2026–27*, in both languages. Buddhist Era display is postponed.
4. **The grade review runs 1 May – 30 June.** Confirmed grades can still be corrected by an admin afterwards from the student's record, with the change recorded in grade history.
