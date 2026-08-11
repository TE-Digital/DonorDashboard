// src/design-system/components/FormActions.tsx
import React from "react";
import { Button } from "../lumen";

export interface FormActionsProps {
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
  /** Extra controls (e.g. Delete) rendered on the left of the row. */
  secondary?: React.ReactNode;
}

/**
 * The submit / cancel row at the bottom of every create and edit form.
 *
 * Submit is the one filled action in this region — everything beside it is an
 * outline or a ghost, which is what keeps the blue meaningful.
 */
export const FormActions: React.FC<FormActionsProps> = ({
  submitLabel = "Save",
  loading,
  disabled,
  onCancel,
  cancelLabel = "Cancel",
  secondary,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 16,
      flexWrap: "wrap",
    }}
  >
    <div style={{ display: "flex", gap: 8 }}>{secondary}</div>
    <div style={{ display: "flex", gap: 8 }}>
      {onCancel && (
        <Button variant="ghost" type="button" onClick={onCancel}>
          {cancelLabel}
        </Button>
      )}
      <Button variant="primary" type="submit" disabled={disabled || loading}>
        {loading ? "Saving…" : submitLabel}
      </Button>
    </div>
  </div>
);

export default FormActions;
