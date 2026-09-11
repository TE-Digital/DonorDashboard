// src/modules/sponsorship/SponsorshipStatusBadge.tsx
//
// Active, needs a decision, or ended. Always in words: a warning tone with no
// label would leave the one state that needs somebody's attention relying on
// their colour vision. A row waiting on a decision also says why.

import React from "react";
import { useTranslation } from "react-i18next";
import { Badge, Tooltip } from "../../design-system/lumen";
import {
  SPONSORSHIP_STATUS_TONE,
  decisionKey,
  statusKey,
  type DecisionReason,
  type SponsorshipStatus,
} from "./sponsorships";

export interface SponsorshipStatusBadgeProps {
  status: SponsorshipStatus;
  decisionReason?: DecisionReason | null;
}

export const SponsorshipStatusBadge: React.FC<SponsorshipStatusBadgeProps> = ({ status, decisionReason }) => {
  const { t } = useTranslation();
  const label = t(statusKey(status));

  if (status === "needs_decision" && decisionReason) {
    const reason = t(decisionKey(decisionReason));
    return (
      <Tooltip label={reason}>
        <span aria-label={`${label}: ${reason}`}>
          <Badge tone={SPONSORSHIP_STATUS_TONE[status]} dot>
            {label}
          </Badge>
        </span>
      </Tooltip>
    );
  }

  return (
    <Badge tone={SPONSORSHIP_STATUS_TONE[status]} dot>
      {label}
    </Badge>
  );
};

export default SponsorshipStatusBadge;
