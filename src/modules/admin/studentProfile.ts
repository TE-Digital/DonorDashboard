// src/modules/admin/studentProfile.ts
//
// One definition of what a student record is, shared by the add-student form,
// the edit screen and the student's own page — so the three never disagree
// about a field, an order, or what is required.
//
// The record is grouped the way a person is described rather than the way the
// table is shaped:
//
//   1. Personal details — who the student is, and who to call about them
//   2. School           — where they study
//   3. Teacher & support— who looks after them, and under which grant
//
// Two of those groups do not map to columns. The guardian block lives in
// `students.contact` (jsonb), which the database requires to carry a guardian
// and a phone — `students_contact_required` rejects a row without them, so the
// check happens here, in words, rather than as a constraint error an admin has
// to decode. The photo lives in the `student-profiles` bucket, keyed by the
// student's id, which is why it can only be written after the first save.

import { supabase } from "../../lib/supabaseClient";
import { isMissingColumnError } from "./teacherProfile";

/* --------------------------------------------------------------- The shape */

export interface StudentDetailsInput {
  // 1. Personal details
  name: string;
  nickname: string;
  birthdate: string;
  village: string;
  bio: string;
  guardianName: string;
  guardianRelationship: string | null;
  phone: string;
  address: string;
  lineOrWhatsApp: string;

  // 2. School
  schoolId: string | null;
  gradeLevel: string;

  // 3. Teacher & support
  teacherProfileId: string | null;
  grantTypeId: string | null;
  monthlySupport: string;
}

export const EMPTY_STUDENT_DETAILS: StudentDetailsInput = {
  name: "",
  nickname: "",
  birthdate: "",
  village: "",
  bio: "",
  guardianName: "",
  guardianRelationship: null,
  phone: "",
  address: "",
  lineOrWhatsApp: "",
  schoolId: null,
  gradeLevel: "",
  teacherProfileId: null,
  grantTypeId: null,
  monthlySupport: "",
};

/**
 * How the guardian is related to the student.
 *
 * A fixed list rather than free text, because it is read in aggregate — "how
 * many of our students live with a grandparent?" is a question the programme
 * asks. "Other" is last and always available; anything it hides belongs in the
 * background notes.
 */
export const GUARDIAN_RELATIONSHIPS = [
  "Mother",
  "Father",
  "Grandparent",
  "Aunt or uncle",
  "Sibling",
  "Other relative",
  "Legal guardian",
  "Other",
] as const;

/**
 * The columns a student has had since the beginning.
 *
 * Every screen falls back to these when the lifecycle migration has not been
 * applied. PostgREST rejects an entire select if it names one column that does
 * not exist, so without a fallback an unapplied migration does not degrade a
 * feature — it empties the directory.
 */
export const STUDENT_BASE_COLUMNS =
  "id, name, nickname, school_id, grade_level, village, scholarship, contact, birthdate, monthly_support_expected, responsible_teacher_id, grant_type_id, bio, profile_photo_path, created_at";

/** Base columns plus everything 20260828120000_student_record_lifecycle.sql adds. */
export const STUDENT_COLUMNS = `${STUDENT_BASE_COLUMNS}, status, archived_at, enrolled_on, donor_display_name, donor_description, donor_photo_path, donor_profile_status, consent_status, consent_recorded_at, donor_card_sent_at`;

export interface StudentRecord {
  id: string;
  name: string;
  nickname: string | null;
  school_id: string | null;
  grade_level: string | null;
  village: string | null;
  scholarship: string | null;
  contact: Record<string, string | null> | null;
  birthdate: string | null;
  monthly_support_expected: number | null;
  responsible_teacher_id: string | null;
  grant_type_id: string | null;
  bio: string | null;
  profile_photo_path: string | null;
  created_at?: string | null;

  // Lifecycle. Added by 20260828120000_student_record_lifecycle.sql.
  status?: "enrolled" | "archived" | null;
  archived_at?: string | null;
  enrolled_on?: string | null;

  // The donor-facing card. Deliberately separate from everything above.
  donor_display_name?: string | null;
  donor_description?: string | null;
  donor_photo_path?: string | null;
  donor_profile_status?: "draft" | "awaiting_review" | "published" | null;
  consent_status?: "pending" | "approved" | "declined" | null;
  consent_recorded_at?: string | null;
  donor_card_sent_at?: string | null;
}

/* ---------------------------------------------------------- Row ⇄ form */

/** The stored row, as a form holds it. */
export const toStudentDetails = (record: StudentRecord): StudentDetailsInput => {
  const contact = record.contact ?? {};
  return {
    name: record.name ?? "",
    nickname: record.nickname ?? "",
    birthdate: record.birthdate ?? "",
    village: record.village ?? "",
    bio: record.bio ?? "",
    guardianName: contact.guardian ?? "",
    guardianRelationship: contact.relationship ?? null,
    phone: contact.phone ?? "",
    address: contact.address ?? "",
    lineOrWhatsApp: contact.line_or_whatsapp ?? "",
    schoolId: record.school_id ?? null,
    gradeLevel: record.grade_level ?? "",
    teacherProfileId: record.responsible_teacher_id ?? null,
    grantTypeId: record.grant_type_id ?? null,
    monthlySupport:
      record.monthly_support_expected != null ? String(record.monthly_support_expected) : "",
  };
};

/**
 * The form's values as a row.
 *
 * `scholarship` is a text label denormalised from the chosen grant type. It is
 * what donor-facing screens read, so it is written from the same choice rather
 * than typed twice.
 */
export const toStudentRow = (
  values: StudentDetailsInput,
  scholarshipLabel: string | null,
) => ({
  name: values.name.trim(),
  nickname: values.nickname.trim() || null,
  school_id: values.schoolId,
  grade_level: values.gradeLevel.trim() || null,
  birthdate: values.birthdate || null,
  village: values.village.trim() || null,
  monthly_support_expected: parseSupport(values.monthlySupport),
  responsible_teacher_id: values.teacherProfileId,
  grant_type_id: values.grantTypeId,
  scholarship: scholarshipLabel,
  bio: values.bio.trim() || null,
  contact: {
    guardian: values.guardianName.trim(),
    relationship: values.guardianRelationship,
    phone: values.phone.trim(),
    address: values.address.trim() || null,
    line_or_whatsapp: values.lineOrWhatsApp.trim() || null,
  },
});

/** "1,200" and "1200" are the same number of baht. Empty is not zero. */
export const parseSupport = (value: string): number | null => {
  const cleaned = value.replace(/[,\s฿]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
};

/* ------------------------------------------------------------- Validation */

/**
 * The first problem with these values, or null.
 *
 * Required here means required to save: a name, a guardian with a phone number,
 * and the school the student attends. Everything else can be filled in later
 * from the student's own page, and asking for it up front only stops a record
 * being created at all.
 */
export const validateStudentDetails = (values: StudentDetailsInput): string | null => {
  if (!values.name.trim()) return "The student's name is required.";
  if (!values.guardianName.trim()) return "A guardian name is required on every student.";
  if (!values.phone.trim()) return "A contact phone number is required on every student.";
  if (!values.schoolId) return "Select the school this student attends.";
  if (values.monthlySupport.trim() && parseSupport(values.monthlySupport) == null) {
    return "Monthly support must be a number, for example 800.";
  }
  if (values.birthdate && Number.isNaN(new Date(values.birthdate).getTime())) {
    return "Enter the birthdate as a date, or leave it empty.";
  }
  return null;
};

/* ---------------------------------------------------------------- Lookups */

export interface Option {
  value: string;
  label: string;
}

export interface SchoolOption extends Option {
  is_active: boolean;
}

/**
 * Schools for a picker.
 *
 * Only active ones are offered for a new placement, but a school already on a
 * record is always included — an inactive school must not silently vanish from
 * the student who attends it. Falls back to every school when the is_active
 * migration has not been applied.
 */
export const loadSchoolOptions = async (keepId?: string | null): Promise<SchoolOption[]> => {
  const withFlag = await supabase.from("schools").select("id, name, is_active").order("name");

  const rows =
    withFlag.error != null
      ? ((await supabase.from("schools").select("id, name").order("name")).data ?? []).map(
          (school: any) => ({ ...school, is_active: true }),
        )
      : (withFlag.data ?? []);

  return (rows as Array<{ id: string; name: string | null; is_active: boolean | null }>)
    .filter((school) => school.is_active !== false || school.id === keepId)
    .map((school) => ({
      value: school.id,
      label: school.is_active === false ? `${school.name ?? "(no name)"} (closed)` : school.name ?? "(no name)",
      is_active: school.is_active !== false,
    }));
};

export interface TeacherOption extends Option {
  /** The school this teacher represents, when the profile records one. */
  schoolId: string | null;
}

/**
 * Every teacher with an account, each carrying the school they represent.
 *
 * The form narrows this to the chosen school rather than the query doing it:
 * a teacher whose profile has no school yet would otherwise disappear from
 * every picker, and the list is small enough to hold.
 */
export const loadTeacherOptions = async (): Promise<TeacherOption[]> => {
  const { data: roles } = await supabase
    .from("person_roles")
    .select("user_id")
    .eq("role", "teacher");

  const teacherIds = Array.from(
    new Set(((roles ?? []) as Array<{ user_id: string }>).map((row) => row.user_id)),
  );
  if (!teacherIds.length) return [];

  const withSchool = await supabase
    .from("profiles")
    .select("id, full_name, school_id")
    .in("id", teacherIds);

  const rows =
    withSchool.error != null
      ? ((await supabase.from("profiles").select("id, full_name").in("id", teacherIds)).data ?? [])
      : (withSchool.data ?? []);

  return (rows as Array<{ id: string; full_name: string | null; school_id?: string | null }>)
    .map((profile) => ({
      value: profile.id,
      label: profile.full_name ?? "(no name)",
      schoolId: profile.school_id ?? null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

/**
 * Teachers at the chosen school first, then the rest.
 *
 * Not a hard filter. A teacher's school is recorded on their profile and is
 * often blank on older records, and a student is occasionally looked after by
 * somebody from another school — hiding them would make the form unusable in
 * exactly the cases that need a human.
 */
export const rankTeachersForSchool = (
  teachers: TeacherOption[],
  schoolId: string | null,
): { atSchool: TeacherOption[]; elsewhere: TeacherOption[] } => {
  if (!schoolId) return { atSchool: [], elsewhere: teachers };
  return {
    atSchool: teachers.filter((teacher) => teacher.schoolId === schoolId),
    elsewhere: teachers.filter((teacher) => teacher.schoolId !== schoolId),
  };
};

export const loadGrantTypeOptions = async (): Promise<Option[]> => {
  const { data } = await supabase.from("grant_types").select("id, name").order("name");
  return ((data ?? []) as Array<{ id: string; name: string | null }>).map((grant) => ({
    value: grant.id,
    label: grant.name ?? "(no name)",
  }));
};

/* ------------------------------------------------------------------ Photo */

export const STUDENT_PHOTO_BUCKET = "student-profiles";

export const studentPhotoUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  const { data } = supabase.storage.from(STUDENT_PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

/** What can be uploaded, and how much of it. Stated on the control, not guessed. */
export const PHOTO_ACCEPT = "image/png,image/jpeg,image/webp";
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const photoProblem = (file: File): string | null => {
  if (!PHOTO_ACCEPT.split(",").includes(file.type)) {
    return "The photo must be a JPG, PNG or WebP image.";
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return "The photo must be smaller than 5 MB.";
  }
  return null;
};

export interface PhotoUploadResult {
  path: string | null;
  error: string | null;
}

/**
 * Stores a student's photo and links it to the record.
 *
 * Keyed by student id and upserted, so re-uploading replaces rather than piles
 * up. The caller passes an id, which is why a photo chosen on the add form is
 * uploaded after the insert, not before it.
 */
export const uploadStudentPhoto = async (
  studentId: string,
  file: File,
): Promise<PhotoUploadResult> => {
  const problem = photoProblem(file);
  if (problem) return { path: null, error: problem };

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `students/${studentId}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(STUDENT_PHOTO_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: true });

  if (uploadError) {
    console.error("Error uploading student photo", uploadError);
    return { path: null, error: "The photo could not be uploaded. You can add it later from the student's page." };
  }

  const { error: linkError } = await supabase
    .from("students")
    .update({ profile_photo_path: path })
    .eq("id", studentId);

  if (linkError) {
    console.error("Error linking student photo", linkError);
    return { path: null, error: "The photo was uploaded but could not be linked to the student." };
  }

  return { path, error: null };
};

/* ------------------------------------------------------------- Lifecycle */

export type StudentStatus = "enrolled" | "archived";

export const STUDENT_STATUS_META: Record<StudentStatus, { label: string; tone: "success" | "neutral"; hint: string }> = {
  enrolled: {
    label: "Enrolled",
    tone: "success",
    hint: "This student is in the programme.",
  },
  archived: {
    label: "Archived",
    tone: "neutral",
    hint: "This student has left the programme. Every record about them is kept.",
  },
};

/* ------------------------------------------------------ Profile completion */

/**
 * What "a complete student record" means, in one list.
 *
 * The percentage on the profile and the percentage in the directory are this
 * same calculation — two different definitions of "complete" is how a number
 * stops being trusted. Order matters: it is the order the fields appear in on
 * the record, so "jump to the first thing missing" lands somewhere sensible.
 *
 * `required` marks what the programme cannot work without. Those are flagged
 * inline on the record; the rest simply count.
 */
export interface CompletionField {
  /** Matches the anchor id on the student's page: `field-<key>`. */
  key: string;
  label: string;
  required: boolean;
  filled: (record: StudentRecord) => boolean;
}

const text = (value: string | null | undefined) => Boolean(value && value.trim());

export const COMPLETION_FIELDS: CompletionField[] = [
  { key: "name", label: "Student name", required: true, filled: (s) => text(s.name) },
  { key: "nickname", label: "Nickname", required: false, filled: (s) => text(s.nickname) },
  { key: "photo", label: "Photo", required: false, filled: (s) => text(s.profile_photo_path) },
  { key: "birthdate", label: "Birthdate", required: false, filled: (s) => text(s.birthdate) },
  { key: "village", label: "Village", required: false, filled: (s) => text(s.village) },
  { key: "guardian", label: "Guardian name", required: true, filled: (s) => text(s.contact?.guardian) },
  { key: "relationship", label: "Relationship to student", required: false, filled: (s) => text(s.contact?.relationship) },
  { key: "phone", label: "Phone", required: true, filled: (s) => text(s.contact?.phone) },
  { key: "address", label: "Address", required: false, filled: (s) => text(s.contact?.address) },
  { key: "line", label: "LINE / WhatsApp", required: false, filled: (s) => text(s.contact?.line_or_whatsapp) },
  { key: "bio", label: "Short bio", required: false, filled: (s) => text(s.bio) },
  { key: "school", label: "School", required: true, filled: (s) => Boolean(s.school_id) },
  { key: "grade", label: "Grade level", required: false, filled: (s) => text(s.grade_level) },
  { key: "teacher", label: "Responsible teacher", required: false, filled: (s) => Boolean(s.responsible_teacher_id) },
  { key: "support", label: "Monthly support expected", required: false, filled: (s) => s.monthly_support_expected != null },
];

export interface ProfileCompletion {
  percent: number;
  filled: number;
  total: number;
  /** In record order, so the first entry is the first gap on the page. */
  missing: CompletionField[];
  /** Missing fields the programme cannot work without. */
  missingRequired: CompletionField[];
}

export const profileCompletion = (record: StudentRecord): ProfileCompletion => {
  const missing = COMPLETION_FIELDS.filter((field) => !field.filled(record));
  const filled = COMPLETION_FIELDS.length - missing.length;

  return {
    percent: Math.round((filled / COMPLETION_FIELDS.length) * 100),
    filled,
    total: COMPLETION_FIELDS.length,
    missing,
    missingRequired: missing.filter((field) => field.required),
  };
};

/** A percentage's tone: red under half, amber under complete, green at full. */
export const completionTone = (percent: number): "success" | "warning" | "danger" =>
  percent >= 100 ? "success" : percent >= 50 ? "warning" : "danger";

/* ------------------------------------------------------------ Donor card */

export type DonorProfileStatus = "draft" | "awaiting_review" | "published";
export type ConsentStatus = "pending" | "approved" | "declined";

export const DONOR_PROFILE_META: Record<DonorProfileStatus, { label: string; tone: "neutral" | "info" | "success" }> = {
  draft: { label: "Draft", tone: "neutral" },
  awaiting_review: { label: "Awaiting review", tone: "info" },
  published: { label: "Published", tone: "success" },
};

export const CONSENT_META: Record<ConsentStatus, { label: string; tone: "warning" | "success" | "danger" }> = {
  pending: { label: "Consent pending", tone: "warning" },
  approved: { label: "Consent approved", tone: "success" },
  declined: { label: "Consent declined", tone: "danger" },
};

/**
 * The whole donor-facing card, as its own shape.
 *
 * Three fields, and no way to reach the student row from here. A card built by
 * hiding fields from the record is one careless render away from a child's
 * address in front of a stranger; a card that never held the address cannot
 * leak it.
 */
export interface DonorCard {
  displayName: string;
  description: string;
  photoUrl: string | null;
}

export interface DonorProfileState {
  profileStatus: DonorProfileStatus;
  consent: ConsentStatus;
  card: DonorCard;
  sentAt: string | null;
}

/**
 * Why this card cannot be sent yet, or null when it can.
 *
 * Both conditions are named separately, because "you cannot send this" without
 * saying which of the two is missing is a dead end.
 */
export const sendBlockedReason = (state: DonorProfileState): string | null => {
  if (state.consent !== "approved") {
    return state.consent === "declined"
      ? "The family has declined consent. Nothing about this student can be sent to a donor."
      : "Consent has not been approved yet. Record the family's consent before sending anything.";
  }
  if (state.profileStatus !== "published") {
    return "This profile is not published yet. Publish it once the photo, name and description have been checked.";
  }
  if (!state.card.displayName.trim() || !state.card.description.trim()) {
    return "The card needs a display name and a description before it can be sent.";
  }
  return null;
};

/* ------------------------------------------------------------- Reading it */

export interface StudentReadResult<T> {
  data: T;
  /**
   * False when the lifecycle columns are missing, so a screen can say why
   * archiving and the donor profile are unavailable instead of failing.
   */
  extended: boolean;
  error: string | null;
}

/**
 * Every student, with the extended columns if the database has them.
 *
 * Tries the full list, and on the one error that means "that column is not
 * here" retries with the columns that have always existed. Any other failure is
 * a real failure and is reported as one — an empty table is not an honest
 * answer to "the server said no".
 */
export const loadStudentRecords = async (): Promise<StudentReadResult<StudentRecord[]>> => {
  const extended = await supabase.from("students").select(STUDENT_COLUMNS).order("name");

  if (!extended.error) {
    return { data: (extended.data ?? []) as unknown as StudentRecord[], extended: true, error: null };
  }

  if (!isMissingColumnError(extended.error)) {
    console.error("Error loading students", extended.error);
    return { data: [], extended: true, error: readFailure(extended.error) };
  }

  const base = await supabase.from("students").select(STUDENT_BASE_COLUMNS).order("name");

  if (base.error) {
    console.error("Error loading students", base.error);
    return { data: [], extended: false, error: readFailure(base.error) };
  }

  return { data: (base.data ?? []) as unknown as StudentRecord[], extended: false, error: null };
};

/** One student, degrading the same way. */
export const loadStudentRecord = async (
  studentId: string,
): Promise<StudentReadResult<StudentRecord | null>> => {
  const extended = await supabase
    .from("students")
    .select(STUDENT_COLUMNS)
    .eq("id", studentId)
    .maybeSingle();

  if (!extended.error) {
    return { data: (extended.data as unknown as StudentRecord) ?? null, extended: true, error: null };
  }

  if (!isMissingColumnError(extended.error)) {
    console.error("Error loading student", extended.error);
    return { data: null, extended: true, error: readFailure(extended.error) };
  }

  const base = await supabase
    .from("students")
    .select(STUDENT_BASE_COLUMNS)
    .eq("id", studentId)
    .maybeSingle();

  if (base.error) {
    console.error("Error loading student", base.error);
    return { data: null, extended: false, error: readFailure(base.error) };
  }

  return { data: (base.data as unknown as StudentRecord) ?? null, extended: false, error: null };
};

/** Named so a screen can tell somebody what is missing rather than showing nothing. */
export const STUDENT_LIFECYCLE_PENDING_NOTE =
  "Archiving, the donor profile and report status need columns the database does not have yet. Apply supabase/migrations/20260828120000_student_record_lifecycle.sql, then reload.";

const readFailure = (error: { code?: string; message?: string } | null): string => {
  const message = (error?.message ?? "").toLowerCase();
  if (error?.code === "42501" || message.includes("row-level security")) {
    return "Your account is not allowed to see these students.";
  }
  return "The students could not be loaded. Check your connection, then try again.";
};
