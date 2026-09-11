// src/modules/admin/SchoolFormDrawer.tsx
//
// The add-school form, opened over whatever screen the admin was on.
// Identical fields to the /admin/schools/new route — see SchoolForm.

import React, { useRef, useState } from "react";
import { FormDrawer, InlineMessage } from "../../design-system";
import { Button } from "../../design-system/lumen";
import { SchoolForm, type CreatedSchool } from "./SchoolForm";
import type { EntityFormHandle } from "./entityForm";

export interface SchoolFormDrawerProps {
  opened: boolean;
  onClose: () => void;
  onCreated: (school: CreatedSchool) => void;
}

export const SchoolFormDrawer: React.FC<SchoolFormDrawerProps> = ({
  opened,
  onClose,
  onCreated,
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
      title="Add school"
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
            {saving ? "Creating…" : "Create school"}
          </Button>
        </>
      }
    >
      {/* Remounted per opening, so a cancelled draft is not still there next time. */}
      {opened && <SchoolForm ref={form} onCreated={onCreated} onSavingChange={setSaving} onErrorChange={setFormError} onDirtyChange={setDirty} />}
    </FormDrawer>
  );
};

export default SchoolFormDrawer;
