// src/modules/admin/StudentFormDrawer.tsx
//
// The add-student form, opened over whatever screen the admin was on.
// Identical fields to the /admin/students/new route — see StudentForm.

import React, { useRef, useState } from "react";
import { FormDrawer, InlineMessage } from "../../design-system";
import { Button } from "../../design-system/lumen";
import { StudentForm, type CreatedStudent } from "./StudentForm";
import type { EntityFormHandle } from "./entityForm";

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

export const StudentFormDrawer: React.FC<StudentFormDrawerProps> = ({
  opened,
  onClose,
  onCreated,
  defaultSchoolId = null,
  defaultTeacherId = null,
  lockSchool = false,
  contextLabel,
}) => {
  const form = useRef<EntityFormHandle>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  return (
    <FormDrawer
      opened={opened}
      onClose={onClose}
      busy={saving}
      dirty={dirty}
      title="Add student"
      subtitle={
        contextLabel
          ? `The student is added to ${contextLabel}.`
          : "Create the student record without leaving this screen."
      }
      size={860}
      status={
        formError ? (
          <InlineMessage tone="error" size="xs">
            {formError}
          </InlineMessage>
        ) : null
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => form.current?.submit()} disabled={saving}>
            {saving ? "Creating…" : "Create student"}
          </Button>
        </>
      }
    >
      {/* Remounted per opening, so a cancelled draft is not still there next time. */}
      {opened && (
        <StudentForm
          ref={form}
          onCreated={onCreated}
          onSavingChange={setSaving}
          onErrorChange={setFormError}
          onDirtyChange={setDirty}
          defaultSchoolId={defaultSchoolId}
          defaultTeacherId={defaultTeacherId}
          lockSchool={lockSchool}
        />
      )}
    </FormDrawer>
  );
};

export default StudentFormDrawer;
