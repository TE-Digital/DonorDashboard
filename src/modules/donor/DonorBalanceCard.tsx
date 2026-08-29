// src/modules/donor/DonorBalanceCard.tsx
//
// A donor's money in one card: given, committed, and what is free.
//
// The headline is the free balance because that is the only number anyone acts
// on — an admin opens a donor to answer "can I fund Nan with this?" — but it
// never appears alone. Given and committed sit beneath it as the two figures it
// is made from, and both link to the rows behind them. A balance that cannot be
// decomposed is a balance somebody will go and re-add in a spreadsheet.
//
// Over-allocation reads as "Over-allocated by ฿4,200" rather than being clamped
// to zero. Clamping would make a promise the organisation cannot keep look like
// an empty account, which is the one failure mode this screen exists to prevent.

import React from "react";
import { formatCurrency } from "../../design-system";
import { Button } from "../../design-system/lumen";
import { shortfallSentence, type DonorBalance } from "./donorMoney";
import styles from "./DonorBalanceCard.module.scss";

export interface DonorBalanceCardProps {
  balance: DonorBalance;
  /** Admin ledger actions. Omitted entirely on the donor's own view. */
  onRecordContribution?: () => void;
  onAllocate?: () => void;
  /**
   * The donor reading their own money. Warmer surface, softer wording, no
   * ledger verbs: a donor has not "committed capital", they are supporting
   * children.
   */
  donorView?: boolean;
  compact?: boolean;
  /** The funding migration is not applied; show zeroes honestly, not blankly. */
  unavailable?: boolean;
}

export const DonorBalanceCard: React.FC<DonorBalanceCardProps> = ({
  balance,
  onRecordContribution,
  onAllocate,
  donorView,
  compact,
  unavailable,
}) => {
  const free = balance.free_balance_thb;
  const negative = free < 0;

  const headline = negative ? formatCurrency(Math.abs(free)) : formatCurrency(free);

  // The shortfall outranks every other note. A donor may be "fully allocated"
  // and simultaneously unable to cover next month, and the second fact is the
  // one somebody has to act on.
  const shortfall = donorView ? null : shortfallSentence(balance);

  const note = (() => {
    if (unavailable) return "Contribution records are not set up on this database yet.";
    if (shortfall) return shortfall;
    if (negative) return `Over-allocated by ${formatCurrency(Math.abs(free))}`;
    if (free === 0 && balance.total_given_thb === 0) {
      return donorView ? "No contributions recorded yet." : "No money recorded for this donor yet.";
    }
    if (free === 0) return donorView ? "All of your giving is supporting a student." : "Fully allocated.";
    return donorView ? "Not yet assigned to a student" : "Free to allocate";
  })();

  return (
    <section
      className={[
        styles.root,
        negative || shortfall ? styles.negative : "",
        donorView ? styles.donorView : "",
        compact ? styles.compact : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={donorView ? "Your giving" : "Donor balance"}
    >
      <div>
        <div className={styles.label}>
          {negative ? "Over-allocated" : donorView ? "Unassigned" : "Free balance"}
        </div>
        {/* The figure changes as an allocation is typed next door, so it is
            announced rather than silently redrawn. */}
        <div className={styles.headline} aria-live="polite">
          {headline}
        </div>
        <div className={styles.note}>{note}</div>
      </div>

      <div className={styles.breakdown}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{donorView ? "You have given" : "Given"}</span>
          <span className={styles.statValue}>{formatCurrency(balance.total_given_thb)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{donorView ? "Supporting students" : "Committed"}</span>
          <span className={styles.statValue}>{formatCurrency(balance.total_committed_thb)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Each month</span>
          <span className={styles.statValue}>{formatCurrency(balance.monthly_committed_thb)}</span>
        </div>
      </div>

      {(onRecordContribution || onAllocate) && (
        <div className={styles.actions}>
          {onRecordContribution && (
            <Button variant="primary" icon="banknote" onClick={onRecordContribution}>
              Record contribution
            </Button>
          )}
          {onAllocate && (
            <Button variant="secondary" icon="hand-coins" onClick={onAllocate}>
              Allocate
            </Button>
          )}
        </div>
      )}
    </section>
  );
};

export default DonorBalanceCard;
