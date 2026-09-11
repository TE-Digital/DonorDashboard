// src/modules/sponsorship/SponsorChips.tsx
//
// Who funds this student right now, in the space of one line.
//
// Names link to the donor's Students tab, where the relationship is managed.
// Two names are shown and the rest counted, so a student with five donors does
// not push the header onto three lines. On a phone it is only the count.

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Sponsorship } from "./sponsorships";
import styles from "./SponsorChips.module.scss";

export interface SponsorChipsProps {
  /** Active sponsorships only. */
  sponsorships: Sponsorship[];
  /** How many names before "and 3 more". */
  max?: number;
  /** Shown when nobody funds the student. Omit to render nothing. */
  emptyLabel?: string;
}

export const SponsorChips: React.FC<SponsorChipsProps> = ({ sponsorships, max = 2, emptyLabel }) => {
  const { t } = useTranslation();

  // One chip per donor even if a donor funds the student twice.
  const donors = Array.from(
    new Map(sponsorships.map((row) => [row.donorId, row.donorName ?? t("donorCard.aDonor")])).entries(),
  );

  if (!donors.length) {
    return emptyLabel ? <span className={styles.none}>{emptyLabel}</span> : null;
  }

  const shown = donors.slice(0, max);
  const rest = donors.length - shown.length;

  return (
    <span className={styles.chips}>
      <span className={styles.count}>{t("sponsorship.chips.count", { count: donors.length })}</span>
      <span className={styles.names}>
        {shown.map(([id, name]) => (
          <Link key={id} to={`/admin/donors/${id}?tab=students`} className={styles.chip}>
            {name}
          </Link>
        ))}
        {rest > 0 && <span className={styles.more}>{t("sponsorship.chips.more", { count: rest })}</span>}
      </span>
    </span>
  );
};

export default SponsorChips;
