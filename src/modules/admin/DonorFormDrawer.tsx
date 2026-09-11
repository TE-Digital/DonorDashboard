// src/modules/admin/DonorFormDrawer.tsx
//
// Adding or editing a donor without leaving the screen, the way students and
// teachers already work. The fields and the save are DonorForm's; this owns the
// panel, the action bar, and the question "are you sure?" when closing with
// work typed.

import React, { useEffect, useRef, useState } from "react";
import { FormDrawer, InlineMessage } from "../../design-system";
import { Button } from "../../design-system/lumen";
import { DonorForm, type CreatedDonor } from "./DonorForm";
import type { DonorDetailsInput } from "./donorRecord";
import type { EntityFormHandle } from "./entityForm";

export interface DonorFormDrawerProps {
  opened: boolean;
  onClose: () => void;
  /** Adding: called with the new donor. */
  onCreated?: (donor: CreatedDonor) => void;
  /** Editing: the donor, their current name for the title, and their stored values. */
  donorId?: string | null;
  donorName?: string | null;
  initial?: DonorDetailsInput;
  onUpdated?: (donor: CreatedDonor) => void;
}

export const DonorFormDrawer: React.FC<DonorFormDrawerProps> = ({
  opened,
  onClose,
  onCreated,
  donorId = null,
  donorName = null,
  initial,
  onUpdated,
}) => {
  const isEdit = Boolean(donorId);
  const form = useRef<EntityFormHandle>(null);
  const [saving, setSaving] = useState(false);
  /** Repeated beside the button: in a drawer the fields scroll and the button does not. */
  const [formError, setFormError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Callers close this by flipping their own `opened`, which never runs close(),
  // so each opening starts clean here instead.
  useEffect(() => {
    if (!opened) return;
    setFormError(null);
    setDirty(false);
  }, [opened]);

  const close = () => {
    if (saving) return;
    setFormError(null);
    setDirty(false);
    onClose();
  };

  const label = isEdit
    ? saving
      ? "Saving…"
      : "Save changes"
    : saving
      ? "Creating…"
      : "Create donor";

  return (
    <FormDrawer
      opened={opened}
      onClose={close}
      busy={saving}
      dirty={dirty}
      title={isEdit ? `Edit donor · ${donorName?.trim() || "Anonymous donor"}` : "Add donor"}
      size={880}
      status={
        formError ? (
          <InlineMessage tone="error" size="xs">
            {formError}
          </InlineMessage>
        ) : null
      }
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => form.current?.submit()} disabled={saving}>
            {label}
          </Button>
        </>
      }
    >
      {/* Mounted only while open, so every opening starts from the stored values. */}
      {opened && (
        <DonorForm
          ref={form}
          donorId={donorId}
          initial={initial}
          onCreated={onCreated}
          onUpdated={onUpdated}
          onSavingChange={setSaving}
          onErrorChange={setFormError}
          onDirtyChange={setDirty}
        />
      )}
    </FormDrawer>
  );
};

export default DonorFormDrawer;
