// src/modules/admin/AdminCreateStudentPage.tsx
//
// Add student, as a route of its own. The fields live in StudentForm, shared
// with the drawer opened from a school or a teacher, so the two entry points
// cannot drift apart. Editing an existing student stays on
// AdminStudentDetailPage, which also owns the profile photo — that upload is
// keyed by student id and so cannot happen before the first save.

import React, { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FormPage } from "../../design-system";
import { StudentForm } from "./StudentForm";
import type { EntityFormHandle } from "./entityForm";

export const AdminCreateStudentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const form = useRef<EntityFormHandle>(null);
  const [, setSaving] = useState(false);

  // Arriving from a teacher's page ("Add student") pre-fills the teacher.
  const teacherUserId = searchParams.get("teacherUserId");
  const schoolId = searchParams.get("schoolId");

  return (
    <FormPage
      title="Add student"
      subtitle="Create the student record, link them to a school and a teacher, and capture the contact details."
    >
      <StudentForm
        ref={form}
        showActions
        submitLabel="Create student"
        defaultSchoolId={schoolId}
        defaultTeacherId={teacherUserId}
        onSavingChange={setSaving}
        onCancel={() => navigate("/admin/students")}
        onCreated={(student) => navigate(`/admin/students/${student.id}`)}
      />
    </FormPage>
  );
};

export default AdminCreateStudentPage;
