// src/design-system/components/FormActions.tsx
import React from "react";
import { Button, Group } from "@mantine/core";

export interface FormActionsProps {
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
  /** Extra controls (e.g. Delete) rendered on the left of the row. */
  secondary?: React.ReactNode;
}

/** The submit / cancel row repeated at the bottom of every create & edit form. */
export const FormActions: React.FC<FormActionsProps> = ({
  submitLabel = "Save",
  loading,
  disabled,
  onCancel,
  cancelLabel = "Cancel",
  secondary,
}) => (
  <Group justify="space-between" mt="md">
    <Group gap="xs">{secondary}</Group>
    <Group gap="xs">
      {onCancel && (
        <Button variant="subtle" type="button" onClick={onCancel}>
          {cancelLabel}
        </Button>
      )}
      <Button type="submit" loading={loading} disabled={disabled}>
        {submitLabel}
      </Button>
    </Group>
  </Group>
);

export default FormActions;
