// src/modules/admin/teacherProfile.ts
//
// One definition of what a teacher record is, shared by the add-teacher form
// and the teacher overview so the two never disagree about a field.
//
// Four of the fields — Thai name, LINE ID, school and notes — live in columns
// added by supabase/migrations/20260820090000_teacher_profile_fields.sql. Until
// that migration is applied PostgREST rejects any request naming them, so every
// read and write here falls back to the four columns that have always existed
// and reports `extended: false`. Screens use that flag to explain why those
// fields are missing instead of failing the whole save.

import { supabase } from "../../lib/supabaseClient";
import { isEmail, isPhone, type FieldErrors } from "../../design-system/fieldValidation";

/** Columns that exist on `profiles` regardless of migration state. */
export const TEACHER_BASE_COLUMNS = "id, full_name, email, phone, created_at";

/** Base columns plus the ones the teacher form needs. */
export const TEACHER_EXTENDED_COLUMNS = `${TEACHER_BASE_COLUMNS}, full_name_th, line_id, school_id, notes`;

export interface TeacherProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  full_name_th: string | null;
  line_id: string | null;
  school_id: string | null;
  notes: string | null;
}

/** The form's shape — every value a string, as the inputs hold them. */
/** Every field the form can mark. */
export type TeacherField = keyof TeacherDetailsInput;

export interface TeacherDetailsInput {
  fullName: string;
  fullNameTh: string;
  email: string;
  phone: string;
  lineId: string;
  schoolId: string | null;
  notes: string;
}

export const EMPTY_TEACHER_DETAILS: TeacherDetailsInput = {
  fullName: "",
  fullNameTh: "",
  email: "",
  phone: "",
  lineId: "",
  schoolId: null,
  notes: "",
};

/**
 * Shown wherever a screen had to drop the extended fields. Naming the migration
 * makes the fix a copy-paste rather than a support conversation.
 */
export const TEACHER_FIELDS_PENDING_NOTE =
  "Thai name, LINE ID, school and notes could not be saved: the profiles table does not have those columns yet. Apply supabase/migrations/20260820090000_teacher_profile_fields.sql, then reopen this teacher and save again.";

/**
 * True when PostgREST refused a request because a column is not in the schema.
 *
 * A select names an unknown column and Postgres answers 42703; an insert or
 * update names one and PostgREST answers PGRST204 from its own schema cache.
 * The message check catches a stale cache that reports neither.
 */
export const isMissingColumnError = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("does not exist") || message.includes("schema cache");
};

/**
 * Whether the extended columns exist yet.
 *
 * A form asks before it decides what to require: making the school mandatory
 * and then dropping it on save is worse than not asking for it at all.
 */
export const teacherColumnsAvailable = async (): Promise<boolean> => {
  const { error } = await supabase.from("profiles").select(TEACHER_EXTENDED_COLUMNS).limit(1);
  if (!error) return true;
  if (isMissingColumnError(error)) return false;
  // An unrelated failure (offline, RLS) must not silently strip fields from the
  // form — assume the columns are there and let the save report the real error.
  console.error("Error probing teacher profile columns", error);
  return true;
};


/**
 * Required-field check for the teacher form, as a map of field to message.
 *
 * Every problem at once, not the first one: an admin who left four fields empty
 * should see four marked fields, not make four submits.
 *
 * Email, phone and LINE ID are all mandatory: LINE is how field staff actually
 * reach a teacher, and the phone number is the fallback when it fails.
 *
 * The school is only required when there is somewhere to put it — see
 * {@link teacherColumnsAvailable}.
 */
export const validateTeacherDetails = (
  values: TeacherDetailsInput,
  options: { requireSchool?: boolean } = {},
): FieldErrors<TeacherField> => {
  const { requireSchool = true } = options;
  const errors: FieldErrors<TeacherField> = {};

  if (!values.fullName.trim()) errors.fullName = "Full name in English is required.";
  if (!values.fullNameTh.trim()) errors.fullNameTh = "Full name in Thai is required.";

  if (!values.email.trim()) {
    errors.email = "An email address is required — the invitation is sent to it.";
  } else if (!isEmail(values.email)) {
    errors.email = "Enter a valid email address, for example name@school.org.";
  }

  if (!values.phone.trim()) {
    errors.phone = "A phone number is required.";
  } else if (!isPhone(values.phone)) {
    errors.phone = "Enter a Thai phone number, for example 081 234 5678.";
  }

  if (!values.lineId.trim()) errors.lineId = "A LINE ID is required.";
  if (requireSchool && !values.schoolId) errors.schoolId = "Select the school this teacher represents.";

  return errors;
};

/** The order the form asks for these, so focus lands where the eye already is. */
export const TEACHER_FIELD_ORDER = [
  "fullName",
  "fullNameTh",
  "email",
  "phone",
  "lineId",
  "schoolId",
] as const satisfies readonly TeacherField[];

/** The row payload for the extended columns, trimmed and nulled. */
const extendedPayload = (values: TeacherDetailsInput) => ({
  full_name_th: values.fullNameTh.trim() || null,
  line_id: values.lineId.trim() || null,
  school_id: values.schoolId,
  notes: values.notes.trim() || null,
});

/** The row payload for the columns that always exist. */
const basePayload = (values: TeacherDetailsInput) => ({
  full_name: values.fullName.trim(),
  email: values.email.trim().toLowerCase(),
  phone: values.phone.trim() || null,
});

export interface TeacherProfileResult {
  profile: TeacherProfile | null;
  /** False when the extended columns are not in the database yet. */
  extended: boolean;
  error: string | null;
}

/** Reads one teacher, degrading to the base columns if the migration is pending. */
export const loadTeacherProfile = async (id: string): Promise<TeacherProfileResult> => {
  const { data, error } = await supabase
    .from("profiles")
    .select(TEACHER_EXTENDED_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (!error && data) {
    return { profile: data as unknown as TeacherProfile, extended: true, error: null };
  }

  if (error && !isMissingColumnError(error)) {
    console.error("Error loading teacher profile", error);
    return { profile: null, extended: true, error: error.message };
  }

  if (!error && !data) {
    return { profile: null, extended: true, error: null };
  }

  const { data: base, error: baseError } = await supabase
    .from("profiles")
    .select(TEACHER_BASE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (baseError) {
    console.error("Error loading teacher profile", baseError);
    return { profile: null, extended: false, error: baseError.message };
  }

  return {
    profile: base
      ? ({ ...(base as object), full_name_th: null, line_id: null, school_id: null, notes: null } as TeacherProfile)
      : null,
    extended: false,
    error: null,
  };
};

export interface SaveTeacherResult {
  /** False when the extended fields had to be dropped to complete the save. */
  extended: boolean;
  error: string | null;
}

/**
 * Writes the teacher's details to `profiles`.
 *
 * The full payload is tried first. If the extended columns are missing the base
 * fields are still saved, and the caller is told so it can surface
 * {@link TEACHER_FIELDS_PENDING_NOTE} rather than claim a complete save.
 */
export const saveTeacherProfile = async (
  id: string,
  values: TeacherDetailsInput,
): Promise<SaveTeacherResult> => {
  const { error } = await supabase
    .from("profiles")
    .update({ ...basePayload(values), ...extendedPayload(values) })
    .eq("id", id);

  if (!error) return { extended: true, error: null };

  if (!isMissingColumnError(error)) {
    console.error("Error saving teacher profile", error);
    return { extended: true, error: error.message };
  }

  const { error: baseError } = await supabase
    .from("profiles")
    .update(basePayload(values))
    .eq("id", id);

  if (baseError) {
    console.error("Error saving teacher profile", baseError);
    return { extended: false, error: baseError.message };
  }

  return { extended: false, error: null };
};

/**
 * Points a set of students at this teacher, and releases the ones that were
 * unticked. Both halves matter: an edit that only adds leaves a student
 * assigned to a teacher who no longer lists them.
 */
export const syncTeacherStudents = async (
  teacherId: string,
  selectedIds: string[],
  previousIds: string[],
): Promise<string | null> => {
  const added = selectedIds.filter((id) => !previousIds.includes(id));
  const removed = previousIds.filter((id) => !selectedIds.includes(id));

  if (added.length) {
    const { error } = await supabase
      .from("students")
      .update({ responsible_teacher_id: teacherId })
      .in("id", added);
    if (error) {
      console.error("Error assigning students", error);
      return error.message;
    }
  }

  if (removed.length) {
    const { error } = await supabase
      .from("students")
      .update({ responsible_teacher_id: null })
      .in("id", removed);
    if (error) {
      console.error("Error unassigning students", error);
      return error.message;
    }
  }

  return null;
};
