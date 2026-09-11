# Voice guide

The single source of truth for every word a person reads on DonorDashboard: UI labels, buttons, helper text, empty states, errors, toasts, and donor emails, in English and Thai. The `copy-reviewer` agent enforces this file and nothing else. To change its taste, change this file.

## 1. Personality

**Warm and personal, everywhere.** Admin tables, teacher forms, and donor emails all sound like the same kind people. Warmth comes from word choice: naming the student, saying what happens next, speaking to the reader as "you". It never comes from punctuation, emoji, or adjectives like "amazing".

- Speak as **"we"**. Never name the organisation inside the app. The name appears only in email signatures and footers.
- Speak to the reader as **"you"**.
- Use a student's **first name** whenever the screen knows it. "Mali's report is ready" beats "The report is ready".
- Say what happens next. A person should never wonder what a button will do or what comes after it.

## 2. Hard rules

| # | Rule | Wrong | Right |
|---|------|-------|-------|
| R1 | **No exclamation marks.** Anywhere, in either language. | "Report sent!" | "Mali's report is on its way to Khun Somchai." |
| R2 | **No emoji** in copy. | "Saved 🎉" | "Saved. You can close this page." |
| R3 | **No hyphens or dashes of any kind** (`-`, `–`, `—`) in user-facing text. Rewrite as two sentences, a comma, or a colon. Rewrite hyphenated compounds too ("over-allocated" becomes "more than allocated"). Date ranges use "to" / "ถึง", in visible text and screen reader text alike. Exceptions: phone numbers, IDs, formatter-generated dates, example email addresses and domains, and Thai "ชื่อ-สกุล". | "No donor funds this student yet — approving files the report" | "No donor funds this student yet. Approving saves the report but doesn't send it." |
| R4 | **Sentence case** for headings, buttons, labels, tabs, and menu items. Proper nouns keep their capitals. | "Scholarship History", "Add Donor" | "Scholarship history", "Add donor" |
| R5 | **No generic subtext.** Delete any subtitle, hint, or description that repeats its label or states the obvious. Keep subtext only when it adds a fact the person needs: a consequence, a constraint, or a next step. | "Edit school" + "Update the school details." | "Edit school" with no subtext |
| R6 | **No placeholder symbols for empty values.** Never show a lone `—`, `-`, `N/A`, or `TBD`. Say what is missing. | "—" | "Not recorded" |
| R7 | **`&` is not a word.** Write "and". | "Approve & send to donor" | "Approve and send" |
| R8 | **Placeholders invite value.** A placeholder tells the person what to write and what it will do for them later. Never use it for a rule, a warning, or who can see the field ("Only admins see this"). Visibility and constraints go in the label or a hint, and only if they matter. Format examples are fine when the format is the hard part (`you@example.com`, `081 234 5678`). No "e.g." prefix: just show the example. | "Only admins see this." | "Add a note about this donor, like how they prefer to be contacted or what matters to them." |
| R10 | **No gendered pronouns** unless the record states gender. Use the student's name, or "their". | "in her teacher's own words" | "in Mali's teacher's own words" |
| R11 | **Technical detail never renders.** Error codes, raw server messages, table and column names, env vars, and migration file names go to the console log. On screen, give a plain sentence and a next step. | "Apply supabase/migrations/2026…sql" | "Linking teachers to schools isn't available yet. You can set it from the teacher's page for now." |
| R9 | **Say it once.** A section heading and the only field inside it must not repeat the same words. Drop the field label, or give the heading a broader name. | Heading "Internal note" + label "Internal note" | Heading "Internal note", field with no visible label (keep `aria-label`) |

## 3. Banned patterns

The agent flags all of these:

**System speak.** The reader is a person, not a database.
- "not found", "record", "entity", "invalid", "user", "#4821", "field", "submit", "null"
- "Student not found." becomes "We couldn't find this student. They may have been removed."
- "Invalid input" becomes a specific message: "Enter a Thai phone number, for example 081 234 5678."

**Jargon and abbreviations.**
- "THB" in labels (show ฿ with the amount instead), "FY", "alloc", "N/A", "TBD", "ID" when a plain word works
- "Expected monthly support (THB)" becomes "Expected monthly support"

**Filler and hedging.**
- "Please note", "simply", "just", "basically", "Oops", "Uh oh", "Something went wrong", "may", "might" when we know the answer
- "Something went wrong. Try again." becomes "We couldn't finish that. Check your connection and try again."

**Charity appeal guilt.** Students are people doing well at school, not objects of pity.
- "She still needs your help", "change a life", "without you", "a child in need", "underprivileged", "poor"
- No progress thermometers, no urgency, no calls to donate under a student's photo.

## 4. Words we use

| Use | Not |
|-----|-----|
| donor | sponsor, supporter, user, funder |
| student | child, kid, beneficiary, scholar |
| teacher | user, staff member |
| report | term update, record, submission |
| sign in / sign out | log in / log out, login |
| save | submit |
| couldn't / can't / didn't | could not / cannot / did not (contractions are warmer) |
| the student's first name | "the student", when the name is known |

## 5. Message types

**Errors: say what happened, then how to fix it.** No blame, no codes, no "invalid".
- ✗ "Could not upload that photo."
- ✓ "We couldn't upload that photo. Try a JPG or PNG under 5 MB."
- ✗ "Could not load reports."
- ✓ "We couldn't load reports. Check your connection and try again."

**Empty states: explain why it's empty, then invite the first action.**
- ✗ "No students found."
- ✓ "No students here yet. Add the first one to get started."
- ✗ "No reports submitted by this teacher yet."
- ✓ "Nothing from this teacher yet. Their reports will appear here once they send one."

**Success: confirm with specifics.** Who, what, where it went.
- ✗ "Saved."
- ✓ "Mali's details are saved."
- ✗ "Sent to {{names}}"
- ✓ "Sent to {{names}}. They'll get it in their inbox within a few minutes."

**Loading: say what we're doing, in plain words.**
- ✓ "Getting your welcome page ready…"
- ✗ "Preparing password reset page…" becomes "Getting your password page ready…"

**Buttons: a verb plus an object.** Say exactly what happens.
- ✓ "Save changes", "Send report", "Add student"
- ✗ "OK", "Submit", "Confirm", "Yes"

**Required field messages: gentle, and give the reason when it isn't obvious.**
- ✗ "A Thai name is required on every student."
- ✓ "Add Mali's name in Thai. Teachers and Thai donors see this version."

## 6. Donor emails

Donor emails follow the same rules, plus these:

- Read like a school's end-of-term letter: the student's name, photo, grade, what their teacher said, and one line from us. Then stop.
- No subject lines like "Report #4821 approved". Write "Mali's term report", "รายงานประจำภาคเรียนของมะลิ".
- No calls to action, no donate buttons, no banners, no slogans.
- Sign off from the team ("With thanks, the team at iCare"). This is the one place the organisation's name appears.

## 7. Formats

Dates and money depend on the reader's language. Always use the shared formatter. Never hand-write a date format.

| | English | Thai |
|---|---|---|
| Date | 11 Sep 2026 | 11 ก.ย. 2026 |
| Long date | 11 September 2026 | 11 กันยายน 2026 |
| Month | September 2026 | กันยายน 2026 |
| Money | ฿12,000 | ฿12,000 |
| Phone | 081 234 5678 | 081 234 5678 |

- **Years are Western (2026) in both languages, for now.** Thai text uses Thai month names with the Western year. Buddhist Era years (2569) are planned for a later release; until then, don't add 543 anywhere.

- Never write numeric-only dates like `09/11` or `2026-09-11`.
- No "THB" next to an amount that already shows ฿.
- Exception: CSV export column headers keep "(THB)", because the cells hold bare numbers.

## 8. Thai

**Register: polite and warm (สุภาพ เป็นกันเอง).** Think of a kind school office, not a government letter and not a LINE chat.

- Address the reader as **คุณ**. Speak as **เรา**.
- **Labels, buttons, tabs, and table headers carry no particle.** "บันทึก", "ส่งรายงาน", "เพิ่มนักเรียน".
- **Full sentences** (errors, empty states, success messages, emails) end with **ค่ะ** or **นะคะ**. Use the same particle across the whole platform.
- Avoid stiff official words when a plain one exists: "ทำรายการ", "ดำเนินการ", and "ข้อมูลไม่ถูกต้อง" are system speak.
- No exclamation marks and no dashes in Thai either (R1, R3).
- Translate the meaning and the warmth, not word for word. A Thai line that is colder, more formal, or longer by half than its English source is a finding.
- These keep their English form: LINE, email addresses, and people's names when no Thai version is recorded.
- Thai fields use `name_th` / `full_name_th` and fall back to the English name. Never show an empty Thai name.

| English | Thai ✗ | Thai ✓ |
|---|---|---|
| We couldn't save the report. Check your connection and try again. | บันทึกรายงานล้มเหลว | บันทึกรายงานไม่สำเร็จ ลองตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้งนะคะ |
| No students here yet. Add the first one to get started. | ไม่พบข้อมูล | ยังไม่มีนักเรียนในรายการนี้ เพิ่มคนแรกได้เลยค่ะ |
| Save changes | บันทึกการเปลี่ยนแปลงค่ะ | บันทึกการเปลี่ยนแปลง |

**Parity:** `en.json` and `th.json` must have identical keys. A key present in one and missing in the other, or a Thai value identical to the English one (untranslated), is a finding.

## 9. Before and after, from this codebase

| Where | Before | After | Rules |
|---|---|---|---|
| `en.json` common.none | "—" | "Not recorded" | R6 |
| `en.json` report.approveAndSend | "Approve & send to donor" | "Approve and send" | R7 |
| `en.json` report.noRecipients | "No donor funds this student yet — approving files the report, it does not send it." | "No donor funds this student yet. Approving saves the report but doesn't send it." | R3, contractions |
| `en.json` money.overAllocated | "Over-allocated by {{amount}}" | "{{amount}} more than this donor has given" | R3, jargon |
| `en.json` errors.generic | "Something went wrong. Try again." | "We couldn't finish that. Check your connection and try again." | filler, errors |
| `en.json` errors.missingStudentId | "No student was named in the address." | "We couldn't tell which student to open. Go back to the list and choose one." | system speak |
| `en.json` student.empty | "No students found." | "No students here yet. Add the first one to get started." | empty states |
| `en.json` student.background | "Background / notes" | "Background and notes" | symbols |
| `en.json` nav.logout | "Log out" | "Sign out" | words we use |
| AdminEditSchoolPage subtitle | "Update the school details." | *(remove)* | R5 |
| AdminTeacherStudentsPage subtitle | "View and manage all students assigned to this teacher." | *(remove)* | R5 |
| AdminCreateUserPage subtitle | "The invite email goes out as soon as the account is saved." | *(keep: it states a consequence)* | R5 |
| AdminStudentDetailPage | "Student not found" / "This record may have been deleted." | "We couldn't find this student. They may have been removed from the directory." | system speak, hedging |
| UI | "Hero Section (Dashboard)" | "Dashboard banner" | jargon, R4 |
| UI | "Welcome – set your password" | "Welcome. Choose a password to get started." | R3 |
| DonorForm.tsx:396 internal note | "Only admins see this." | "Add a note about this donor, like how they prefer to be contacted or what matters to them." | R8 |
| DonorForm internal note section | Heading "Internal note" + label "Internal note" | Heading only, field keeps `aria-label` | R9 |
| AdminCreateDonorPage.tsx:250 | "Visible only to admins (e.g., payment details, preferences)." | "Add a note about this donor, like how they like to pay or when to reach them." | R8 |
| AdminCreateDonorPage.tsx:168 | "e.g., Jane Doe or Company XYZ" | "Jane Doe or Siam Trading Co." | R8 |
| StudentFields.tsx:165 nickname | "e.g. Nong" | "The name friends and teachers use, like Nong" | R8 |
| StudentFields.tsx:240 background | "Anything that helps a donor or a teacher understand this student's situation." | *(keep: it says what to write and who it helps)* | R8 |
