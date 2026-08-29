// src/modules/donor/CoverageBar.tsx
//
// What a student needs against what they actually receive.
//
// This is the one component that makes `monthly_support_expected` mean
// something. The column has been on the student form since the beginning and
// nothing ever compared it to the scholarships attached to that student, so an
// admin choosing who to fund next was choosing from memory.
//
// Colour is never the message. Every state carries its number and its words —
// "1,200 THB short each month" — because a bar that is amber instead of green
// tells a colour-blind admin, a printed page, and a screen reader nothing at
// all. The tones are the platform's existing five, used the way the report
// badges already use them.

import React from "react";
import { formatCurrency } from "../../design-system";
import { COVERAGE_META, coverageState, type StudentCoverage } from "./donorMoney";
import styles from "./CoverageBar.module.scss";

export interface CoverageBarProps {
  coverage: StudentCoverage | undefined;
  /** Table-cell form: one line, no caption row, fixed height. */
  compact?: boolean;
  /** Hide the money line and show only the bar. Rare; for dense KPI tiles. */
  barOnly?: boolean;
}

/** "1,200 THB short each month" — the sentence, not the arithmetic. */
export const coverageSentence = (coverage: StudentCoverage | undefined): string => {
  const state = coverageState(coverage);
  if (!coverage || state === "unknown") return "Need not recorded";
  if (state === "funded") return "Fully funded";
  if (state === "over") {
    return `${formatCurrency(coverage.monthly_covered_thb - coverage.monthly_need_thb)} over`;
  }
  return `${formatCurrency(coverage.monthly_gap_thb)} short each month`;
};

export const CoverageBar: React.FC<CoverageBarProps> = ({ coverage, compact, barOnly }) => {
  const state = coverageState(coverage);
  const meta = COVERAGE_META[state];

  const need = coverage?.monthly_need_thb ?? 0;
  const covered = coverage?.monthly_covered_thb ?? 0;
  const percent = need > 0 ? Math.min(100, Math.round((covered / need) * 100)) : 0;

  const sentence = coverageSentence(coverage);

  // One label for assistive technology, so a screen reader hears the whole
  // comparison rather than a percentage with no referent.
  const ariaLabel =
    state === "unknown"
      ? "Monthly need not recorded for this student"
      : `${meta.label}. Receives ${formatCurrency(covered)} of ${formatCurrency(need)} a month. ${sentence}.`;

  return (
    <div
      className={`${styles.root} ${styles[state]} ${compact ? styles.compact : ""}`}
      role="img"
      aria-label={ariaLabel}
    >
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${state === "unknown" ? 0 : percent}%` }} />
      </div>

      {!barOnly && (
        <div className={styles.caption} aria-hidden="true">
          {!compact && (
            <span className={styles.amount}>
              {formatCurrency(covered)} of {formatCurrency(need)}
            </span>
          )}
          <span className={styles.gap}>{sentence}</span>
        </div>
      )}
    </div>
  );
};

export default CoverageBar;
