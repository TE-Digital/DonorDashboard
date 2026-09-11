// src/modules/admin/AdminCreateStudentPage.tsx
//
// Add student, as a route of its own. The fields live in StudentForm, shared
// with the drawer opened from a school or a teacher, so the two entry points
// cannot drift apart.
//
// On a page there is room to open a drawer over the top, so "Add school" and
// "Add teacher" do exactly that; inside the add-student drawer the same two
// buttons become steps of that drawer instead. StudentForm opens the school
// drawer itself. The teacher drawer is opened here, because the teacher form
// can open the student drawer in turn and the loop has to stop somewhere.

import React, { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FormPage } from "../../design-system";
import { StudentForm } from "./StudentForm";
import { TeacherFormDrawer } from "./TeacherFormDrawer";
import type { EntityFormHandle } from "./entityForm";

export const AdminCreateStudentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const form = useRef<EntityFormHandle>(null);
  const [, setSaving] = useState(false);

  const [teacherDrawerOpen, setTeacherDrawerOpen] = useState(false);
  /** Teachers created from this page, merged into the picker already selected. */
  const [createdTeachers, setCreatedTeachers] = useState<
    Array<{ id: string; name: string; schoolId: string | null }>
  >([]);
  /** The school chosen on the form, so a new teacher starts at that school. */
  const [schoolId, setSchoolId] = useState<string | null>(searchParams.get("schoolId"));

  // Arriving from a teacher's page ("Add student") pre-fills the teacher.
  const teacherUserId = searchParams.get("teacherUserId");

  return (
    <FormPage title="Add student">
      <StudentForm
        ref={form}
        showActions
        submitLabel="Create student"
        defaultSchoolId={searchParams.get("schoolId")}
        defaultTeacherId={teacherUserId}
        extraTeachers={createdTeachers}
        onSchoolChange={setSchoolId}
        onRequestCreateTeacher={() => setTeacherDrawerOpen(true)}
        onSavingChange={setSaving}
        onCancel={() => navigate("/admin/students")}
        onCreated={(student) => navigate(`/admin/students/${student.id}`)}
      />

      <TeacherFormDrawer
        opened={teacherDrawerOpen}
        onClose={() => setTeacherDrawerOpen(false)}
        defaultSchoolId={schoolId}
        onCreated={(teacher) => {
          setCreatedTeachers((current) => [
            ...current,
            { id: teacher.id, name: teacher.fullName, schoolId: teacher.schoolId },
          ]);
          setTeacherDrawerOpen(false);
        }}
      />
    </FormPage>
  );
};

export default AdminCreateStudentPage;
