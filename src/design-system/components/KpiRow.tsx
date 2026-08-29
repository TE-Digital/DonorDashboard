// src/design-system/components/KpiRow.tsx
//
// The one KPI band in the product. List screens, detail records and dashboards
// all render this, so a metric row looks identical wherever it appears: a
// tinted mark on the left, the value, and the label quietly under it.
//
// Colour here MEANS something. A KPI names its subject with `mark`, and the
// mark decides both the glyph and the tint — so "students" is the same blue
// figure on the dashboard, the register and a school record. Nothing cycles by
// position; two tiles sharing a colour are two tiles about the same thing.

import React from "react";
import { KpiCard, type KpiAccent } from "../lumen";
import styles from "./KpiRow.module.scss";

/** The subjects a KPI in this product can be about. */
export type KpiMark =
  | "students"
  | "teachers"
  | "schools"
  | "donors"
  | "scholarships"
  | "money"
  | "reports"
  | "overdue"
  | "ontrack"
  | "requests"
  | "accounts"
  | "admins"
  | "average"
  | "grade"
  | "dormitory"
  | "time";

const MARKS: Record<KpiMark, { icon: string; accent: KpiAccent }> = {
  students: { icon: "users", accent: "blue" },
  teachers: { icon: "contact", accent: "teal" },
  schools: { icon: "school", accent: "amber" },
  donors: { icon: "hand-coins", accent: "plum" },
  scholarships: { icon: "bookmark", accent: "plum" },
  money: { icon: "banknote", accent: "green" },
  reports: { icon: "clipboard-list", accent: "teal" },
  overdue: { icon: "triangle-alert", accent: "orange" },
  ontrack: { icon: "check-circle-2", accent: "green" },
  requests: { icon: "inbox", accent: "orange" },
  accounts: { icon: "circle-user", accent: "blue" },
  admins: { icon: "settings", accent: "plum" },
  average: { icon: "chart-no-axes-column", accent: "neutral" },
  grade: { icon: "graduation-cap", accent: "amber" },
  dormitory: { icon: "bed-double", accent: "plum" },
  time: { icon: "clock", accent: "neutral" },
};

export interface KpiItem {
  label: React.ReactNode;
  value: React.ReactNode;
  /** What the metric is about. Picks the glyph and the tint together. */
  mark?: KpiMark;
  footnote?: React.ReactNode;
  delta?: React.ReactNode;
  deltaLabel?: React.ReactNode;
  trend?: "up" | "down" | "flat";
  /** Escape hatches for a metric no mark covers. Prefer adding a mark. */
  icon?: string;
  accent?: KpiAccent;
  onClick?: () => void;
  /**
   * For a clickable KPI that is currently filtering the view beneath it. The
   * tile has to say it is switched on, or the table quietly shows a subset and
   * nothing on screen explains why.
   */
  active?: boolean;
}

export interface KpiRowProps {
  items: KpiItem[];
  /**
   * Cards per row. Defaults to the item count, capped at 5 — a band wider than
   * that stops reading as a row and starts reading as a grid.
   */
  columns?: number;
}

export const KpiRow: React.FC<KpiRowProps> = ({ items, columns }) => {
  if (!items || items.length === 0) return null;

  const cols = columns ?? Math.min(items.length, 5);

  return (
    <div className={styles.row} style={{ "--kpi-cols": cols } as React.CSSProperties}>
      {items.map((k, i) => {
        const mark = k.mark ? MARKS[k.mark] : undefined;
        const card = (
          <KpiCard
            strip
            label={k.label}
            value={k.value}
            footnote={k.footnote}
            delta={k.delta}
            deltaLabel={k.deltaLabel}
            trend={k.trend}
            icon={k.icon ?? mark?.icon}
            accent={k.accent ?? mark?.accent ?? "neutral"}
          />
        );

        return (
          <div key={i} className={styles.cell}>
            {k.onClick ? (
              <div
                role="button"
                tabIndex={0}
                aria-pressed={k.active ?? undefined}
                className={`${styles.clickable}${k.active ? ` ${styles.active}` : ""}`}
                onClick={k.onClick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    k.onClick!();
                  }
                }}
              >
                {card}
              </div>
            ) : (
              card
            )}
          </div>
        );
      })}
    </div>
  );
};

export default KpiRow;
