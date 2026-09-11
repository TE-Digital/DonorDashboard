// src/modules/admin/StudentForm.tsx
//
// Creating a student, wherever that is done from.
//
// Three groups, in the order somebody describes a child to you:
//
//   1. Personal details — who they are, and who to call about them
//   2. School           — where they study
//   3. Teacher & support— who looks after them, and under which grant
//
// The guardian sits inside personal details rather than in a contact section of
// its own, because a guardian is not a separate record: they are how this
// student is reached. `students_contact_required` agrees — a student row cannot
// exist without a guardian name and a phone number.
//
// Two fields need something that does not exist yet at the moment they are
// filled in. A school can be created from the school step without losing the
// half-typed student, and so can a teacher. A photo is held in memory and
// uploaded straight after the insert, because the storage path is keyed by the
// student's id, and the id is what the insert returns.
//
// The field shapes, validation and lookups all live in studentProfile.ts, which
// the edit screen and the student's own page read as well. Adding a field here
// alone is how three screens start disagreeing.

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FormBody, FormError, FormFooter, LoadingState } from "../../design-system";
import { Button } from "../../design-system/lumen";
import { supabase } from "../../lib/supabaseClient";
import { writeFailureMessage, type EntityFormHandle, type EntityFormOwnerProps } from "./entityForm";
import { SchoolFormDrawer } from "./SchoolFormDrawer";
import { StudentFields } from "./StudentFields";
import { logEvent } from "./studentEvents";
import styles from "./AdminDirectory.module.scss";
import type { CreatedSchool } from "./SchoolForm";
import {
  EMPTY_STUDENT_DETAILS,
  loadGrantTypeOptions,
  loadSchoolOptions,
  loadTeacherOptions,
  photoProblem,
  toStudentRow,
  uploadStudentPhoto,
  validateStudentDetails,
  STUDENT_FIELD_ORDER,
  type Option,
  type SchoolOption,
  type StudentDetailsInput,
  type StudentField,
  type TeacherOption,
} from "./studentProfile";
import {
  errorSummary,
  firstError,
  focusField,
  hasErrors,
  type FieldErrors,
} from "../../design-system/fieldValidation";

/** Namespaces this form's field ids — the student fields render in two forms. */
const FORM_ID = "student-form";

export interface CreatedStudent {
  id: string;
  name: string;
  grade_level: string | null;
  school_id: string | null;
}

export interface StudentFormProps extends EntityFormOwnerProps {
  onCreated: (student: CreatedStudent) => void;
  /** Preselects the school. Passed by the school page, where it is not a choice. */
  defaultSchoolId?: string | null;
  /** Preselects the responsible teacher, from a teacher's own page. */
  defaultTeacherId?: string | null;
  /** Hides the school picker when the context already fixes the school. */
  lockSchool?: boolean;
  /**
   * Handed in when this form is already inside a drawer. The container turns
   * "Add school" / "Add teacher" into a step of that same drawer instead of a
   * second drawer stacked on the first. Left out on a full-page form, where
   * this component opens its own.
   */
  onRequestCreateSchool?: () => void;
  onRequestCreateTeacher?: () => void;
  /** Schools created by the container's step, merged in and selected. */
  extraSchools?: Array<{ id: string; name: string }>;
  /** Teachers created by the container's step, merged in and selected. */
  extraTeachers?: Array<{ id: string; name: string; schoolId: string | null }>;
  /** Reports the chosen school upward, so a container's teacher step starts there. */
  onSchoolChange?: (schoolId: string | null) => void;
}

export const StudentForm = forwardRef<EntityFormHandle, StudentFormProps>(
  (
    {
      onCreated,
      defaultSchoolId = null,
      defaultTeacherId = null,
      lockSchool = false,
      onRequestCreateSchool,
      onRequestCreateTeacher,
      extraSchools,
      extraTeachers,
      onSchoolChange,
      onSavingChange,
      onErrorChange,
      onDirtyChange,
      onCancel,
      showActions = false,
      submitLabel = "Create student",
    },
    ref,
  ) => {
    const DRAFT_KEY = "student_form_draft";

    const [details, setDetails] = useState<StudentDetailsInput>(() => {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...EMPTY_STUDENT_DETAILS,
            schoolId: defaultSchoolId,
            teacherProfileId: defaultTeacherId,
            ...parsed,
          };
        }
      } catch (e) {
        console.warn("Failed to restore student form draft:", e);
      }
      return {
        ...EMPTY_STUDENT_DETAILS,
        schoolId: defaultSchoolId,
        teacherProfileId: defaultTeacherId,
      };
    });

    // Held, not uploaded: the storage path needs the id the insert has not
    // returned yet. Nothing is written if the save fails.
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    const [schools, setSchools] = useState<SchoolOption[]>([]);
    const [teachers, setTeachers] = useState<TeacherOption[]>([]);
    const [grantTypes, setGrantTypes] = useState<Option[]>([]);

    const [schoolDrawerOpen, setSchoolDrawerOpen] = useState(false);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** What the last save attempt found wrong, per field. */
    const [fieldErrors, setFieldErrors] = useState<FieldErrors<StudentField>>({});

    const errorRef = useRef<HTMLDivElement>(null);

    const set = <K extends keyof StudentDetailsInput>(key: K, value: StudentDetailsInput[K]) =>
      setDetails((current) => ({ ...current, [key]: value }));

    /**
     * A field stops being wrong the moment it is edited.
     *
     * Leaving the message under a field somebody is actively fixing is nagging,
     * and it makes the summary count lie.
     */
    const clearFieldError = (key: StudentField) =>
      setFieldErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });

    /** Sets the error, tells the container, and brings it into view. */
    const reportError = (message: string | null) => {
      setError(message);
      onErrorChange?.(message);
      if (message) {
        requestAnimationFrame(() =>
          errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
        );
      }
    };

    useEffect(() => setDetails((current) => ({ ...current, schoolId: defaultSchoolId })), [defaultSchoolId]);
    useEffect(
      () => setDetails((current) => ({ ...current, teacherProfileId: defaultTeacherId })),
      [defaultTeacherId],
    );

    useEffect(() => {
      onSchoolChange?.(details.schoolId);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [details.schoolId]);

    useEffect(() => {
      const load = async () => {
        const [schoolOptions, teacherOptions, grantOptions] = await Promise.all([
          loadSchoolOptions(defaultSchoolId),
          loadTeacherOptions(),
          loadGrantTypeOptions(),
        ]);
        setSchools(schoolOptions);
        setTeachers(teacherOptions);
        setGrantTypes(grantOptions);
      };

      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A school or teacher created in the drawer's own step arrives as a prop
    // rather than through a reload: the lists were fetched once, and the
    // half-typed student must not be re-fetched out from under the admin.
    useEffect(() => {
      if (!extraSchools?.length) return;
      setSchools((current) => {
        const known = new Set(current.map((school) => school.value));
        const fresh = extraSchools
          .filter((school) => !known.has(school.id))
          .map((school) => ({ value: school.id, label: school.name, is_active: true }));
        return fresh.length ? [...current, ...fresh].sort((a, b) => a.label.localeCompare(b.label)) : current;
      });
      const latest = extraSchools[extraSchools.length - 1];
      setDetails((current) => (current.schoolId === latest.id ? current : { ...current, schoolId: latest.id }));
    }, [extraSchools]);

    useEffect(() => {
      if (!extraTeachers?.length) return;
      setTeachers((current) => {
        const known = new Set(current.map((teacher) => teacher.value));
        const fresh = extraTeachers
          .filter((teacher) => !known.has(teacher.id))
          .map((teacher) => ({ value: teacher.id, label: teacher.name, schoolId: teacher.schoolId }));
        return fresh.length ? [...current, ...fresh].sort((a, b) => a.label.localeCompare(b.label)) : current;
      });
      const latest = extraTeachers[extraTeachers.length - 1];
      setDetails((current) =>
        current.teacherProfileId === latest.id ? current : { ...current, teacherProfileId: latest.id },
      );
    }, [extraTeachers]);

    const choosePhoto = (file: File | null) => {
      if (!file) return;
      const problem = photoProblem(file);
      if (problem) {
        reportError(problem);
        return;
      }
      reportError(null);
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    };

    const clearPhoto = () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhoto(null);
      setPhotoPreview(null);
    };

    useEffect(
      () => () => {
        if (photoPreview) URL.revokeObjectURL(photoPreview);
      },
      [photoPreview],
    );

    // Dirty is measured against the values this form opened with, so a
    // container can ask before discarding. Comparing a snapshot rather than
    // counting keystrokes means typing something and deleting it again
    // correctly counts as clean.
    const currentValues = JSON.stringify(details);
    const openedWith = useRef<string>(currentValues);
    const dirty = currentValues !== openedWith.current || photo !== null;

    useEffect(() => {
      onDirtyChange?.(dirty);
      if (dirty) {
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(details));
        } catch (e) {
          console.warn("Failed to save student form draft", e);
        }
      }
    }, [dirty, details]);

    const setBusy = (next: boolean) => {
      setSaving(next);
      onSavingChange?.(next);
    };

    const handleSchoolCreated = (school: CreatedSchool) => {
      setSchools((current) =>
        [...current, { value: school.id, label: school.name, is_active: true }].sort((a, b) =>
          a.label.localeCompare(b.label),
        ),
      );
      set("schoolId", school.id);
      setSchoolDrawerOpen(false);
    };

    const save = async () => {
      reportError(null);

      const problems = validateStudentDetails(details);
      setFieldErrors(problems);

      if (hasErrors(problems)) {
        // The count at the top, the sentences on the fields, and the cursor in
        // the first one — so fixing four empty fields is one pass, not four.
        reportError(errorSummary(problems));
        focusField(FORM_ID, firstError(problems, STUDENT_FIELD_ORDER));
        return;
      }

      setBusy(true);

      const scholarshipLabel = details.grantTypeId
        ? grantTypes.find((grant) => grant.value === details.grantTypeId)?.label ?? null
        : null;

      const { data, error: insertError } = await supabase
        .from("students")
        .insert(toStudentRow(details, scholarshipLabel))
        .select("id, name, grade_level, school_id")
        .maybeSingle();

      if (insertError || !data?.id) {
        setBusy(false);
        console.error("Error creating student", insertError);
        reportError(writeFailureMessage(insertError, "student"));
        return;
      }

      // Clear the draft after successful creation
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {
        console.warn("Failed to clear student draft", e);
      }

      // The student exists from here on. A photo that fails to upload is
      // reported as exactly that — not as a failed save, which would send the
      // admin back to create a second record.
      await logEvent(
        data.id,
        "student_created",
        `${details.name.trim()} was added to the programme.`,
      );

      let photoNote: string | null = null;
      if (photo) {
        const result = await uploadStudentPhoto(data.id, photo);
        photoNote = result.error;
      }

      setBusy(false);

      if (photoNote) reportError(photoNote);

      onCreated({
        id: data.id,
        name: data.name ?? details.name.trim(),
        grade_level: data.grade_level ?? null,
        school_id: data.school_id ?? null,
      });
    };

    useImperativeHandle(ref, () => ({ submit: () => void save() }), [details, grantTypes, photo]);

    // Some fields carry helper text under their label and some don't, which
    // otherwise leaves the shorter fields' inputs sitting higher than their row
    // neighbours (Mantine only renders a description node when a field has
    // one). `.fieldAlign` in AdminDirectory.module.scss stretches every field
    // to the row height and pins its input to the bottom of that box, so
    // inputs land on the same baseline across a row regardless of which
    // fields have a description.
    return (
      <div className={styles.fieldAlign}>
        <FormBody
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <LoadingState variant="overlay" visible={saving} />
          <div ref={errorRef}>
            <FormError>{error}</FormError>
          </div>

        <StudentFields
          details={details}
          onChange={(next) => {
            // Whatever changed stops being an error; the rest of the marks stay.
            (Object.keys(next) as StudentField[])
              .filter((key) => next[key] !== details[key])
              .forEach(clearFieldError);
            setDetails(next);
          }}
          errors={fieldErrors}
          formId={FORM_ID}
          schools={schools}
          teachers={teachers}
          grantTypes={grantTypes}
          lockSchool={lockSchool}
          onAddSchool={
            lockSchool
              ? undefined
              : () => (onRequestCreateSchool ? onRequestCreateSchool() : setSchoolDrawerOpen(true))
          }
          onAddTeacher={onRequestCreateTeacher}
          photoUrl={photoPreview}
          photoBusy={saving}
          onChoosePhoto={choosePhoto}
          onClearPhoto={photo ? clearPhoto : undefined}
          photoHint={
            photo
              ? `${photo.name} — uploaded as soon as the student is created.`
              : "Optional. JPG, PNG or WebP up to 5 MB. It can also be added later from the student's page."
          }
        />

        {showActions && (
          <FormFooter
            left={
              onCancel && (
                <Button variant="ghost" type="button" onClick={onCancel}>
                  Cancel
                </Button>
              )
            }
          >
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? "Creating…" : submitLabel}
            </Button>
          </FormFooter>
        )}

        {/* On a full-page form, adding a school opens over the page. Inside a
            drawer the container turns it into a step instead. */}
        {!onRequestCreateSchool && (
          <SchoolFormDrawer
            opened={schoolDrawerOpen}
            onClose={() => setSchoolDrawerOpen(false)}
            onCreated={handleSchoolCreated}
          />
        )}
      </FormBody>
     </div>
    );
  },
);

StudentForm.displayName = "StudentForm";

export default StudentForm;
