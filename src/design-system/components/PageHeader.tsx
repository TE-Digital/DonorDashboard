// src/design-system/components/PageHeader.tsx
import React from "react";
import { Button, Group, Stack, Text } from "@mantine/core";
import { textRole } from "../typography";

export interface PageHeaderProps {
  title: React.ReactNode;
  /** Optional supporting line under the title. */
  subtitle?: React.ReactNode;
  /** Buttons / links rendered on the right of the header row. */
  actions?: React.ReactNode;
  /** Renders a standard "Back" button before the actions. */
  onBack?: () => void;
  backLabel?: string;
}

/**
 * The header row repeated at the top of ~26 pages:
 * title on the left, action buttons on the right.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  onBack,
  backLabel = "Back",
}) => {
  const hasRight = Boolean(actions || onBack);

  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap">
      <Stack gap={2}>
        <Text {...textRole("pageTitle")}>{title}</Text>
        {subtitle && <Text {...textRole("pageSubtitle")}>{subtitle}</Text>}
      </Stack>

      {hasRight && (
        <Group gap="xs" wrap="wrap" justify="flex-end">
          {actions}
          {onBack && (
            <Button size="xs" variant="subtle" onClick={onBack}>
              {backLabel}
            </Button>
          )}
        </Group>
      )}
    </Group>
  );
};

export default PageHeader;
