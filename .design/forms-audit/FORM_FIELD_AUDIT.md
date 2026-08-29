# Form field audit — every input in the product

Reviewed against: `design.md` and `.claude/Design-system.md` (Lumen). No `DESIGN_BRIEF.md` exists.
Date: 2026-08-29
Scope: every `TextInput`, `Textarea`, `Select`, `MultiSelect`, `NumberInput`, `PasswordInput`, `DateInput`, `Checkbox`, `Switch`, `SegmentedControl`, `FileInput` and `ColorInput` rendered by a page or form under `src/modules/` — **203 controls across 25 forms**. Table filters and search boxes are excluded; they are controls, not fields.

## Screenshots

**None captured — visual pass outstanding.** No browser automation is available in this session (no Playwright MCP, no `cursor-ide-browser`). Everything below is from code. Findings that need eyes are marked _[visual pending]_.

To close them, save into `.design/forms-audit/screenshots/`: each form at 1280 / 768 / 375, plus one failed-submit state per form, one focused field, and one disabled field.

---

## The convention this audit applies

There was no stated rule for required vs optional, and three different signals were in use at once: a red asterisk (`required`), the word "Optional" as a placeholder, and nothing at all. Three signals for two states.

**The rule, from here on — mark the minority.**

- A form where most fields are required marks the **optional** ones: `label={optional("Notes")}` → renders `Notes · optional` in `--text-subtle`.
- A form where most fields are optional marks the **required** ones: `required` → the red asterisk that already exists.
- Never both on one form.
- A placeholder shows the **shape of the answer** (`08x xxx xxxx`, `e.g. P4, M2`, `DD/MM/YYYY`). It never says "Optional" — that is the label's job, and a placeholder disappears the moment someone types.

`optional()` is exported from `src/design-system` (`FormLayout.tsx`), styled by `.optionalTag`.

---

## Status — 2026-08-29, second pass

Every Must-fix and Should-fix below is now **fixed**, and the cheap Could-improves with them. `tsc --noEmit` and `vite build` both pass. What changed is listed under "Changes applied" at the bottom; the findings are kept as written so the reasoning stays readable.

| # | Finding | Status |
| --- | --- | --- |
| M1 | `AllocationPanel.tsx` does not compile | Fixed upstream — the file changed under us mid-review and `tsc` is now clean |
| M2 | Field-level validation in 3 forms, banner-only in 16 | **Fixed** — `fieldValidation.ts` moved to `src/design-system/`, adopted by 17 forms |
| M3 | Teacher and student required rules differ by screen | **Fixed** — both screens now run the same validator |
| M4 | Grade level free text vs picker | **Fixed** — one `gradeOptions()` list, both screens |
| S1 | Currency free text on four money forms | **Fixed** — `CURRENCY_OPTIONS` select |
| S2 | Amount is NumberInput here, TextInput there | **Fixed** — `NumberInput` with a thousands separator everywhere |
| S3 | No `autoComplete` anywhere | **Fixed** — auth, profile, and every email/phone field |
| S4 | No `type="tel"`, patchy `type="email"` | **Fixed** — 12 files |
| S5 | Four textareas with no accessible name | **Fixed** — `aria-label` |
| S6 | `description` renders nothing product-wide | **Fixed at the call site** — `.fieldHint` renders hints as content |
| S7 | Donor renewal guidance hidden in a tooltip | **Fixed** — visible hint under the field |
| S8 | Branding: free-text radius and font family | **Fixed** — both are selects now |
| C1 | Donor comment not distinguished in the report form | **Fixed** — the section carries a hint saying it is the part a donor reads |
| C2 | Placeholder voice inconsistent | Partly — "Optional" placeholders gone; the instruction/example mix remains |
| C3 | `clearable` is a per-field accident | Open |
| C4 | No explicit `aria-invalid` | **Fixed by M2** — Mantine sets it wherever `error` is set |
| C5 | Date placeholders inconsistent | **Fixed** in the student and report forms |

## Findings

### Must fix

1. **`AllocationPanel.tsx` does not compile.** `src/modules/donor/AllocationPanel.tsx:263` — `Type '(value: string) => void' is not assignable to type 'ChangeEventHandler<HTMLInputElement>'`. `npx tsc --noEmit` fails on it, so the whole app is currently un-typechecked. Untracked work-in-progress, not part of this audit's changes, but it blocks every check that runs after it. _Fix: the handler is being passed to a Mantine `TextInput` (event-based) where a `NumberInput`/`Select` (value-based) signature was intended._

2. **Field-level validation exists in three forms and nowhere else.** `fieldValidation.ts` gives a `FieldErrors` map, a summary count, and focus-to-first-error. Student, school and teacher forms use it. **Sixteen other forms** still call `setError("one sentence")` into a banner: scholarships (create + edit), grant types (create + edit), donor (create + edit), user accounts, report, my profile, teacher profile, teacher-edit-student, donor renewal, contribution, and all four auth screens. On the 12-field scholarship form, "Fill in the required fields" is not an answer. _Fix: `fieldValidation.ts` is form-agnostic — move it to `src/design-system/` and adopt it form by form, longest form first (scholarship, report, donor)._

3. **Two forms write the same record with different required rules.**
   - **Teacher.** Admin (`TeacherForm.tsx`) requires English name, Thai name, email, phone **and** LINE ID. The teacher editing their own record (`TeacherProfilePage.tsx:201-219`) has only English name required — Thai name, phone and LINE ID are optional. The same row, two contradictory contracts, and the teacher's own version is the one that leaves the record incomplete.
   - **Student.** `StudentFields.tsx` requires school (`validateStudentDetails`: "Select the school this student attends"). `TeacherStudentDetailPage.tsx:493` renders School as an ordinary optional `Select`. A teacher can save a student the admin form would refuse.
   _Fix: required-ness belongs to the record, not the screen. Put it in `studentProfile.ts` / `teacherProfile.ts` and have both screens read it._

4. **Grade level is free text in one place and a picker in another.** `StudentFields.tsx:297,321` — `TextInput placeholder="e.g. P4, M2"`. `TeacherStudentDetailPage.tsx:469` — `Select` with `placeholder="Select grade"`. `schoolProfile.ts` already exports `GRADES` (K1–M6) and the school form uses it. Free text means `P4`, `p4`, `Grade 4` and `ป.4` all land in the same column, and every grade filter downstream is wrong. _Fix: one `Select` fed by `GRADES` everywhere._

### Should fix

1. **Currency is a free-text `TextInput`** on all four money forms (`AdminCreate/EditScholarshipPage`, `AdminCreate/EditGrantTypePage`). Three characters, typed by hand, against amounts. _Fix: `Select` with THB first._

2. **Amount is a `NumberInput` in scholarships and a `TextInput` in contributions.** `ContributionDrawer.tsx:148` is `TextInput inputMode="decimal"` with placeholder `60,000`; `AdminCreateScholarshipPage.tsx:307` is a `NumberInput`. Both are money in THB. _Fix: pick one — `NumberInput` with a thousands separator — and use it for every amount, including "Monthly support expected" in `StudentFields.tsx:367`._

3. **No `autoComplete` anywhere in the product.** Zero occurrences across 203 fields. The four auth screens get no password-manager integration (`current-password` / `new-password`), and every name, email, phone and address field refuses the browser's autofill. _Fix: `autoComplete` on the auth forms first — it is four lines and it is where it matters most._

4. **No `type="tel"` on any phone field**, and only six fields carry `type="email"` out of roughly a dozen email inputs (`AdminCreateDonorPage.tsx:168` and `AdminEditDonorPage.tsx:408` are plain text). On a phone this is the difference between a number pad and a QWERTY keyboard. _Fix: `type="tel" inputMode="tel"` on phone, `type="email"` on the remaining email fields. Validation stays in `fieldValidation.ts` — the type attribute is for the keyboard, not the check._

5. **Four textareas have no accessible name.** Fixed in this pass with `aria-label`: student-record note (`AdminStudentOverviewPage.tsx:693`), note editor (`:744`), donor internal notes (`AdminEditDonorPage.tsx:467`), teacher's student bio (`TeacherStudentDetailPage.tsx:552`). Each had a `<Text>` heading above it that a screen reader has no way to associate with the control. _Watch for the pattern: a bold `<Text>` above a field is not a label._

6. **`description` renders nothing, product-wide.** `global.scss:263` sets `.mantine-InputWrapper-description { display: none }` deliberately. Any `description` prop is silently dropped — the "Reporting period" hint added earlier this week was invisible for exactly this reason (now rendered as content via `.fieldHint`). _Fix: keep the rule, but nothing in the codebase warns you. Add a lint note or a dev-time console warning to `global.scss`'s comment block._

7. **`DonorRenewPage.tsx:313` puts an explanation in a Tooltip behind an icon** — "If you'd like to continue with a specific grant type, select it here." This is the one donor-facing form in the product, and its only guidance is hidden behind hover, which does not exist on a phone. _Fix: render it as visible hint text with `.fieldHint`._

8. **Branding form: ten fields, none required, no validation.** `AdminBrandingPage.tsx` accepts any string as "Button radius" (placeholder `md`) and any string as "Main font family". A typo here changes the whole product's appearance for every user. _Fix: `Select` for radius (the four token values), `Select` for font family._

### Could improve

1. **"Progress summary" and "Comment for donor" sit side by side in the report form** (`ReportForm.tsx:359,369`) with no indication that the second is what a donor actually reads. The label says "for donor"; the weight does not.
2. **Placeholders are inconsistent in voice.** Some are examples (`Anucha Pankham`), some are instructions (`Search districts`), some are format (`08x xxx xxxx`). Examples are the most useful of the three; instructions belong in the label.
3. **`Select` fields do not consistently set `clearable`.** Student's teacher and scholarship are clearable, the report's student is not, scholarship's grant type is not. Whether a choice can be undone is currently a per-field accident.
4. **No form marks up `aria-invalid` or `aria-describedby` explicitly** — Mantine does it for `error`, so only the sixteen banner-only forms are affected. Fixed for free by adopting `fieldValidation`.
5. **Date fields have no consistent placeholder.** `DD/MM/YYYY` in the student form after this pass, empty everywhere else.

### What works well

- **`fieldValidation.ts` is the right abstraction, correctly built.** A map of field → sentence, a count for the summary, `firstError` against a declared field order, and focus rather than scroll. The comment on why scrolling is not focus is exactly the reasoning a reviewer wants to find.
- **`StudentFields.tsx` renders both the add and the edit screen** from one definition, so field order, labels and required marks cannot drift between them. `SchoolForm` and `TeacherForm` follow the same page/drawer pattern.
- **Thai-first placeholders.** `โรงเรียน...`, `เช่น อารยา สุขใจ`, `บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด` — the forms are written for the people who fill them in, not translated at them afterwards.
- **The label style is centralised.** One `.mantine-InputWrapper-label` rule and a matching `FieldLabel` component for non-input controls, so a SegmentedControl's label is pixel-identical to a TextInput's.
- **Descriptions are banned on purpose,** with the reason written down. Whether or not you agree, it is a decision rather than a drift.

---

## Changes applied in this pass

| File | Change |
| --- | --- |
| `design-system/components/FormLayout.tsx` | New `optional()` helper — the "mark the minority" counterpart to the required asterisk |
| `design-system/components/FormLayout.module.scss` | `.optionalTag` |
| `design-system/index.ts` | Exports `optional` |
| `admin/StudentFields.tsx` | Six `placeholder="Optional"` replaced with format examples |
| `admin/TeacherForm.tsx`, `admin/AdminTeacherOverviewPage.tsx` | The two optional fields on a mostly-required form now marked |
| `admin/SchoolForm.tsx`, `admin/AdminDirectory.module.scss` | Reporting-period hint rendered as visible content (`description` is hidden product-wide); new `.fieldHint` |
| `admin/AdminStudentOverviewPage.tsx` ×2, `admin/AdminEditDonorPage.tsx`, `teacher/TeacherStudentDetailPage.tsx` | `aria-label` on four unlabelled textareas |

---

## Changes applied — second pass

| Area | Change |
| --- | --- |
| `design-system/fieldValidation.ts` | Moved out of `modules/admin`; exported from `design-system/index.ts` |
| `design-system/format.ts` | `CURRENCY_OPTIONS` |
| `design-system/branding.ts` | `BUTTON_RADIUS_OPTIONS`, `FONT_FAMILY_OPTIONS` |
| `admin/schoolProfile.ts` | `gradeOptions()` — one grade list, keeping whatever a record already holds |
| `reports/reportRecord.ts` | `validateReportDetails` returns `FieldErrors<ReportField>`; `REPORT_FIELD_ORDER` |
| `reports/ReportForm.tsx` | Field-level errors on 7 fields; donor section hint; placeholders |
| Scholarship (create + edit) | `validateAward` with 5 marked fields; currency select |
| Grant type (create + edit) | Name error on the field; currency select |
| Donor (create + edit) | Name now required and validated — there was no client validation at all; email and phone formats |
| `AdminCreateUserPage` | Name, email and phone marked separately |
| `ProfilePage` | Email uses the shared `isEmail`; password length and match marked on the fields |
| `TeacherProfilePage` | Runs the admin validator (minus email and school, which are read-only here) |
| `TeacherStudentDetailPage` | Same rules as the admin student form, school included; grade picker |
| Auth ×3 | Password rules marked on the fields; `autoComplete` on all four screens |
| `AdminBrandingPage` | Radius and font family are selects |
| `DonorRenewPage` | Tooltip replaced with visible hint; `optional()` on the grant-type field |
| `ContributionDrawer`, `StudentFields` | Amounts are `NumberInput` with a separator |

## Full field inventory

Every control, by form. `**yes**` in Required means the control carries `required`/`withAsterisk`; it does **not** mean the save is blocked without it — the two disagree in the places noted above.

### Add / edit student (page + drawer)

`src/modules/admin/StudentFields.tsx` — 16 fields, 4 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 136 | TextInput | Student name | **yes** | Anucha Pankham |
| 145 | TextInput | Nickname | no | e.g. Nong |
| 193 | DateInput | Birthdate | no | DD/MM/YYYY |
| 207 | TextInput | Village | no | e.g. Ban Mai |
| 217 | Textarea | Short bio / background | no | Anything that helps a donor or a teacher understand this student's situation. |
| 232 | TextInput | Guardian name | **yes** | Malee Pankham |
| 241 | Select | Relationship to student | no | e.g. Mother |
| 253 | TextInput | Phone | **yes** | 08x xxx xxxx |
| 262 | TextInput | Address | no | House no., Moo, subdistrict |
| 269 | TextInput | LINE / WhatsApp | no | @line-id or +66… |
| 297 | TextInput | Grade level | no | e.g. P4, M2 |
| 308 | Select | School | **yes** | Select school |
| 321 | TextInput | Grade level | no | e.g. P4, M2 |
| 346 | Select | Responsible teacher | no | Select teacher |
| 357 | Select | Scholarship / grant type | no | Select scholarship |
| 367 | TextInput | Monthly support expected (THB) | no | e.g. 800 |

### Add school (page + drawer)

`src/modules/admin/SchoolForm.tsx` — 22 fields, 6 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 329 | SegmentedControl | **— none —** | no | — |
| 337 | Select | Grade from | no | — |
| 338 | Select | Grade to | no | — |
| 339 | Select | Dormitory status | no | — |
| 342 | Select | Reporting period | no | — |
| 357 | TextInput | Thai school name | **yes** | โรงเรียน... |
| 358 | TextInput | English school name | **yes** | Ban ... School |
| 359 | TextInput | School code | no | 50100123 |
| 365 | Select | Province | **yes** | — |
| 366 | TextInput | District | **yes** | Search districts |
| 367 | TextInput | Subdistrict | **yes** | Search subdistricts |
| 368 | DateInput | Date joined iCare | no | — |
| 371 | Textarea | Thai address | no | บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด |
| 372 | Textarea | English address | no | House no., Moo, subdistrict, district, province |
| 378 | TextInput | Principal name | no | Name (ชื่อ-สกุล) |
| 379 | TextInput | Principal phone | no | 08x xxx xxxx |
| 380 | TextInput | Principal email | no | name@icare.or.th |
| 386 | TextInput | Contact person | **yes** | Name (ชื่อ-สกุล) |
| 387 | TextInput | Contact phone | no | 08x xxx xxxx |
| 388 | TextInput | Contact email | no | name@icare.or.th |
| 389 | TextInput | LINE ID | no | LINE ID |
| 394 | Textarea | Description | no | Anything a field officer should know before visiting |

### Add teacher (page + drawer)

`src/modules/admin/TeacherForm.tsx` — 8 fields, 6 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 453 | TextInput | Full name (English) | **yes** | e.g. Araya Sukjai |
| 461 | TextInput | Full name (Thai) | **yes** | เช่น อารยา สุขใจ |
| 476 | TextInput | Email address | **yes** | name@school.org |
| 485 | TextInput | Phone number | **yes** | 08x xxx xxxx |
| 493 | TextInput | LINE ID | **yes** | @teacher-line-id |
| 521 | Select | School | **yes** | {columnsReady === false ? "Not available yet" : "Select school"} |
| 555 | MultiSelect | {optional("Assign students")} | no | {studentIds.length ? undefined : "Search students by name"} |
| 592 | Textarea | {optional("Notes")} | no | Languages spoken, travel constraints, preferred contact time… |

### Term report (admin + teacher)

`src/modules/reports/ReportForm.tsx` — 13 fields, 3 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 285 | Select | Student | **yes** | Select student |
| 300 | DateInput | Report date | **yes** | — |
| 306 | DateInput | Covers from | no | Optional |
| 313 | DateInput | Covers until | no | Optional |
| 326 | Select | Status | **yes** | — |
| 334 | DateInput | Due date | no | Optional |
| 346 | TextInput | Grade | no | e.g. A, Pass, 3.5 |
| 352 | TextInput | Grade as a number | no | Optional, e.g. 78 |
| 359 | TextInput | Progress summary | no | e.g. Very good progress |
| 369 | Textarea | Comment for donor | no | What changed for this student this term? |
| 380 | Textarea | Internal note | no | Optional |
| 436 | Checkbox | Share with donors | no | — |
| 460 | Checkbox | Share with donors | no | — |

### Add donor

`src/modules/admin/AdminCreateDonorPage.tsx` — 10 fields, 0 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 148 | TextInput | Name | no | e.g., Jane Doe or Company XYZ |
| 154 | Select | Agent | no | No agent |
| 168 | TextInput | Email | no | name@example.com |
| 179 | TextInput | Phone | no | +66… |
| 185 | TextInput | Other contact (Line, WhatsApp, etc.) | no | — |
| 190 | Textarea | Address | no | — |
| 201 | Switch | Wants email updates | no | — |
| 206 | Switch | Wants newsletter | no | — |
| 211 | Select | Preferred language | no | — |
| 224 | Textarea | Internal note | no | Visible only to admins (e.g., payment details, preferences). |

### Edit donor

`src/modules/admin/AdminEditDonorPage.tsx` — 10 fields, 0 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 394 | TextInput | Name | no | — |
| 400 | Textarea | Address | no | — |
| 408 | TextInput | Email | no | — |
| 413 | TextInput | Phone | no | — |
| 420 | TextInput | Other contact (Line, WhatsApp, etc.) | no | — |
| 426 | Select | Agent | no | No agent |
| 440 | Switch | Wants email updates | no | — |
| 447 | Switch | Wants newsletter | no | — |
| 454 | Select | Preferred language | no | — |
| 468 | Textarea | Internal notes | no | Visible only to admins (e.g., payment details, preferences). |

### Add scholarship award

`src/modules/admin/AdminCreateScholarshipPage.tsx` — 12 fields, 3 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 254 | Select | Grant type | **yes** | Select grant type |
| 282 | Select | Student | no | Select student |
| 291 | Select | Donor | no | Select donor |
| 305 | DateInput | Period start | **yes** | — |
| 306 | DateInput | Period end | **yes** | — |
| 307 | NumberInput | Amount for scholarship period | no | e.g. 8400, 150000 |
| 314 | TextInput | Currency | no | — |
| 324 | Select | Status | no | — |
| 336 | Switch | Paid | no | — |
| 341 | DateInput | Payment date | no | — |
| 348 | TextInput | Payment note / reference | no | — |
| 357 | Textarea | Notes | no | — |

### Edit scholarship award

`src/modules/admin/AdminEditScholarshipPage.tsx` — 12 fields, 3 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 315 | Select | Grant type | **yes** | Select grant type |
| 329 | Select | Student | no | Select student |
| 338 | Select | Donor | no | Select donor |
| 352 | DateInput | Period start | **yes** | — |
| 353 | DateInput | Period end | **yes** | — |
| 354 | NumberInput | Amount for scholarship period | no | e.g. 8400 |
| 361 | TextInput | Currency | no | — |
| 371 | Select | Status | no | — |
| 383 | Switch | Paid | no | — |
| 388 | DateInput | Payment date | no | — |
| 395 | TextInput | Payment note / reference | no | — |
| 404 | Textarea | Notes | no | — |

### Add grant type

`src/modules/admin/AdminCreateGrantTypePage.tsx` — 5 fields, 1 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 84 | TextInput | Name | **yes** | — |
| 91 | Textarea | Description | no | Short explanation, conditions, scope… |
| 103 | NumberInput | Standard scholarship amount | no | e.g. 6000, 8400, 160000 |
| 110 | TextInput | Currency | no | — |
| 115 | NumberInput | Default duration (months) | no | e.g. 3, 12, 16, or 48 for full university |

### Edit grant type

`src/modules/admin/AdminEditGrantTypePage.tsx` — 5 fields, 1 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 147 | TextInput | Name | **yes** | — |
| 154 | Textarea | Description | no | Short explanation, conditions, scope… |
| 166 | NumberInput | Standard scholarship amount | no | e.g. 6000, 8400, 160000 |
| 173 | TextInput | Currency | no | — |
| 178 | NumberInput | Default duration (months) | no | e.g. 3, 12, 16, or 48 for full university |

### Add user account

`src/modules/admin/AdminCreateUserPage.tsx` — 4 fields, 2 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 150 | TextInput | Full name | **yes** | Jane Doe |
| 157 | TextInput | Email | **yes** | user@example.com |
| 165 | TextInput | Phone | no | +66 ... |
| 178 | Switch | {role.charAt(0).toUpperCase() + role.slice(1)} | no | — |

### Edit school (legacy, 2 fields)

`src/modules/admin/AdminEditSchoolPage.tsx` — 2 fields, 1 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 114 | TextInput | School name | **yes** | — |
| 120 | Textarea | Address | no | — |

### Organisation branding

`src/modules/admin/AdminBrandingPage.tsx` — 10 fields, 0 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 129 | FileInput | Upload logo (PNG/JPG/SVG) | no | Choose file |
| 142 | ColorInput | Primary color | no | — |
| 147 | ColorInput | Secondary color | no | — |
| 152 | TextInput | Main font family | no | — |
| 157 | TextInput | Button radius | no | md |
| 169 | TextInput | Hero title | no | iCare Donor Dashboard |
| 175 | TextInput | Hero subtitle | no | Helping children in remote schools, together. |
| 187 | TextInput | Login title | no | Welcome back |
| 193 | TextInput | Login subtitle | no | Sign in to manage students, donors and reports. |
| 205 | TextInput | Email for donor communication | no | contact@your-organization.org |

### Teacher record — inline edit

`src/modules/admin/AdminTeacherOverviewPage.tsx` — 7 fields, 5 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 515 | TextInput | Full name (English) | **yes** | — |
| 522 | TextInput | Full name (Thai) | **yes** | เช่น อารยา สุขใจ |
| 536 | TextInput | Email address | **yes** | — |
| 544 | TextInput | Phone number | **yes** | 08x xxx xxxx |
| 552 | TextInput | LINE ID | **yes** | @teacher-line-id |
| 589 | MultiSelect | {optional("Assigned students")} | no | {draftStudentIds.length ? undefined : "Search students by name"} |
| 620 | Textarea | {optional("Admin notes")} | no | Languages spoken, travel constraints, preferred contact time… |

### Student record — notes

`src/modules/admin/AdminStudentOverviewPage.tsx` — 2 fields, 0 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 693 | Textarea | Write a note about this student | no | Write a note about this student… |
| 745 | Textarea | Edit this note | no | — |

### Student record — donor profile tab

`src/modules/admin/DonorProfileTab.tsx` — 4 fields, 0 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 287 | Select | Profile status | no | — |
| 304 | Select | Consent | no | — |
| 334 | TextInput | Display name | no | e.g. Nong Anucha |
| 342 | Textarea | Donor-facing description | no | What this student enjoys, what they are working towards, what the sponsorship changes. |

### Sign in

`src/modules/auth/LoginPage.tsx` — 2 fields, 2 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 92 | TextInput | Email | **yes** | you@example.com |
| 101 | PasswordInput | Password | **yes** | Your password |

### Reset password

`src/modules/auth/ResetPasswordPage.tsx` — 3 fields, 3 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 203 | TextInput | Email | **yes** | you@example.com |
| 241 | PasswordInput | New password | **yes** | — |
| 255 | PasswordInput | Confirm new password | **yes** | — |

### Accept invite

`src/modules/auth/AcceptInvitePage.tsx` — 2 fields, 2 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 117 | PasswordInput | New password | **yes** | — |
| 123 | PasswordInput | Confirm password | **yes** | — |

### Set first password

`src/modules/auth/WelcomeSetPasswordPage.tsx` — 2 fields, 2 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 156 | PasswordInput | Password | **yes** | — |
| 163 | PasswordInput | Confirm password | **yes** | — |

### Record a contribution

`src/modules/donor/ContributionDrawer.tsx` — 5 fields, 2 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 148 | TextInput | Amount (THB) | **yes** | 60,000 |
| 158 | DateInput | Date received | **yes** | Pick the day the money arrived |
| 171 | Select | How it arrived | no | — |
| 178 | TextInput | Reference | no | Transfer or receipt number |
| 188 | Textarea | Internal note | no | Sent through the Chiang Rai office; receipt posted. |

### Donor renewal request

`src/modules/donor/DonorRenewPage.tsx` — 4 fields, 3 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 297 | TextInput | Your name | **yes** | — |
| 304 | TextInput | Your email | **yes** | — |
| 313 | Select | If you'd like to continue with a specific grant type, select it here. | no | No preference |
| 337 | Textarea | Your message | **yes** | Tell us how you'd like to continue, increase, adjust, or update your support. |

### My profile (all roles)

`src/modules/profile/ProfilePage.tsx` — 5 fields, 0 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 271 | TextInput | Email | no | — |
| 278 | TextInput | Full name | no | — |
| 284 | TextInput | Phone | no | — |
| 306 | PasswordInput | New password | no | — |
| 312 | PasswordInput | Confirm new password | no | — |

### Teacher — my profile

`src/modules/teacher/TeacherProfilePage.tsx` — 4 fields, 1 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 201 | TextInput | Full name (English) | **yes** | — |
| 207 | TextInput | Full name (Thai) | no | เช่น อารยา สุขใจ |
| 213 | TextInput | Phone number | no | 08x xxx xxxx |
| 219 | TextInput | LINE ID | no | @your-line-id |

### Teacher — edit student

`src/modules/teacher/TeacherStudentDetailPage.tsx` — 13 fields, 3 required

| Line | Control | Label | Required | Placeholder |
| --- | --- | --- | --- | --- |
| 434 | FileInput | Profile photo | no | Upload image |
| 457 | TextInput | Name | **yes** | — |
| 463 | TextInput | Nickname | no | — |
| 469 | Select | Grade level | no | Select grade |
| 480 | TextInput | Village / community | no | — |
| 487 | DateInput | Birthdate | no | — |
| 493 | Select | School | no | Select school |
| 502 | TextInput | Expected monthly support (THB) | no | e.g. 1000 |
| 520 | TextInput | Guardian name | **yes** | — |
| 526 | TextInput | Phone number | **yes** | — |
| 532 | TextInput | Address | no | — |
| 537 | TextInput | LINE / WhatsApp | no | — |
| 552 | Textarea | Background / notes | no | — |

