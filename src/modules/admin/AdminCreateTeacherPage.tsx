// src/modules/admin/AdminCreateTeacherPage.tsx
//
// Add teacher, as a route of its own. The fields and the three writes behind
// the single action live in TeacherForm, shared with the drawer opened from a
// school's page.
//
// There is no success screen. Creating a teacher is routine work, and a page
// that stops to congratulate an admin about it is a page they have to click
// out of before they can do the next one. The outcome travels back to the
// directory instead: a toast naming the address the invitation went to, and
// the new row tinted so the eye finds it. Anything that needs more than a
// sentence — a half-saved profile, an unapplied migration — arrives as its own
// warning that stays on screen until it is dismissed.

import React, { useRef, useState } from "react";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";
import { FormPage } from "../../design-system";
import { TeacherForm, type CreatedTeacher } from "./TeacherForm";
import { TEACHER_FIELDS_PENDING_NOTE } from "./teacherProfile";
import type { EntityFormHandle } from "./entityForm";

/**
 * Everything that happened, told once, on the screen the admin lands on.
 *
 * Shared with the drawer so an admin who added a teacher from a school's page
 * is told exactly what an admin who used this route is told.
 */
export const reportTeacherCreated = (teacher: CreatedTeacher) => {
  notifications.show({
    title: "Invitation sent",
    message: `${teacher.fullName}'s invitation was sent to ${teacher.email}. They can choose a password from the email and sign in.`,
    color: "green",
  });

  if (teacher.studentCount > 0) {
    notifications.show({
      title: "Students assigned",
      message: `${teacher.studentCount} student${
        teacher.studentCount === 1 ? " is" : "s are"
      } now with this teacher.`,
      color: "blue",
    });
  }

  // A partial save is the one outcome an admin must not scroll past, so it does
  // not time out.
  if (!teacher.extended) {
    notifications.show({
      title: "Some details weren't saved",
      message: TEACHER_FIELDS_PENDING_NOTE,
      color: "yellow",
      autoClose: false,
    });
  }

  if (teacher.warning) {
    notifications.show({
      title: "Saved with a problem",
      message: teacher.warning,
      color: "yellow",
      autoClose: false,
    });
  }
};

export const AdminCreateTeacherPage: React.FC = () => {
  const navigate = useNavigate();
  const form = useRef<EntityFormHandle>(null);
  const [, setSaving] = useState(false);

  return (
    <FormPage
      title="Add teacher"
      subtitle="Create the teacher's account, assign their school and students, and send the invitation in one step."
    >
      <TeacherForm
        ref={form}
        showActions
        submitLabel="Create and send invite"
        onSavingChange={setSaving}
        onCancel={() => navigate("/admin/teachers")}
        onCreated={(teacher) => {
          reportTeacherCreated(teacher);
          navigate("/admin/teachers", { state: { createdTeacherId: teacher.id } });
        }}
      />
    </FormPage>
  );
};

export default AdminCreateTeacherPage;
