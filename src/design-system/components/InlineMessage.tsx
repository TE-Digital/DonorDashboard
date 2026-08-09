// src/design-system/components/InlineMessage.tsx
import React from "react";
import { Text } from "@mantine/core";
import { textRole } from "../typography";

export type MessageTone = "error" | "success" | "info" | "warning";

const toneColor: Record<MessageTone, string> = {
  error: "red",
  success: "green",
  info: "blue",
  warning: "orange",
};

export interface InlineMessageProps {
  tone: MessageTone;
  children?: React.ReactNode;
  size?: "sm" | "xs";
}

/**
 * The `<Text c="red">{error}</Text>` / `<Text c="green">{message}</Text>`
 * pairs that appear in roughly twenty pages, expressed once.
 * Renders nothing when there is no content, so callers can drop their
 * surrounding `{error && ...}` guards.
 */
export const InlineMessage: React.FC<InlineMessageProps> = ({
  tone,
  children,
  size = "sm",
}) => {
  if (!children) return null;

  return (
    <Text
      {...textRole(size === "xs" ? "caption" : "body")}
      c={toneColor[tone]}
    >
      {children}
    </Text>
  );
};

export default InlineMessage;
