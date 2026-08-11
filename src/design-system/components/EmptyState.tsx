// src/design-system/components/EmptyState.tsx
import React from "react";
import { EmptyState as LumenEmptyState } from "../lumen";

export interface EmptyStateProps {
  /** Primary line, e.g. "No students found." */
  title: React.ReactNode;
  /** Optional second line explaining what to do next. */
  description?: React.ReactNode;
  /** Optional call to action, e.g. an "Add student" button. */
  action?: React.ReactNode;
  /** `inline` keeps the original left-aligned text; `block` centres it. */
  align?: "inline" | "block";
  /** Lucide icon name for the block form. */
  icon?: string;
}

/**
 * Every list renders its empty case the same way.
 *
 * `block` is the design system's EmptyState — icon chip, heading, one line of
 * guidance, action. `inline` stays a quiet left-aligned line, for an empty
 * region inside an otherwise populated page.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  align = "inline",
  icon = "inbox",
}) => {
  if (align === "block") {
    return (
      <LumenEmptyState icon={icon} title={title} description={description} action={action} />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
      <div style={{ fontSize: "var(--fs-body)", color: "var(--text-muted)" }}>{title}</div>
      {description && (
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-subtle)" }}>{description}</div>
      )}
      {action}
    </div>
  );
};

export default EmptyState;
