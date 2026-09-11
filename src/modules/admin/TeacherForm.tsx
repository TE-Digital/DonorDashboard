// src/modules/admin/TeacherForm.tsx
//
// Creating a teacher, wherever that is done from.
//
// Grouped the way the record is used rather than the way the tables are shaped:
// who the person is, how to reach them, where they teach, who they are
// responsible for, and anything else worth writing down.
//
// Three writes happen behind one action:
//   1. admin-create-user   — the auth user, the profile row, the teacher role
//   2. profiles update     — Thai name, LINE ID, school, notes
//   3. students update     — responsible_teacher_id for the assigned students
//
// Step 2 needs the columns added by the teacher-profile migration;
// teacherProfile.ts degrades to the base columns when they are missing and the
// result says so, so the caller can report an incomplete save honestly.

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { MultiSelect, Select, SimpleGrid, TextInput, Textarea } from "@mantine/core";
import { useAuth } from "../auth/AuthContext";
import {
  FormBody,
  FormError,
  FormFooter,
  FormSection,
  InlineMessage,
  LoadingState,
  optional,
} from "../../design-system";
import { Button } from "../../design-system/lumen";
import { supabase } from "../../lib/supabaseClient";
import { SchoolFormDrawer } from "./SchoolFormDrawer";
import type { CreatedSchool } from "./SchoolForm";
import type { CreatedStudent } from "./StudentForm";
import type { EntityFormHandle, EntityFormOwnerProps } from "./entityForm";

// The add-student drawer opens the add-teacher form for its own "Add teacher"
// step, so a static import here would be a cycle. Loaded on first use instead,
// which is the only time it can possibly be needed.
const StudentFormDrawer = React.lazy(() => import("./StudentFormDrawer"));
import styles from "./AdminDirectory.module.scss";
import {
  EMPTY_TEACHER_DETAILS,
  saveTeacherProfile,
  syncTeacherStudents,
  teacherColumnsAvailable,
  validateTeacherDetails,
  TEACHER_FIELD_ORDER,
  type TeacherDetailsInput,
  type TeacherField,
} from "./teacherProfile";
import {
  errorSummary,
  fieldId,
  firstError,
  focusField,
  hasErrors,
  type FieldErrors,
} from "../../design-system/fieldValidation";

/** Namespaces this form's field ids — it renders both as a route and a drawer step. */
const FORM_ID = "teacher-form";

export interface CreatedTeacher {
  id: string;
  /** The name as typed, so a picker can show the new teacher without a reload. */
  fullName: string;
  /** The school they represent, for a picker that groups teachers by school. */
  schoolId: string | null;
  email: string;
  /** False when the extended profile fields could not be written. */
  extended: boolean;
  studentCount: number;
  /** A follow-up write that failed after the account was already created. */
  warning: string | null;
}

export interface TeacherFormProps extends EntityFormOwnerProps {
  onCreated: (teacher: CreatedTeacher) => void;
  /** Preselects the school. Passed by the school page, where it is not a choice. */
  defaultSchoolId?: string | null;
  /** Shows the school as fixed context instead of a picker. */
  lockSchool?: boolean;
  /**
   * Handed in when this form is already inside a drawer. The container then
   * turns "Create school" / "Create student" into a step of that same drawer
   * rather than a second drawer stacked on top of the first. Left out on a
   * full-page form, where opening a drawer over the page is the right answer,
   * and this component opens its own.
   */
  onRequestCreateSchool?: () => void;
  onRequestCreateStudent?: () => void;
  /** Reports the chosen school upward, so a container's student step can start there. */
  onSchoolChange?: (schoolId: string | null) => void;
  /** Schools created by the container's step, merged into the picker. */
  extraSchools?: SchoolOption[];
  /** Students created by the container's step, selected on arrival. */
  extraStudents?: StudentOption[];
}

interface SchoolOption {
  id: string;
  name: string;
}

interface StudentOption {
  id: string;
  name: string;
  grade_level: string | null;
  school_id: string | null;
  responsible_teacher_id: string | null;
}

/**
 * Turns the invite endpoint's plain-text failure into something an admin can
 * act on. Re-inviting somebody who already has an account is the common case by
 * a distance, and "review the details and try again" sends them hunting through
 * a form where nothing is actually wrong.
 */
const inviteFailureMessage = (status: number, detail: string, email: string): string => {
  const text = (detail || "").toLowerCase();

  if (text.includes("already been registered") || text.includes("already exists") || text.includes("duplicate")) {
    return `An account already exists for ${email}. Open it from Users and roles to add the teacher role, rather than inviting again.`;
  }
  if (status === 403) {
    return "Only an admin can invite a teacher, and this account isn't one.";
  }
  if (status === 401) {
    return "Your session has expired. Sign in again and retry the invitation.";
  }
  if (text.includes("rate") && text.includes("limit")) {
    return "The invitation service is busy right now. Wait a minute and try again.";
  }
  return "We couldn't create the teacher account. Check the details above and try again.";
};

export const TeacherForm = forwardRef<EntityFormHandle, TeacherFormProps>(
  (
    {
      onCreated,
      defaultSchoolId = null,
      lockSchool = false,
      onRequestCreateSchool,
      onRequestCreateStudent,
      onSchoolChange,
      extraSchools,
      extraStudents,
      onSavingChange,
      onErrorChange,
      onDirtyChange,
      onCancel,
      showActions = false,
      submitLabel = "Create and send invite",
    },
    ref,
  ) => {
    const { session } = useAuth();

    const [details, setDetails] = useState<TeacherDetailsInput>({
      ...EMPTY_TEACHER_DETAILS,
      schoolId: defaultSchoolId,
    });
    const [studentIds, setStudentIds] = useState<string[]>([]);

    const [schools, setSchools] = useState<SchoolOption[]>([]);
    const [students, setStudents] = useState<StudentOption[]>([]);
    const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});

    const [schoolDrawerOpen, setSchoolDrawerOpen] = useState(false);
    const [studentDrawerOpen, setStudentDrawerOpen] = useState(false);

    /** Null while the probe is in flight — the field stays enabled until we know. */
    const [columnsReady, setColumnsReady] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const errorRef = useRef<HTMLDivElement>(null);
    /** What the last save attempt found wrong, per field. */
    const [fieldErrors, setFieldErrors] = useState<FieldErrors<TeacherField>>({});

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

    const set = <K extends keyof TeacherDetailsInput>(key: K, value: TeacherDetailsInput[K]) => {
      // A field stops being wrong the moment it is edited. Leaving the message
      // under a field somebody is fixing is nagging, and it makes the count lie.
      setFieldErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
      setDetails((current) => ({ ...current, [key]: value }));
    };

    /** id + error together, so no field can be marked without being reachable. */
    const field = (key: TeacherField) => ({ id: fieldId(FORM_ID, key), error: fieldErrors[key] });

    useEffect(() => {
      if (defaultSchoolId) setDetails((current) => ({ ...current, schoolId: defaultSchoolId }));
    }, [defaultSchoolId]);

    useEffect(() => {
      onSchoolChange?.(details.schoolId);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [details.schoolId]);

    useEffect(() => {
      const load = async () => {
        const [schoolResult, studentResult, profileResult] = await Promise.all([
          supabase.from("schools").select("id, name").order("name"),
          supabase
            .from("students")
            .select("id, name, grade_level, school_id, responsible_teacher_id")
            .order("name"),
          supabase.from("profiles").select("id, full_name"),
        ]);

        if (schoolResult.error) console.error("Error loading schools", schoolResult.error);
        if (studentResult.error) console.error("Error loading students", studentResult.error);

        setSchools((schoolResult.data ?? []) as SchoolOption[]);
        setStudents((studentResult.data ?? []) as StudentOption[]);
        setTeacherNames(
          Object.fromEntries(
            ((profileResult.data ?? []) as Array<{ id: string; full_name: string | null }>).map(
              (profile) => [profile.id, profile.full_name ?? "another teacher"],
            ),
          ),
        );
      };

      void load();
      void teacherColumnsAvailable().then(setColumnsReady);
    }, []);

    const byName = (a: { name: string | null }, b: { name: string | null }) =>
      (a.name ?? "").localeCompare(b.name ?? "");

    // A school or student created in the drawer's own step arrives here as a
    // prop rather than through a reload: the lists were fetched once, and the
    // half-typed teacher must not be re-fetched out from under the admin.
    useEffect(() => {
      if (!extraSchools?.length) return;
      setSchools((current) => {
        const known = new Set(current.map((school) => school.id));
        const fresh = extraSchools.filter((school) => !known.has(school.id));
        return fresh.length ? [...current, ...fresh].sort(byName) : current;
      });
      const latest = extraSchools[extraSchools.length - 1];
      setDetails((current) =>
        current.schoolId === latest.id ? current : { ...current, schoolId: latest.id },
      );
    }, [extraSchools]);

    useEffect(() => {
      if (!extraStudents?.length) return;
      setStudents((current) => {
        const known = new Set(current.map((student) => student.id));
        const fresh = extraStudents.filter((student) => !known.has(student.id));
        return fresh.length ? [...current, ...fresh].sort(byName) : current;
      });
      setStudentIds((current) => {
        const chosen = new Set(current);
        const added = extraStudents.filter((student) => !chosen.has(student.id));
        return added.length ? [...current, ...added.map((student) => student.id)] : current;
      });
    }, [extraStudents]);

    const schoolName = useMemo(
      () => schools.find((school) => school.id === details.schoolId)?.name ?? null,
      [schools, details.schoolId],
    );

    /**
     * Students at the chosen school first, then everyone else. A teacher normally
     * takes students from their own school, but the list stays complete because a
     * student's school is not always recorded.
     */
    const studentOptions = useMemo(() => {
      const label = (student: StudentOption) => {
        const parts = [student.name || "(no name)"];
        if (student.grade_level) parts.push(`Class ${student.grade_level}`);
        if (student.responsible_teacher_id) {
          parts.push(
            `currently with ${teacherNames[student.responsible_teacher_id] ?? "another teacher"}`,
          );
        }
        return parts.join(" · ");
      };

      const rank = (student: StudentOption) =>
        details.schoolId && student.school_id === details.schoolId ? 0 : 1;

      return [...students]
        .sort((a, b) => rank(a) - rank(b) || (a.name ?? "").localeCompare(b.name ?? ""))
        .map((student) => ({ value: student.id, label: label(student) }));
    }, [students, teacherNames, details.schoolId]);

    /** Selected students who already answer to somebody else. */
    const reassigned = useMemo(
      () =>
        students.filter(
          (student) => studentIds.includes(student.id) && student.responsible_teacher_id,
        ),
      [students, studentIds],
    );

    const handleSchoolCreated = (school: CreatedSchool) => {
      setSchools((current) =>
        [...current, school].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
      );
      set("schoolId", school.id);
      setSchoolDrawerOpen(false);
    };

    const handleStudentCreated = (student: CreatedStudent) => {
      setStudents((current) =>
        [...current, { ...student, responsible_teacher_id: null }].sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? ""),
        ),
      );
      setStudentIds((current) => [...current, student.id]);
      setStudentDrawerOpen(false);
    };


    // Dirty is measured against the values this form opened with, so a
    // container can ask before discarding. Comparing a snapshot rather than
    // counting keystrokes means typing something and deleting it again
    // correctly counts as clean.
    const currentValues = JSON.stringify({ details, studentIds });
    const openedWith = useRef<string>(currentValues);
    const dirty = currentValues !== openedWith.current;

    useEffect(() => {
      onDirtyChange?.(dirty);
    }, [dirty]);

    const setBusy = (next: boolean) => {
      setSaving(next);
      onSavingChange?.(next);
    };

    const save = async () => {
      reportError(null);

      const problems = validateTeacherDetails(details, {
        requireSchool: columnsReady !== false,
      });
      setFieldErrors(problems);

      if (hasErrors(problems)) {
        // The count at the top, the sentences on the fields, and the cursor in
        // the first one — so fixing four empty fields is one pass, not four.
        reportError(errorSummary(problems));
        focusField(FORM_ID, firstError(problems, TEACHER_FIELD_ORDER));
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        console.error("VITE_SUPABASE_URL is not configured.");
        reportError("We couldn't reach the invitation service. Try again in a minute.");
        return;
      }

      setBusy(true);
      try {
        const authHeader: Record<string, string> = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {};

        const response = await fetch(`${supabaseUrl}/functions/v1/admin-create-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({
            full_name: details.fullName.trim(),
            email: details.email.trim().toLowerCase(),
            phone: details.phone.trim() || null,
            roles: ["teacher"],
          }),
        });

        if (!response.ok) {
          const detail = await response.text();
          console.error("teacher invite error", detail);
          reportError(inviteFailureMessage(response.status, detail, details.email.trim()));
          return;
        }

        const payload = await response.json();
        const user = payload?.user as { id?: string; email?: string } | undefined;
        if (!user?.id) {
          console.error("admin-create-user returned no user id", payload);
          reportError(
            "The account was created, but we couldn't finish setting it up. Check the teacher list, or try again.",
          );
          return;
        }

        // The account exists from here on, so nothing below is reported as a
        // failed creation — the outcome of each follow-up write is passed up.
        const profileResult = await saveTeacherProfile(user.id, details);
        const assignError = studentIds.length
          ? await syncTeacherStudents(user.id, studentIds, [])
          : null;

        if (profileResult.error) console.error("Teacher profile save failed", profileResult.error);
        if (assignError) console.error("Teacher student assignment failed", assignError);

        onCreated({
          id: user.id,
          fullName: details.fullName.trim(),
          schoolId: details.schoolId,
          email: user.email || details.email.trim().toLowerCase(),
          extended: profileResult.extended,
          studentCount: studentIds.length,
          warning: profileResult.error
            ? "The teacher was created, but we couldn't save all of their details. Add them from the teacher's page."
            : assignError
              ? "The teacher was created, but we couldn't assign their students. Assign them from the teacher's page."
              : null,
        });
      } catch (requestError: unknown) {
        console.error("Unexpected error creating teacher", requestError);
        reportError("We couldn't reach the invitation service. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
    };

    useImperativeHandle(ref, () => ({ submit: () => void save() }), [details, studentIds, session]);

    return (
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

        <FormSection
          title="Teacher name"
        >
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <TextInput
              label="Full name (English)"
              {...field("fullName")}
              placeholder="Araya Sukjai"
              required
              value={details.fullName}
              onChange={(event) => set("fullName", event.currentTarget.value)}
            />
            <TextInput
              label="Full name (Thai)"
              {...field("fullNameTh")}
              placeholder="อารยา สุขใจ"
              required
              value={details.fullNameTh}
              onChange={(event) => set("fullNameTh", event.currentTarget.value)}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection
          title="Contact details"
        >
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <TextInput
              label="Email address"
              inputMode="email"
              autoComplete="email"
              {...field("email")}
              placeholder="name@school.org"
              required
              type="email"
              value={details.email}
              onChange={(event) => set("email", event.currentTarget.value)}
            />
            <TextInput
              label="Phone number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              {...field("phone")}
              placeholder="08x xxx xxxx"
              required
              value={details.phone}
              onChange={(event) => set("phone", event.currentTarget.value)}
            />
            <TextInput
              label="LINE ID"
              {...field("lineId")}
              placeholder="@teacher-line-id"
              required
              value={details.lineId}
              onChange={(event) => set("lineId", event.currentTarget.value)}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title="School">
          {columnsReady === false && (
            <div className={styles.sectionNoteLead}>
              <InlineMessage tone="warning">
                We can't link a teacher to a school yet. That part is still being set up. Set the
                school from the teacher's page for now.
              </InlineMessage>
            </div>
          )}
          {lockSchool ? (
            <InlineMessage tone="info">
              This teacher will represent {schoolName ?? "this school"}.
            </InlineMessage>
          ) : (
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <Select
                label="School"
                {...field("schoolId")}
                placeholder={columnsReady === false ? "Not available yet" : "Select school"}
                required={columnsReady !== false}
                disabled={columnsReady === false}
                searchable
                clearable
                nothingFoundMessage="No school matches. Create it instead."
                data={schools.map((school) => ({ value: school.id, label: school.name }))}
                value={details.schoolId}
                onChange={(value) => set("schoolId", value)}
              />
              <div className={styles.fieldAction}>
                <Button
                  variant="secondary"
                  icon="plus"
                  type="button"
                  disabled={columnsReady === false}
                  onClick={() =>
                    onRequestCreateSchool ? onRequestCreateSchool() : setSchoolDrawerOpen(true)
                  }
                >
                  Create school
                </Button>
              </div>
            </SimpleGrid>
          )}
        </FormSection>

        <FormSection
          title="Students"
        >
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <MultiSelect
              label={optional("Assign students")}
              placeholder={studentIds.length ? undefined : "Search students by name"}
              searchable
              clearable
              hidePickedOptions
              nothingFoundMessage="No student matches. Create them instead."
              data={studentOptions}
              value={studentIds}
              onChange={setStudentIds}
            />
            <div className={styles.fieldAction}>
              <Button
                variant="secondary"
                icon="plus"
                type="button"
                onClick={() =>
                  onRequestCreateStudent ? onRequestCreateStudent() : setStudentDrawerOpen(true)
                }
              >
                Create student
              </Button>
            </div>
          </SimpleGrid>

          {reassigned.length > 0 && (
            <div className={styles.sectionNote}>
              <InlineMessage tone="warning">
                {reassigned.length} selected student{reassigned.length === 1 ? " is" : "s are"}{" "}
                currently assigned to another teacher and will be moved:{" "}
                {reassigned.map((student) => student.name || "(no name)").join(", ")}.
              </InlineMessage>
            </div>
          )}
        </FormSection>

        <FormSection title="Notes">
          <Textarea
            label={optional("Notes")}
            placeholder="Languages spoken, travel constraints, preferred contact time…"
            minRows={4}
            value={details.notes}
            onChange={(event) => set("notes", event.currentTarget.value)}
          />
        </FormSection>

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

        {!onRequestCreateSchool && (
          <SchoolFormDrawer
            opened={schoolDrawerOpen}
            onClose={() => setSchoolDrawerOpen(false)}
            onCreated={handleSchoolCreated}
          />
        )}

        {!onRequestCreateStudent && studentDrawerOpen && (
          <React.Suspense fallback={null}>
            <StudentFormDrawer
              opened
              onClose={() => setStudentDrawerOpen(false)}
              defaultSchoolId={details.schoolId}
              onCreated={handleStudentCreated}
            />
          </React.Suspense>
        )}
      </FormBody>
    );
  },
);

TeacherForm.displayName = "TeacherForm";

export default TeacherForm;
