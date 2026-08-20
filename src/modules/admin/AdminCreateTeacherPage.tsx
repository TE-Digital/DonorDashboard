// src/modules/admin/AdminCreateTeacherPage.tsx
//
// Add teacher, as a route of its own. The fields and the three writes behind
// the single action live in TeacherForm, shared with the drawer opened from a
// school's page; this screen adds the outcome report and the onward links.

import React, { useRef, useState } from "react";
import { Stack, Text } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { FormFooter, FormPage, InlineMessage } from "../../design-system";
import { Button } from "../../design-system/lumen";
import { TeacherForm, type CreatedTeacher } from "./TeacherForm";
import { TEACHER_FIELDS_PENDING_NOTE } from "./teacherProfile";
import type { EntityFormHandle } from "./entityForm";

export const AdminCreateTeacherPage: React.FC = () => {
  const navigate = useNavigate();
  const form = useRef<EntityFormHandle>(null);
  const [, setSaving] = useState(false);
  const [createdTeacher, setCreatedTeacher] = useState<CreatedTeacher | null>(null);

  if (createdTeacher) {
    return (
      <FormPage
        title="Teacher invited"
        subtitle="The account is ready for the teacher to confirm by email."
      >
        <Stack gap="lg">
          <InlineMessage tone="success">
            An invitation email was requested for {createdTeacher.email}. The teacher can set a
            password from that message and then sign in.
          </InlineMessage>

          {createdTeacher.studentCount > 0 && (
            <InlineMessage tone="info">
              {createdTeacher.studentCount} student
              {createdTeacher.studentCount === 1 ? " is" : "s are"} now assigned to this teacher.
            </InlineMessage>
          )}

          {!createdTeacher.extended && (
            <InlineMessage tone="warning">{TEACHER_FIELDS_PENDING_NOTE}</InlineMessage>
          )}

          {createdTeacher.warning && (
            <InlineMessage tone="warning">{createdTeacher.warning}</InlineMessage>
          )}

          <Text size="sm" c="dimmed">
            Confirmation delivery and acceptance timestamps need to be persisted by the backend
            before they can appear in the teacher overview.
          </Text>

          <FormFooter
            left={
              <Button variant="ghost" onClick={() => navigate("/admin/teachers")}>
                Back to teachers
              </Button>
            }
          >
            <Button
              variant="primary"
              onClick={() => navigate(`/admin/teachers/${createdTeacher.id}`)}
            >
              Open teacher overview
            </Button>
          </FormFooter>
        </Stack>
      </FormPage>
    );
  }

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
        onCreated={setCreatedTeacher}
      />
    </FormPage>
  );
};

export default AdminCreateTeacherPage;
