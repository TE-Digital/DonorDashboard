# Design Review: School, Teacher and Student forms

Reviewed against: DESIGN_BRIEF.md (`.design/teacher-invite-and-access/`)
Philosophy: Lumen — operational software, spreadsheet-familiar, rationed blue
Date: 2026-08-29
Scope: field sets, form flow, and validation states across `SchoolForm`, `TeacherForm`, `StudentForm`/`StudentFields`

## Screenshots Captured

None. No Playwright MCP or Cursor browser MCP is connected to this session, so this is a code and interaction review. What is missing without them: rendered field alignment, error-state appearance, focus rings, and the real responsive behaviour of the four-column grids below.

To complete the visual half, run the app and capture, for each of `/admin/schools/new`, `/admin/teachers/new` and `/admin/students/new`:

| Screenshot | Breakpoint | What to show |
| --- | --- | --- |
| `review-<form>-desktop-1280.png` | 1280×800 | Full form, empty |
| `review-<form>-tablet-768.png` | 768×1024 | Column collapse |
| `review-<form>-mobile-375.png` | 375×812 | Single column, footer |
| `review-<form>-error.png` | 1280×800 | Submit an empty form |
| `review-<form>-focus.png` | 1280×800 | A focused field |

Save into `.design/teacher-invite-and-access/screenshots/`.

## Summary

The field sets are close to right and the multi-step drawer flow is genuinely good — creating a school or a student without losing a half-typed teacher is better than most products manage. The weakness is uniform and it is the thing you asked about: **all three forms validate one error at a time, as a sentence at the top, and never mark the field that caused it.** Fifteen required fields across the three forms share a single error slot. Beyond that, three field-level gaps matter: a school contact who cannot be contacted, dates with no bounds, and phone numbers with no format check on a platform whose whole recovery path is phoning somebody.

## Must Fix

1. **One error at a time, never on the field.** `validateStudentDetails` ([studentProfile.ts:206](../../src/modules/admin/studentProfile.ts#L206)), `validateTeacherDetails` ([teacherProfile.ts:102](../../src/modules/admin/teacherProfile.ts#L102)) and `SchoolForm`'s inline checks ([SchoolForm.tsx:150](../../src/modules/admin/SchoolForm.tsx#L150)) all return on the first failure. The message lands in one `FormError` at the top of the form ([StudentForm.tsx:313](../../src/modules/admin/StudentForm.tsx#L313)). An admin who left four required fields empty fixes one, submits, is told about the next, and repeats — four round trips through a form that scrolls. Nothing turns red. Nothing takes focus.
   _Fix: validators return `Record<field, string>` instead of `string | null`. Pass each message to its input's `error` prop, which Mantine already renders and ties to the field with `aria-describedby`. Keep the top-of-form summary as a count ("3 fields need attention") and move focus to the first invalid field on submit._

2. **A required contact person with no required way to contact them.** `SchoolForm` requires Contact person ([SchoolForm.tsx:158](../../src/modules/admin/SchoolForm.tsx#L158)) but leaves contact phone, email and LINE all optional. A school can be saved whose coordination contact is a name and nothing else. Meanwhile `TeacherForm` requires email, phone *and* LINE ID from every teacher. The same organisation cannot need three channels from a teacher and zero from the person who coordinates a whole school.
   _Fix: require at least one of phone / email / LINE on the school contact, validated as a group with the message on the group rather than on one field._

3. **Dates have no bounds.** Student birthdate is checked only for being parseable ([studentProfile.ts:214](../../src/modules/admin/studentProfile.ts#L214)) — a birthdate in 2087 saves, and every age calculation downstream then reads negative. `Date joined iCare` defaults to today but accepts any future date. Neither `DateInput` sets `maxDate`.
   _Fix: `maxDate={new Date()}` on both, plus a floor on birthdate (a student born before ~1990 is a typo, not a student), validated as well as constrained — the picker is not the only way a value gets in._

## Should Fix

1. **Phone numbers are required but never checked.** Student phone ([studentProfile.ts:209](../../src/modules/admin/studentProfile.ts#L209)) and teacher phone ([teacherProfile.ts:111](../../src/modules/admin/teacherProfile.ts#L111)) reject only the empty string. `"n/a"`, `"ask Kru Nok"` and a number missing three digits all pass. On a platform whose stated fallback when email fails is to ring somebody or message them on LINE, an unusable phone number is a broken recovery path.
   _Fix: one shared Thai-format check (09-digit mobile, optional +66, spaces and dashes tolerated) beside `EMAIL_PATTERN`, used by both forms._

2. **Email is validated in one form only.** `EMAIL_PATTERN` is applied to the teacher's email. Principal email and school contact email carry `type="email"` and no validation — and since submit calls `preventDefault`, the browser's own check never runs either. `type="email"` here is decoration.
   _Fix: run the same pattern on any non-empty email in all three forms._

3. **Grade range is not a range.** Grade from and Grade to are two independent selects ([SchoolForm.tsx:241](../../src/modules/admin/SchoolForm.tsx#L241)); nothing stops "P6 to K1". A student's grade level is never checked against the school's range either, though the school stores one.
   _Fix: validate `gradeTo >= gradeFrom` on save. The student cross-check is a warning, not an error — a student genuinely can be outside the usual range._

4. **The error summary scrolls, it does not focus.** `reportError` calls `scrollIntoView` ([StudentForm.tsx:133](../../src/modules/admin/StudentForm.tsx#L133), same in the other two). A keyboard user is scrolled to a message their focus is not on, and a screen-reader user is told nothing at all — `FormError` is not a live region.
   _Fix: `role="alert"` on the error container and move focus to the first invalid field._

5. **Duplicate detection exists in one place only.** `TeacherForm` handles the duplicate-email case well ([TeacherForm.tsx:110](../../src/modules/admin/TeacherForm.tsx#L110)) with a message that names the address and points at Users & roles. A second school with the same Thai name, or a second student with the same name at the same school, is created silently.
   _Fix: at minimum warn on an exact school-name match before insert._

## Could Improve

1. **Required marks are inconsistent with the validators.** Teacher form marks LINE ID `required` and the validator enforces it — but LINE is a channel, not an identity, and requiring it will produce placeholder values. Consider whether it is genuinely mandatory, then make the asterisk and the validator agree either way.
2. **Validation only ever runs on submit.** For the two fields with a real format — email and phone — validating on blur once the field has been touched costs one state flag and removes a submit cycle. Never validate on keystroke; it scolds people mid-typing.
3. **`monthlySupport` accepts a bare number with no bound.** `parseSupport` rejects non-numbers but not `999999999` or a negative. A sanity ceiling would catch a slipped decimal.
4. **School code is free text.** A Thai school code has a shape (8 digits). If it matters enough to collect, it is worth a soft format check; if it does not, it could go.
5. **One leftover field description.** `SchoolForm`'s reporting-period select still carried a `description` prop after the platform-wide removal. Fixed during this review ([SchoolForm.tsx:245](../../src/modules/admin/SchoolForm.tsx#L245)).

## Flow

The flow holds up, and two parts of it are notably good:

- **Nested creation without nested drawers.** `TeacherFormDrawer` changes step rather than stacking a second panel, keeping the half-typed teacher mounted behind it and returning the new school or student already selected. This is the correct solution to a problem most apps solve with a second modal on top of the first.
- **Degradation when a migration is missing.** All three forms detect absent columns and drop those fields with a note naming the migration, rather than failing the save. `isMissingColumnError` is applied consistently.

Two flow observations:

1. **The teacher's school and their students' schools can silently disagree.** The teacher form assigns a school and, separately, assigns students — who carry their own school. Nothing notices when they differ. The Teachers directory now shows this as "Ban Nong Khai +2", which surfaces it, but the form that creates the situation says nothing at the time.
   _Suggestion: when an assigned student's school differs from the teacher's, say so inline. Not an error — it happens — but not a silent one._
2. **Student → responsible teacher is ranked, not restricted.** `rankTeachersForSchool` floats the chosen school's teachers to the top and still allows any teacher. That is the right call; no change needed.

## What Works Well

- **The shared vocabulary holds.** `teacherProfile.ts`, `studentProfile.ts` and `schoolProfile.ts` each define their record once, and both the drawer and the route form read from it. Two screens cannot disagree about a field, which is the failure mode this pattern exists to prevent.
- **Failure messages are written for the person reading them.** `inviteFailureMessage` distinguishes duplicate account, non-admin caller, expired session and rate limit, and each one tells the admin what to do next. This is the standard the field-level validation should be brought up to — the sentences are already good, they are just delivered one at a time and in the wrong place.
- **The migration-pending notes name the file to apply.** `TEACHER_FIELDS_PENDING_NOTE` and its siblings turn a support conversation into a copy-paste.
- **Contact collapses into one cell.** `ContactCell` replacing separate email and phone columns, with copy-to-clipboard and a named confirmation, is the right read of what an admin actually does with an address.
