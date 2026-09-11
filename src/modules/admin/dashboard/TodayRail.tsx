// src/modules/admin/dashboard/TodayRail.tsx
//
// The work waiting, down the right of the dashboard.
//
// This replaced a band of three tiles that each held a count. The difference is
// the whole point of the rail: a column holds ITEMS -- this report, from this
// teacher, about this child, waiting nine days -- where a row of tiles could
// only hold numbers, and a number is something you have to open another screen
// to act on.
//
// Two rules it keeps:
//
//   Nothing is acted on in place. Every item links to the screen that owns the
//   work. Approving a report sends it to a donor; that decision belongs on the
//   verification screen, not behind a one-click affordance on a dashboard.
//
//   An empty rail says so and gets out of the way. Nothing waiting is
//   information, and it should read as having finished rather than as a panel
//   that failed to load.

import React from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../../design-system/lumen";
import { todayWaitLabel, type TodayItem, type TodayKind } from "../dashboardMetrics";
import styles from "./Dashboard.module.scss";

export interface TodayRailProps {
  items: TodayItem[];
}

/** Colour and glyph carry the kind; the wait is always also written out. */
const KIND: Record<TodayKind, { icon: string; tone: string }> = {
  flagged: { icon: "message-circle", tone: "var(--status-danger)" },
  verify: { icon: "clipboard-list", tone: "var(--amber-600)" },
  decision: { icon: "triangle-alert", tone: "var(--status-warning)" },
  allocate: { icon: "hand-coins", tone: "var(--plum-500)" },
  welcome: { icon: "send", tone: "var(--action-primary)" },
  renewal: { icon: "refresh-cw", tone: "var(--n-500)" },
  request: { icon: "inbox", tone: "var(--n-500)" },
};

/** An item left too long says so in its detail line; the icon turns the danger tone as well. */
const URGENT_TONE = "var(--status-danger)";

export const TodayRail: React.FC<TodayRailProps> = ({ items }) => (
  <nav aria-label="Today" className={styles.rail}>
    <div className={styles.railHead}>
      <span className={styles.railTitle}>Today</span>
      {items.length > 0 && <span className={styles.railCount}>{items.length}</span>}
    </div>

    {items.length === 0 ? (
      <p className={styles.railEmpty}>
        Nothing is waiting. Every report has been read and no money is sitting idle.
      </p>
    ) : (
      <ul className={styles.railList}>
        {items.map((item) => {
          const kind = KIND[item.kind];
          return (
            <li key={item.id}>
              <Link to={item.href} className={styles.railItem}>
                <span
                  className={styles.railIcon}
                  style={{ color: item.urgent ? URGENT_TONE : kind.tone }}
                  aria-hidden="true"
                >
                  <Icon name={kind.icon} size={16} />
                </span>
                <span className={styles.railText}>
                  <span className={styles.railItemTitle}>{item.title}</span>
                  <span className={styles.railItemDetail}>{item.detail}</span>
                </span>
                {/* Written, never colour alone -- and never a bare number, which
                    would read as a count rather than an age. */}
                <span className={styles.railWait}>{todayWaitLabel(item.waitingDays)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    )}
  </nav>
);

export default TodayRail;
