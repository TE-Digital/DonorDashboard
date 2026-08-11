// src/design-system/components/SectionCard.tsx
import React from "react";
import { Card } from "../lumen";

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

/** Mantine spacing keys the `gap` prop still accepts, in px. */
const GAP: Record<string, number> = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 };

/**
 * A bordered panel with an optional title row, now built on the design
 * system's Card: one 8px radius, one 1px stroke, ringless shadow, and a header
 * rule when there is a title.
 *
 * The prop shape is unchanged, so the ~20 pages using it needed no edit.
 */
export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  actions,
  children,
  gap = "sm",
  padding,
  interactive = false,
}) => {
  const [hover, setHover] = React.useState(false);
  const pad = padding ? padding : 16;

  return (
    <div
      onMouseEnter={interactive ? () => setHover(true) : undefined}
      onMouseLeave={interactive ? () => setHover(false) : undefined}
      style={
        interactive
          ? {
              cursor: "pointer",
              borderRadius: "var(--radius)",
              boxShadow: hover ? "var(--shadow-raised)" : undefined,
              transition: "box-shadow var(--dur-base) var(--ease-standard)",
            }
          : undefined
      }
    >
      <Card
        title={title}
        action={actions}
        padding={pad}
        // A description belongs with the body, not the header rule.
      >
        <div style={{ display: "flex", flexDirection: "column", gap: GAP[gap] ?? 12 }}>
          {description && (
            <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>{description}</div>
          )}
          {children}
        </div>
      </Card>
    </div>
  );
};

export default SectionCard;
