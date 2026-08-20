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
 * A single metric tile in the product's one KPI look: 3px accent rule on top,
 * uppercase label, tabular-figure value.
 *
 * Prop shape unchanged — `hint` maps to the KPI footnote. Prefer KpiRow when a
 * screen shows a band of metrics; it handles the grid and the accent cycle.
 */
export const StatCard: React.FC<StatCardProps> = ({ label, value, hint, onClick }) => {
  const card = <KpiCard strip label={label} value={value} footnote={hint} accent="blue" />;

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
