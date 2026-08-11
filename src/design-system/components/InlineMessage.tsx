// src/design-system/components/InlineMessage.tsx
import React from "react";
import { Icon } from "../lumen";

export type MessageTone = "error" | "success" | "info" | "warning";

/** Colour and glyph per tone, matching the design system's Banner and Toast. */
const TONE: Record<MessageTone, { color: string; icon: string }> = {
  error: { color: "var(--red-600)", icon: "circle-alert" },
  success: { color: "var(--green-700)", icon: "check-circle-2" },
  info: { color: "var(--blue-700)", icon: "info" },
  warning: { color: "var(--amber-700)", icon: "triangle-alert" },
};

export interface InlineMessageProps {
  tone: MessageTone;
  children?: React.ReactNode;
  size?: "sm" | "xs";
}

/**
 * The one-line form feedback under an input or above a submit row.
 *
 * Renders nothing when there is no content, so callers keep dropping their
 * surrounding `{error && ...}` guards. For a message that needs a surface of
 * its own, use the design system's Banner instead.
 */
export const InlineMessage: React.FC<InlineMessageProps> = ({ tone, children, size = "sm" }) => {
  if (!children) return null;

  const { color, icon } = TONE[tone];

  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
        color,
        fontSize: size === "xs" ? "var(--fs-xs)" : "var(--fs-sm)",
        lineHeight: size === "xs" ? "var(--lh-xs)" : "var(--lh-sm)",
        textWrap: "pretty",
      }}
    >
      <Icon name={icon} size={14} style={{ marginTop: 2 }} />
      <span>{children}</span>
    </div>
  );
};

export default InlineMessage;
