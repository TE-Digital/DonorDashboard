// src/modules/admin/StudentFormDrawer.tsx
//
// The add-student form, opened over whatever screen the admin was on.
// Identical fields to the /admin/students/new route — see StudentForm.
//
// A student needs a school, and often a teacher, and neither of them always
// exists yet. Adding one does not stack a second drawer on this one: the panel
// changes step, with a breadcrumb back to the student. The student form stays
// mounted behind the step, so nothing typed is lost and no list has to be
// re-fetched — the new school or teacher comes back through extraSchools /
// extraTeachers, already selected.

import React, { useRef, useState } from "react";
import { FormDrawer, InlineMessage } from "../../design-system";
import { Button } from "../../design-system/lumen";
import { SchoolForm, type CreatedSchool } from "./SchoolForm";
import { StudentForm, type CreatedStudent } from "./StudentForm";
import { TeacherForm, type CreatedTeacher } from "./TeacherForm";
import type { EntityFormHandle } from "./entityForm";

type Step = "student" | "school" | "teacher";

export interface StudentFormDrawerProps {
  opened: boolean;
  onClose: () => void;
  onCreated: (student: CreatedStudent) => void;
  defaultSchoolId?: string | null;
  defaultTeacherId?: string | null;
  /** Hides the school picker where the context already fixes the school. */
  lockSchool?: boolean;
  /** Named in the subtitle, so the fixed school is visible without a field. */
  contextLabel?: string;
}

const HEADINGS: Record<Step, { title: string; subtitle: string }> = {
  student: {
    title: "Add student",
    subtitle: "Create the student record without leaving this screen.",
  },
  school: {
    title: "Add school",
    subtitle: "The school is selected for the student as soon as it is created.",
  },
  teacher: {
    title: "Add teacher",
    subtitle: "The teacher is made responsible for this student as soon as they are created.",
  },
};

export const StudentFormDrawer: React.FC<StudentFormDrawerProps> = ({
  opened,
  onClose,
  onCreated,
  defaultSchoolId = null,
  defaultTeacherId = null,
  lockSchool = false,
  contextLabel,
}) => {
  const studentForm = useRef<EntityFormHandle>(null);
  const schoolForm = useRef<EntityFormHandle>(null);
  const teacherForm = useRef<EntityFormHandle>(null);

  const [step, setStep] = useState<Step>("student");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // What the side steps produced, handed to the student form to merge and select.
  const [createdSchools, setCreatedSchools] = useState<Array<{ id: string; name: string }>>([]);
  const [createdTeachers, setCreatedTeachers] = useState<
    Array<{ id: string; name: string; schoolId: string | null }>
  >([]);
  /** The school chosen on the student step, so a new teacher starts there. */
  const [schoolForTeacher, setSchoolForTeacher] = useState<string | null>(defaultSchoolId);

  const close = () => {
    if (saving) return;
    setStep("student");
    setCreatedSchools([]);
    setCreatedTeachers([]);
    setFormError(null);
    onClose();
  };

  const backToStudent = () => {
    if (saving) return;
    setStep("student");
  };

  const handleSchoolCreated = (school: CreatedSchool) => {
    setCreatedSchools((current) => [...current, school]);
    setSchoolForTeacher(school.id);
    setStep("student");
  };

  const handleTeacherCreated = (teacher: CreatedTeacher) => {
    setCreatedTeachers((current) => [
      ...current,
      { id: teacher.id, name: teacher.fullName, schoolId: teacher.schoolId },
    ]);
    setStep("student");
  };

  const subtitle =
    step === "student" && contextLabel
      ? `The student is added to ${contextLabel}.`
      : HEADINGS[step].subtitle;

  const breadcrumb =
    step === "student"
      ? undefined
      : [{ label: "Add student", onClick: backToStudent }, { label: HEADINGS[step].title }];

  const footer =
    step === "student" ? (
      <>
        <Button variant="ghost" onClick={close} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => studentForm.current?.submit()} disabled={saving}>
          {saving ? "Creating…" : "Create student"}
        </Button>
      </>
    ) : (
      <>
        <Button variant="ghost" onClick={backToStudent} disabled={saving}>
          Back to student
        </Button>
        <Button
          variant="primary"
          onClick={() => (step === "school" ? schoolForm : teacherForm).current?.submit()}
          disabled={saving}
        >
          {saving ? "Creating…" : step === "school" ? "Create school" : "Create and send invite"}
        </Button>
      </>
    );

  return (
    <FormDrawer
      opened={opened}
      onClose={close}
      busy={saving}
      dirty={dirty}
      title={HEADINGS[step].title}
      subtitle={subtitle}
      breadcrumb={breadcrumb}
      size={880}
      status={
        formError && step === "student" ? (
          <InlineMessage tone="error" size="xs">
            {formError}
          </InlineMessage>
        ) : null
      }
      footer={footer}
    >
      {/* The student form stays mounted behind a side step — hiding it keeps
          every field the admin has already typed. */}
      {opened && (
        <div style={{ display: step === "student" ? undefined : "none" }}>
          <StudentForm
            ref={studentForm}
            onCreated={onCreated}
            onSavingChange={setSaving}
            onErrorChange={setFormError}
            onDirtyChange={setDirty}
            defaultSchoolId={defaultSchoolId}
            defaultTeacherId={defaultTeacherId}
            lockSchool={lockSchool}
            onSchoolChange={setSchoolForTeacher}
            extraSchools={createdSchools}
            extraTeachers={createdTeachers}
            onRequestCreateSchool={() => setStep("school")}
            onRequestCreateTeacher={() => setStep("teacher")}
          />
        </div>
      )}

      {step === "school" && (
        <SchoolForm ref={schoolForm} onCreated={handleSchoolCreated} onSavingChange={setSaving} />
      )}

      {step === "teacher" && (
        <TeacherForm
          ref={teacherForm}
          onCreated={handleTeacherCreated}
          onSavingChange={setSaving}
          defaultSchoolId={schoolForTeacher}
        />
      )}
    </FormDrawer>
  );
};

export default StudentFormDrawer;
