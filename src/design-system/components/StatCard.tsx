// src/design-system/components/StatCard.tsx
import React from "react";
import { KpiCard } from "../lumen";

export interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Optional supporting line under the value. */
  hint?: React.ReactNode;
  onClick?: () => void;
}

/**
 * The dashboard metric tile, now the design system's KpiCard: accent dot,
 * tabular-figure value at 24/30, footnote line.
 *
 * Prop shape unchanged — `hint` maps to the KPI footnote. Reach for KpiCard
 * directly when a metric has a trend delta to show.
 */
export const StatCard: React.FC<StatCardProps> = ({ label, value, hint, onClick }) => {
  const card = <KpiCard label={label} value={value} footnote={hint} accent="blue" />;

  if (!onClick) return card;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{ cursor: "pointer", borderRadius: "var(--radius)" }}
    >
      {card}
    </div>
  );
};

export default StatCard;
