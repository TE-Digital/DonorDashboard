// src/modules/admin/dashboard/FundingSummaryBand.tsx
//
// The money band. The first thing on the page, and the reason the admin opened
// it: what has been committed this year, against what is still uncovered.
//
// Two decisions are visible in the markup and both are deliberate.
//
// The headline says "Committed", not "Spent". scholarship_payments exists and
// nothing writes it, so disbursement is unknown; a figure labelled Spent that
// is actually a pledge is exactly the kind of thing that sends an admin back to
// their own spreadsheet.
//
// The gap carries its own caveat as a link. Students whose need nobody has
// recorded are not in the gap, and saying so under the number -- rather than in
// a tooltip, or nowhere -- is the difference between a figure you can act on
// and one that quietly flatters the programme.

import React from "react";
import { SectionCard } from "../../../design-system";
import { formatCurrency, formatNumber } from "../../../design-system";
import type { FundingSummary } from "../dashboardMetrics";
import styles from "./Dashboard.module.scss";

export interface FundingSummaryBandProps {
  funding: FundingSummary;
  year: number;
  onOpenUncovered: () => void;
  onOpenNeedUnknown: () => void;
  onOpenDonors: () => void;
  actions?: React.ReactNode;
}

const Decomposed: React.FC<{
  label: string;
  value: string;
  note?: string;
  onClick?: () => void;
}> = ({ label, value, note, onClick }) => {
  const body = (
    <>
      <span className={styles.decompositionLabel}>{label}</span>
      <span className={styles.decompositionValue}>{value}</span>
      {note && <span className={styles.decompositionLabel}>{note}</span>}
    </>
  );

  if (!onClick) return <div className={styles.decompositionItem}>{body}</div>;

  return (
    <button type="button" className={styles.caveat} onClick={onClick} style={{ textDecoration: "none" }}>
      <span className={styles.decompositionItem}>{body}</span>
    </button>
  );
};

export const FundingSummaryBand: React.FC<FundingSummaryBandProps> = ({
  funding,
  year,
  onOpenUncovered,
  onOpenNeedUnknown,
  onOpenDonors,
  actions,
}) => (
  <SectionCard title="Funding" actions={actions} gap="md">
    <div className={styles.moneyBand}>
      <div className={styles.headline}>
        <span className={styles.headlineLabel}>Committed in {year}</span>
        <span className={styles.headlineValue}>
          {formatCurrency(funding.committedThisYearThb)}
        </span>
        <span className={styles.headlineNote}>
          Pledged by active scholarships across the year. Not what has been paid out.
        </span>

        <span className={styles.headlineLabel} style={{ marginTop: "var(--sp-4)" }}>
          Still uncovered, annually
        </span>
        <span className={`${styles.headlineValue} ${styles.headlineValueGap}`}>
          {formatCurrency(funding.annualGapThb)}
        </span>
        <span className={styles.headlineNote}>
          {formatCurrency(funding.monthlyGapThb)} a month, across{" "}
          {formatNumber(funding.uncoveredStudents)} students.
        </span>

        {funding.needUnknown > 0 && (
          <button type="button" className={styles.caveat} onClick={onOpenNeedUnknown}>
            {formatNumber(funding.needUnknown)} students have no recorded need and are not
            in this figure.
          </button>
        )}
      </div>

      <div className={styles.decomposition}>
        <Decomposed
          label={`Received in ${year}`}
          value={formatCurrency(funding.receivedThisYearThb)}
          note="Payments recorded"
        />
        <Decomposed
          label="Unallocated"
          value={formatCurrency(funding.freeBalanceThb)}
          note={
            funding.donorsWithIdleFunds > 0
              ? `held by ${formatNumber(funding.donorsWithIdleFunds)} donors`
              : "nothing waiting"
          }
          onClick={funding.donorsWithIdleFunds > 0 ? onOpenDonors : undefined}
        />
        <Decomposed
          label="Students short"
          value={formatNumber(funding.uncoveredStudents)}
          note="receiving less than their need"
          onClick={funding.uncoveredStudents > 0 ? onOpenUncovered : undefined}
        />
        <Decomposed
          label="Need not recorded"
          value={formatNumber(funding.needUnknown)}
          note="nobody has said"
          onClick={funding.needUnknown > 0 ? onOpenNeedUnknown : undefined}
        />
      </div>
    </div>
  </SectionCard>
);

export default FundingSummaryBand;
