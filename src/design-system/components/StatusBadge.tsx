// src/design-system/components/StatusBadge.tsx
import React from "react";
import type { MantineSize } from "@mantine/core";
import { Badge, type BadgeTone } from "../lumen";
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
 * semantic.ts states its colours as Mantine keys. This maps them onto the
 * design system's badge tones, where a tone is a claim about state: green means
 * done, amber means waiting, red means the user must act.
 */
const TONE: Record<string, BadgeTone> = {
  green: "success",
  yellow: "warning",
  orange: "warning",
  red: "danger",
  blue: "info",
  teal: "teal",
  grape: "plum",
  violet: "plum",
  pink: "pink",
  gray: "neutral",
};

/** Tones that carry a dot, because they report live state rather than a label. */
const DOTTED = new Set<BadgeTone>(["success", "warning", "danger"]);

/**
 * Renders a status using the shared colour map in semantic.ts. `size` is
 * accepted for source compatibility; the design system has one badge size.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ kind, value, label }) => {
  const meta = getStatusMeta(kind, value, label);
  const tone = TONE[meta.color] ?? "neutral";

  return (
    <Badge tone={tone} dot={DOTTED.has(tone)}>
      {meta.label}
    </Badge>
  );
};

export default StatusBadge;
