// src/design-system/components/EmptyState.tsx
import React from "react";
import { Stack, Text } from "@mantine/core";
import { textRole } from "../typography";

export interface EmptyStateProps {
  /** Primary line, e.g. "No students found." */
  title: React.ReactNode;
  /** Optional second line explaining what to do next. */
  description?: React.ReactNode;
  /** Optional call to action, e.g. an "Add student" button. */
  action?: React.ReactNode;
  /** `inline` keeps the original left-aligned text; `block` centres it. */
  align?: "inline" | "block";
}

/**
 * Replaces the ~12 bare `<Text c="dimmed">No X found.</Text>` fragments so
 * every list renders its empty case the same way.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  align = "inline",
}) => (
  <Stack
    gap="xs"
    align={align === "block" ? "center" : "flex-start"}
    ta={align === "block" ? "center" : undefined}
    py={align === "block" ? "xl" : undefined}
  >
    <Text {...textRole("body")} c="dimmed">
      {title}
    </Text>
    {description && <Text {...textRole("caption")}>{description}</Text>}
    {action}
  </Stack>
);

export default EmptyState;
