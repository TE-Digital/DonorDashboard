// src/design-system/components/SectionCard.tsx
import React from "react";
import { Card, Group, Stack, Text } from "@mantine/core";
import { textRole } from "../typography";

export interface SectionCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons rendered on the right of the section title row. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Spacing between the children of the card body. */
  gap?: string;
  padding?: string;
}

/**
 * A bordered panel with an optional title row. Replaces the four different
 * `<Card ...>` prop combinations that were in circulation.
 * Card defaults (border, radius, shadow) come from the theme.
 */
export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  actions,
  children,
  gap = "sm",
  padding,
}) => (
  <Card p={padding}>
    <Stack gap={gap}>
      {(title || actions) && (
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={2}>
            {title && <Text {...textRole("cardTitle")}>{title}</Text>}
            {description && (
              <Text {...textRole("caption")}>{description}</Text>
            )}
          </Stack>
          {actions && <Group gap="xs">{actions}</Group>}
        </Group>
      )}
      {children}
    </Stack>
  </Card>
);

export default SectionCard;
