// src/modules/admin/TeacherFormDrawer.tsx
//
// The add-teacher form, opened over whatever screen the admin was on. Identical
// fields to the /admin/teachers/new route — see TeacherForm. Opened from a
// school, the school is fixed rather than asked for.
//
// Adding a school or a student halfway through does not stack a second drawer
// on this one. The panel changes step instead, with a breadcrumb back to the
// teacher: one surface, and the half-typed teacher stays mounted behind the
// step, so nothing is lost and nothing has to be re-fetched. The new record
// comes back through the extraSchools / extraStudents props already selected.

import React, { useEffect, useRef, useState } from "react";
import { FormDrawer, InlineMessage } from "../../design-system";
import { Button } from "../../design-system/lumen";
import { SchoolForm, type CreatedSchool } from "./SchoolForm";
import { StudentForm, type CreatedStudent } from "./StudentForm";
import { TeacherForm, type CreatedTeacher } from "./TeacherForm";
import type { EntityFormHandle } from "./entityForm";

type Step = "teacher" | "school" | "student";

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

export interface TeacherFormDrawerProps {
  opened: boolean;
  onClose: () => void;
  onCreated: (teacher: CreatedTeacher) => void;
  defaultSchoolId?: string | null;
  lockSchool?: boolean;
  /** Named in the subtitle, so the fixed school is visible without a field. */
  contextLabel?: string;
}

export const TeacherFormDrawer: React.FC<TeacherFormDrawerProps> = ({
  opened,
  onClose,
  onCreated,
  defaultSchoolId = null,
  lockSchool = false,
  contextLabel,
}) => {
  const teacherForm = useRef<EntityFormHandle>(null);
  const schoolForm = useRef<EntityFormHandle>(null);
  const studentForm = useRef<EntityFormHandle>(null);

  const [step, setStep] = useState<Step>("teacher");
  const [saving, setSaving] = useState(false);
  /** The active step's error, repeated beside the button that triggered it. */
  const [formError, setFormError] = useState<string | null>(null);
  /** Tracked per form: closing must ask if either the teacher or the open step
   *  holds unsaved work. */
  const [teacherDirty, setTeacherDirty] = useState(false);
  const [stepDirty, setStepDirty] = useState(false);

  // What the side steps produced, handed to the teacher form to merge and select.
  const [createdSchools, setCreatedSchools] = useState<SchoolOption[]>([]);
  const [createdStudents, setCreatedStudents] = useState<StudentOption[]>([]);
  /** The school chosen on the teacher step, so a new student starts there. */
  const [schoolForStudent, setSchoolForStudent] = useState<string | null>(defaultSchoolId);

  // Callers close this drawer by flipping their own `opened` state, which never
  // runs `close()`. Without this, a school created during one teacher would
  // still be sitting in `createdSchools` on the next opening and would select
  // itself into a brand-new form.
  useEffect(() => {
    if (!opened) return;
    setStep("teacher");
    setFormError(null);
    setTeacherDirty(false);
    setStepDirty(false);
    setCreatedSchools([]);
    setCreatedStudents([]);
    setSchoolForStudent(defaultSchoolId);
  }, [opened, defaultSchoolId]);

  const close = () => {
    if (saving) return;
    setFormError(null);
    setStepDirty(false);
    setTeacherDirty(false);
    setStep("teacher");
    setCreatedSchools([]);
    setCreatedStudents([]);
    onClose();
  };

  const backToTeacher = () => {
    if (saving) return;
    setFormError(null);
    setStepDirty(false);
    setStep("teacher");
  };

  const handleSchoolCreated = (school: CreatedSchool) => {
    setFormError(null);
    setStepDirty(false);
    setCreatedSchools((current) => [...current, school]);
    setSchoolForStudent(school.id);
    setStep("teacher");
  };

  const handleStudentCreated = (student: CreatedStudent) => {
    setFormError(null);
    setStepDirty(false);
    setCreatedStudents((current) => [...current, { ...student, responsible_teacher_id: null }]);
    setStep("teacher");
  };

  const HEADINGS: Record<Step, { title: string; subtitle: string }> = {
    teacher: {
      title: "Add teacher",
      subtitle: contextLabel
        ? `The teacher represents ${contextLabel}, and is invited by email.`
        : "Create the teacher's account and send the invitation without leaving this screen.",
    },
    school: {
      title: "Add school",
      subtitle: "The school is selected for the teacher as soon as it is created.",
    },
    student: {
      title: "Add student",
      subtitle: "The student is assigned to this teacher as soon as they are created.",
    },
  };

  const breadcrumb =
    step === "teacher"
      ? undefined
      : [
          { label: "Add teacher", onClick: backToTeacher },
          { label: HEADINGS[step].title },
        ];

  const footer =
    step === "teacher" ? (
      <>
        <Button variant="ghost" onClick={close} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => teacherForm.current?.submit()} disabled={saving}>
          {saving ? "Creating…" : "Create and send invite"}
        </Button>
      </>
    ) : (
      <>
        <Button variant="ghost" onClick={backToTeacher} disabled={saving}>
          Back to teacher
        </Button>
        <Button
          variant="primary"
          onClick={() => (step === "school" ? schoolForm : studentForm).current?.submit()}
          disabled={saving}
        >
          {saving ? "Creating…" : step === "school" ? "Create school" : "Create student"}
        </Button>
      </>
    );

  return (
    <FormDrawer
      opened={opened}
      onClose={close}
      busy={saving}
      dirty={teacherDirty || stepDirty}
      title={HEADINGS[step].title}
      subtitle={HEADINGS[step].subtitle}
      breadcrumb={breadcrumb}
      size={880}
      status={
        formError ? (
          <InlineMessage tone="error" size="xs">
            {formError}
          </InlineMessage>
        ) : null
      }
      footer={footer}
    >
      {/* The teacher form stays mounted behind a side step — hiding it keeps
          every field the admin has already typed. */}
      {opened && (
        <div style={{ display: step === "teacher" ? undefined : "none" }}>
          <TeacherForm
            ref={teacherForm}
            onCreated={onCreated}
            onSavingChange={setSaving}
            onErrorChange={setFormError}
            onDirtyChange={setTeacherDirty}
            defaultSchoolId={defaultSchoolId}
            lockSchool={lockSchool}
            onSchoolChange={setSchoolForStudent}
            extraSchools={createdSchools}
            extraStudents={createdStudents}
            onRequestCreateSchool={() => setStep("school")}
            onRequestCreateStudent={() => setStep("student")}
          />
        </div>
      )}

      {step === "school" && (
        <SchoolForm
          ref={schoolForm}
          onCreated={handleSchoolCreated}
          onSavingChange={setSaving}
          onErrorChange={setFormError}
          onDirtyChange={setStepDirty}
        />
      )}

      {step === "student" && (
        <StudentForm
          ref={studentForm}
          onCreated={handleStudentCreated}
          onSavingChange={setSaving}
          onErrorChange={setFormError}
          onDirtyChange={setStepDirty}
          defaultSchoolId={schoolForStudent}
        />
      )}
    </FormDrawer>
  );
};

export default TeacherFormDrawer;
