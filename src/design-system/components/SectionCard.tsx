// src/design-system/components/SectionCard.tsx
import React from "react";
import { Card, Stack, Text } from "@mantine/core";
import { textRole } from "../typography";
import classes from "./SectionCard.module.scss";

export interface SectionCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons rendered on the right of the section title row. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Spacing between the children of the card body. */
  gap?: string;
  padding?: string;
  /**
   * Adds hover lift, focus ring and pointer cursor. Only for cards that are
   * themselves clickable — a card that only *contains* buttons is not.
   */
  interactive?: boolean;
}

/**
 * A bordered panel with an optional title row. Replaces the four different
 * `<Card ...>` prop combinations that were in circulation.
 *
 * Card defaults (border, radius, shadow) come from the theme; layout, hover
 * and responsive behaviour come from SectionCard.module.scss.
 */
export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  actions,
  children,
  gap = "sm",
  padding,
  interactive = false,
}) => (
  <Card
    p={padding}
    className={
      interactive ? `${classes.root} ${classes.interactive}` : classes.root
    }
  >
    <Stack gap={gap}>
      {(title || actions) && (
        <div className={classes.header}>
          <div className={classes.titleGroup}>
            {title && (
              <Text {...textRole("cardTitle")} className={classes.title}>
                {title}
              </Text>
            )}
            {description && (
              <Text {...textRole("caption")} className={classes.description}>
                {description}
              </Text>
            )}
          </div>
          {actions && <div className={classes.actions}>{actions}</div>}
        </div>
      )}
      {children}
    </Stack>
  </Card>
);

export default SectionCard;
