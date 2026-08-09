// src/design-system/components/StatusBadge.tsx
import React from "react";
import { Badge } from "@mantine/core";
import type { MantineSize } from "@mantine/core";
import { getStatusMeta } from "../semantic";
import type { StatusKind } from "../semantic";

export interface StatusBadgeProps {
  kind: StatusKind;
  value: string | boolean | null | undefined;
  /** Overrides the label from the semantic map, keeping the colour. */
  label?: string;
  size?: MantineSize;
}

/**
 * Renders a status using the shared colour map in semantic.ts, replacing the
 * eight copies of the same if/else colour ladder across the app.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  kind,
  value,
  label,
  size = "sm",
}) => {
  const meta = getStatusMeta(kind, value, label);

  return (
    <Badge size={size} color={meta.color} variant={meta.variant}>
      {meta.label}
    </Badge>
  );
};

export default StatusBadge;
