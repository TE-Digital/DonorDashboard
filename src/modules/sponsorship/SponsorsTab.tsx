// src/modules/sponsorship/SponsorsTab.tsx
//
// Every donor who funds, or funded, this student, and the few things an admin
// changes about that support.
//
// The admin comes here to answer "who is behind this student, since when, and
// do they get the reports?". Anything waiting on a decision sits at the top,
// active support beneath it, ended support kept underneath as history. A
// donor's name opens their Students tab.
//
// The two switches act in place: they change one column on one row, and making
// somebody open a drawer to turn off an email is ceremony. Changing the money
// or ending the support opens something that says what will happen first.
//
// On a desktop this is a table. Below 1024px the table would only scroll
// sideways, so each donor becomes a card: who, how much, what state, with the
// emails, renewal and welcome folded into a "More" expander.
//
// The page says "donor" throughout (docs/VOICE.md). "Sponsorship" is only the
// name of the relationship in code.

import React, { useState } from "react";
import { Switch } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { InlineMessage, formatCurrency, formatDate } from "../../design-system";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Icon,
  IconButton,
  Tooltip,
  type DataColumn,
} from "../../design-system/lumen";
import { EndSponsorshipDialog } from "./EndSponsorshipDialog";
import { SponsorshipEditDrawer } from "./SponsorshipEditDrawer";
import { SponsorshipStatusBadge } from "./SponsorshipStatusBadge";
import { setSponsorshipSwitch } from "./sponsorshipActions";
import { supportTypeKey, type Sponsorship } from "./sponsorships";
import styles from "./SponsorsTab.module.scss";

export interface SponsorsTabProps {
  /** The student's first name or nickname. */
  studentName: string;
  sponsorships: Sponsorship[];
  /** False before the relationship columns exist; those columns are hidden. */
  extended: boolean;
  /** What the student is still short each month, for the edit drawer. */
  monthlyGap: number;
  /** Opens the assign drawer. Omitted for an archived student. */
  onAssign?: () => void;
  /** Re-reads the student after anything here changes. */
  onChanged: () => void;
  /** Opens the welcome email for a new donor. */
  onWelcome: (row: Sponsorship) => void;
  /** Opens the decision panel for support waiting on an admin. */
  onDecide: (row: Sponsorship) => void;
}

export const SponsorsTab: React.FC<SponsorsTabProps> = ({
  studentName,
  sponsorships,
  extended,
  monthlyGap,
  onAssign,
  onChanged,
  onWelcome,
  onDecide,
}) => {
  const { t } = useTranslation();
  const narrow = useMediaQuery("(max-width: 1023px)");
  const [editing, setEditing] = useState<Sponsorship | null>(null);
  const [ending, setEnding] = useState<Sponsorship | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  const assign = onAssign ? (
    <Button variant="primary" icon="hand-coins" onClick={onAssign}>
      {t("sponsorship.tab.assign")}
    </Button>
  ) : null;

  const flip = async (row: Sponsorship, field: "report_emails_enabled" | "auto_renew", value: boolean) => {
    setSwitching(`${row.id}:${field}`);
    const result = await setSponsorshipSwitch(row, field, value);
    setSwitching(null);
    if (!result.ok) {
      notifications.show({
        title: t("sponsorship.actions.toggleFailedTitle"),
        message: t(`sponsorship.errors.${result.reason ?? "failed"}`),
        color: "red",
        icon: <Icon name="circle-alert" size={16} />,
        withBorder: true,
      });
      return;
    }
    onChanged();
  };

  const dialogs = (
    <>
      <SponsorshipEditDrawer
        row={editing}
        studentName={studentName}
        monthlyGap={monthlyGap}
        onClose={() => setEditing(null)}
        onSaved={onChanged}
      />
      <EndSponsorshipDialog row={ending} studentName={studentName} onClose={() => setEnding(null)} onEnded={onChanged} />
    </>
  );

  if (!sponsorships.length) {
    return (
      <div className={styles.tab}>
        <EmptyState
          icon="hand-coins"
          title={t("sponsorship.tab.emptyTitle", { name: studentName })}
          description={t("sponsorship.tab.emptyBody")}
          action={assign ?? undefined}
        />
      </div>
    );
  }

  const donorOf = (row: Sponsorship) => row.donorName ?? t("donorCard.aDonor");
  const live = (row: Sponsorship) => row.status !== "ended";

  const donorLink = (row: Sponsorship) => (
    <Link className={styles.donor} to={`/admin/donors/${row.donorId}?tab=students`}>
      {donorOf(row)}
    </Link>
  );

  const supportText = (row: Sponsorship) =>
    row.supportType === "specific_item" && row.itemDescription
      ? `${t(supportTypeKey(row.supportType))}: ${row.itemDescription}`
      : t(supportTypeKey(row.supportType));

  const amountText = (row: Sponsorship) =>
    row.supportType === "specific_item" ? formatCurrency(row.totalAmountThb) : formatCurrency(row.monthlyAmountThb);

  const datesText = (row: Sponsorship) =>
    row.coverageEnd
      ? t("sponsorship.tab.datesRange", { start: formatDate(row.coverageStart), end: formatDate(row.coverageEnd) })
      : t("sponsorship.tab.datesOpen", { start: formatDate(row.coverageStart) });

  // A welcome still to send is something to do, so it looks like one.
  const welcome = (row: Sponsorship) => {
    if (row.welcomeSentAt) return t("sponsorship.tab.welcomeSent", { date: formatDate(row.welcomeSentAt) });
    if (row.welcomeSkippedAt) return t("sponsorship.tab.welcomeSkipped");
    return live(row) ? (
      <Badge tone="warning" dot>
        {t("sponsorship.tab.welcomeWaiting")}
      </Badge>
    ) : (
      t("sponsorship.tab.welcomeWaiting")
    );
  };

  const emailsCell = (row: Sponsorship) => {
    if (!live(row)) return row.reportEmailsEnabled ? t("sponsorship.tab.on") : t("sponsorship.tab.off");
    if (!row.donorWantsEmails) {
      const reason = t("sponsorship.actions.donorEmailsOff", { donor: donorOf(row) });
      return (
        <Tooltip label={reason}>
          <span className={styles.lockedSwitch}>
            <Switch size="sm" checked={false} disabled aria-label={reason} />
            <span className={styles.lockedText}>{t("sponsorship.actions.donorOff")}</span>
          </span>
        </Tooltip>
      );
    }
    return (
      <Switch
        size="sm"
        checked={row.reportEmailsEnabled}
        disabled={switching === `${row.id}:report_emails_enabled`}
        aria-label={t("sponsorship.actions.emailsLabel", { donor: donorOf(row) })}
        onChange={(event) => void flip(row, "report_emails_enabled", event.currentTarget.checked)}
      />
    );
  };

  const renewCell = (row: Sponsorship) => {
    if (!live(row) || row.supportType === "specific_item") {
      return row.supportType === "specific_item"
        ? t("sponsorship.tab.oneOff")
        : row.autoRenew
          ? t("sponsorship.tab.on")
          : t("sponsorship.tab.off");
    }
    return (
      <Switch
        size="sm"
        checked={row.autoRenew}
        disabled={switching === `${row.id}:auto_renew`}
        aria-label={t("sponsorship.actions.renewLabel", { donor: donorOf(row) })}
        onChange={(event) => void flip(row, "auto_renew", event.currentTarget.checked)}
      />
    );
  };

  const actionsCell = (row: Sponsorship) =>
    live(row) ? (
      <span className={styles.rowActions}>
        {row.status === "needs_decision" && (
          <Button variant="secondary" size="sm" onClick={() => onDecide(row)}>
            {t("sponsorship.decide.open")}
          </Button>
        )}
        {row.status === "active" && !row.welcomeSentAt && !row.welcomeSkippedAt && (
          <IconButton
            icon="send"
            label={t("sponsorship.actions.welcome", { donor: donorOf(row) })}
            onClick={() => onWelcome(row)}
          />
        )}
        <IconButton icon="pencil" label={t("sponsorship.actions.edit", { donor: donorOf(row) })} onClick={() => setEditing(row)} />
        <IconButton icon="x" label={t("sponsorship.actions.end", { donor: donorOf(row) })} onClick={() => setEnding(row)} />
      </span>
    ) : null;

  const columns: DataColumn<Sponsorship>[] = [
    { key: "donorName", label: t("sponsorship.tab.columns.donor"), width: 200, render: donorLink },
    ...(extended
      ? [{ key: "supportType", label: t("sponsorship.tab.columns.support"), width: 170, render: supportText } as DataColumn<Sponsorship>]
      : []),
    {
      key: "monthlyAmountThb",
      label: t("sponsorship.tab.columns.monthly"),
      align: "right",
      numeric: true,
      width: 120,
      render: amountText,
    },
    { key: "coverageStart", label: t("sponsorship.tab.columns.dates"), width: 220, muted: true, render: datesText },
    {
      key: "status",
      label: t("sponsorship.tab.columns.status"),
      width: 170,
      render: (row) => <SponsorshipStatusBadge status={row.status} decisionReason={row.decisionReason} />,
    },
    ...(extended
      ? ([
          { key: "reportEmailsEnabled", label: t("sponsorship.tab.columns.emails"), width: 140, render: emailsCell },
          { key: "autoRenew", label: t("sponsorship.tab.columns.renews"), width: 110, render: renewCell },
          { key: "welcomeSentAt", label: t("sponsorship.tab.columns.welcome"), width: 150, muted: true, render: welcome },
          { key: "actions", label: "", width: 200, align: "right", render: actionsCell },
        ] as DataColumn<Sponsorship>[])
      : []),
  ];

  const cards = (
    <ul className={styles.cards}>
      {sponsorships.map((row) => (
        <li key={row.id} className={styles.card}>
          <div className={styles.cardTop}>
            {donorLink(row)}
            <SponsorshipStatusBadge status={row.status} decisionReason={row.decisionReason} />
          </div>
          <p className={styles.cardMeta}>
            <span className={styles.cardAmount}>{amountText(row)}</span>
            <span>{datesText(row)}</span>
            {extended && <span>{supportText(row)}</span>}
          </p>
          {extended && (
            <details className={styles.more}>
              <summary>{t("sponsorship.tab.more")}</summary>
              <dl className={styles.moreList}>
                <dt>{t("sponsorship.tab.columns.emails")}</dt>
                <dd>{emailsCell(row)}</dd>
                <dt>{t("sponsorship.tab.columns.renews")}</dt>
                <dd>{renewCell(row)}</dd>
                <dt>{t("sponsorship.tab.columns.welcome")}</dt>
                <dd>{welcome(row)}</dd>
              </dl>
            </details>
          )}
          {extended && actionsCell(row) && <div className={styles.cardActions}>{actionsCell(row)}</div>}
        </li>
      ))}
    </ul>
  );

  return (
    <div className={styles.tab}>
      {!extended && <InlineMessage tone="info">{t("sponsorship.tab.notSetUp")}</InlineMessage>}
      {assign && <div className={styles.actions}>{assign}</div>}
      {narrow ? (
        cards
      ) : (
        <div className={styles.table}>
          <DataTable columns={columns} rows={sponsorships} density="compact" />
        </div>
      )}
      {dialogs}
    </div>
  );
};

export default SponsorsTab;
