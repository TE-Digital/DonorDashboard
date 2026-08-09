// src/design-system/components/LoadingState.tsx
import React from "react";
import { Center, Loader, LoadingOverlay } from "@mantine/core";
import type { MantineSize } from "@mantine/core";

export interface LoadingStateProps {
  /**
   * page    – centred in the content area, for a whole-page fetch
   * inline  – a plain loader in normal flow, for a section of a page
   * overlay – covers the nearest positioned ancestor, for saving/submitting
   */
  variant?: "page" | "inline" | "overlay";
  /** Only used by the `overlay` variant. */
  visible?: boolean;
  size?: MantineSize;
}

/**
 * Collapses the three unrelated loading idioms that were in use:
 * `return <Loader />`, `<Center mih="60vh"><Loader /></Center>` and
 * `<LoadingOverlay visible={...} />`.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  variant = "page",
  visible = true,
  size,
}) => {
  if (variant === "overlay") {
    return <LoadingOverlay visible={visible} zIndex={200} />;
  }

  if (variant === "inline") {
    return <Loader size={size} />;
  }

  return (
    <Center mih="60vh">
      <Loader size={size} />
    </Center>
  );
};

export default LoadingState;
