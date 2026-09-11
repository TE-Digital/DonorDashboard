// src/modules/sponsorship/NeedsDecisionPanel.tsx
//
// Support that has stopped and is waiting for a person.
//
// Three things put support here: the student left the programme, the student
// graduated, or the donor's balance could not cover the next school year. In
// each case reports have stopped going out and the money is still set aside,
// because returning it quietly would itself be a decision.
//
// The panel says what happened, shows the numbers, and offers the four ways
// forward. Each is confirmed with the amounts and people named, because every
// one of them moves money.

import React, { useEffect, useMemo, useState } from "react";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { FormDrawer, FormFeedback, InlineMessage, formatCurrency, formatDate } from "../../design-system";
import { Button, Dialog, Icon } from "../../design-system/lumen";
import { loadDonorBalance } from "../donor/donorMoney";
import { supabase } from "../../lib/supabaseClient";
import { DEFAULT_CALENDAR, loadProgrammeCalendar, type ProgrammeCalendar } from "../calendar/schoolCalendar";
import { EndSponsorshipDialog } from "./EndSponsorshipDialog";
import { endSponsorship, releasePreview, renewSponsorship, renewalPreview } from "./sponsorshipActions";
import { decisionKey, type Sponsorship } from "./sponsorships";
import styles from "./NeedsDecisionPanel.module.scss";

type Choice = "renew" | "reassign" | "return";

export interface NeedsDecisionPanelProps {
  row: Sponsorship | null;
  studentName: string;
  onClose: () => void;
  /** Reload after any decision. */
  onDecided: () => void;
  /** After ending, open the assign drawer on this donor so the money can go to another student. */
  onReassign: (row: Sponsorship) => void;
}

export const NeedsDecisionPanel: React.FC<NeedsDecisionPanelProps> = ({
  row,
  studentName,
  onClose,
  onDecided,
  onReassign,
}) => {
  const { t } = useTranslation();
  const [freeBalance, setFreeBalance] = useState<number | null>(null);
  const [calendar, setCalendar] = useState<ProgrammeCalendar>(DEFAULT_CALENDAR);
  const [confirming, setConfirming] = useState<Choice | null>(null);
  const [ending, setEnding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Someone else (another admin, or the renewal job) settled this while the panel was open. */
  const [resolvedElsewhere, setResolvedElsewhere] = useState(false);

  useEffect(() => {
    if (!row) return;
    setError(null);
    setConfirming(null);
    setResolvedElsewhere(false);
    let cancelled = false;
    Promise.all([loadDonorBalance(row.donorId), loadProgrammeCalendar(), stillWaiting(row.id)]).then(([balance, cal, waiting]) => {
      if (cancelled) return;
      setFreeBalance(balance.data.free_balance_thb);
      setCalendar(cal.data);
      if (!waiting) setResolvedElsewhere(true);
    });
    return () => {
      cancelled = true;
    };
  }, [row]);

  const renewal = useMemo(() => (row ? renewalPreview(row, calendar) : null), [row, calendar]);

  if (!row) return null;

  const donor = row.donorName ?? t("donorCard.aDonor");
  const release = releasePreview(row);
  const canRenew = row.decisionReason === "renewal_short" && renewal !== null && freeBalance !== null && freeBalance >= renewal.amount;
  const shortBy = renewal && freeBalance !== null ? Math.max(0, renewal.amount - freeBalance) : 0;

  const happened =
    row.decisionReason === "renewal_short"
      ? t("sponsorship.decide.whyShort", { donor, student: studentName, date: formatDate(row.coverageEnd) })
      : row.decisionReason === "graduated"
        ? t("sponsorship.decide.whyGraduated", { student: studentName })
        : t("sponsorship.decide.whyLeft", { student: studentName });

  const done = (message: string) => {
    notifications.show({
      title: t("sponsorship.decide.doneTitle"),
      message,
      color: "green",
      icon: <Icon name="check" size={16} />,
      withBorder: true,
    });
    onDecided();
    onClose();
  };

  const act = async (choice: Choice) => {
    setBusy(true);
    setError(null);

    // Checked again at the moment of acting: the row on screen may be minutes old.
    if (!(await stillWaiting(row.id))) {
      setBusy(false);
      setConfirming(null);
      setResolvedElsewhere(true);
      onDecided();
      return;
    }

    if (choice === "renew") {
      const result = await renewSponsorship(row);
      setBusy(false);
      setConfirming(null);
      if (!result.ok) return setError(t("sponsorship.decide.renewFailed"));
      return done(t("sponsorship.decide.renewed", { donor, student: studentName, date: formatDate(renewal?.end ?? null) }));
    }

    const reason =
      choice === "reassign"
        ? t("sponsorship.decide.reasonReassign")
        : row.decisionReason
          ? t(decisionKey(row.decisionReason))
          : t("sponsorship.decide.reasonReturn");
    const result = await endSponsorship(row, reason, studentName);
    setBusy(false);
    setConfirming(null);
    if (!result.ok) return setError(t(`sponsorship.errors.${result.reason ?? "failed"}`));

    if (choice === "reassign") {
      onDecided();
      onClose();
      onReassign(row);
      return;
    }
    return done(t("sponsorship.decide.returned", { donor, amount: formatCurrency(result.released) }));
  };

  const confirmText: Record<Choice, { title: string; body: string; action: string }> = {
    renew: {
      title: t("sponsorship.decide.renewTitle", { donor, student: studentName }),
      body: t("sponsorship.decide.renewBody", {
        amount: formatCurrency(renewal?.amount ?? 0),
        start: formatDate(renewal?.start ?? null),
        end: formatDate(renewal?.end ?? null),
      }),
      action: t("sponsorship.decide.renew"),
    },
    reassign: {
      title: t("sponsorship.decide.reassignTitle", { donor }),
      body: t("sponsorship.decide.reassignBody", { donor, student: studentName, amount: formatCurrency(release) }),
      action: t("sponsorship.decide.reassign"),
    },
    return: {
      title: t("sponsorship.decide.returnTitle", { donor }),
      body: t("sponsorship.decide.returnBody", { donor, student: studentName, amount: formatCurrency(release) }),
      action: t("sponsorship.decide.return"),
    },
  };

  return (
    <>
      <FormDrawer
        opened
        onClose={onClose}
        busy={busy}
        size={560}
        title={t("sponsorship.decide.title", { donor })}
      >
        <div className={styles.panel}>
          <p className={styles.happened}>{happened}</p>

          <dl className={styles.facts}>
            <dt>{t("sponsorship.decide.student")}</dt>
            <dd>{studentName}</dd>
            <dt>{t("sponsorship.decide.monthly")}</dt>
            <dd>{formatCurrency(row.monthlyAmountThb)}</dd>
            <dt>{t("sponsorship.decide.unused")}</dt>
            <dd>{formatCurrency(release)}</dd>
            <dt>{t("sponsorship.decide.free")}</dt>
            <dd>{freeBalance === null ? t("sponsorship.decide.checking") : formatCurrency(freeBalance)}</dd>
            {row.decisionSince && (
              <>
                <dt>{t("sponsorship.decide.waiting")}</dt>
                <dd>{t("sponsorship.decide.since", { date: formatDate(row.decisionSince) })}</dd>
              </>
            )}
          </dl>

          {resolvedElsewhere ? (
            <InlineMessage tone="warning">{t("sponsorship.decide.resolvedElsewhere")}</InlineMessage>
          ) : (
            <InlineMessage tone="info">{t("sponsorship.decide.paused")}</InlineMessage>
          )}
          {error && <FormFeedback tone="error">{error}</FormFeedback>}

          <div className={styles.choices}>
            <div className={styles.choice}>
              <Button variant="secondary" icon="hand-coins" disabled={busy || resolvedElsewhere} onClick={() => setConfirming("reassign")}>
                {t("sponsorship.decide.reassign")}
              </Button>
              <span className={styles.choiceNote}>{t("sponsorship.decide.reassignNote")}</span>
            </div>
            <div className={styles.choice}>
              <Button variant="secondary" icon="wallet" disabled={busy || resolvedElsewhere} onClick={() => setConfirming("return")}>
                {t("sponsorship.decide.return")}
              </Button>
              <span className={styles.choiceNote}>{t("sponsorship.decide.returnNote", { amount: formatCurrency(release) })}</span>
            </div>
            <div className={styles.choice}>
              <Button variant="ghost" icon="x" disabled={busy || resolvedElsewhere} onClick={() => setEnding(true)}>
                {t("sponsorship.decide.end")}
              </Button>
              <span className={styles.choiceNote}>{t("sponsorship.decide.endNote")}</span>
            </div>
            {row.decisionReason === "renewal_short" && (
              // The primary way forward, last and pinned on a phone.
              <div className={`${styles.choice} ${styles.primaryChoice}`}>
                <Button
                  variant="primary"
                  icon="refresh-cw"
                  disabled={!canRenew || busy || resolvedElsewhere}
                  onClick={() => setConfirming("renew")}
                >
                  {t("sponsorship.decide.renew")}
                  {/* Buttons here can't take aria-describedby, so a disabled
                      Renew carries its reason inside its own name. */}
                  {!canRenew && <span className={styles.srOnly}>. {t("sponsorship.decide.renewShort", { donor, amount: formatCurrency(shortBy) })}</span>}
                </Button>
                <span className={styles.choiceNote} aria-hidden={!canRenew}>
                  {canRenew
                    ? t("sponsorship.decide.renewNote", { amount: formatCurrency(renewal?.amount ?? 0) })
                    : t("sponsorship.decide.renewShort", { donor, amount: formatCurrency(shortBy) })}
                </span>
              </div>
            )}
          </div>
        </div>
      </FormDrawer>

      {confirming && (
        <Dialog
          open
          onClose={busy ? undefined : () => setConfirming(null)}
          title={confirmText[confirming].title}
          description={confirmText[confirming].body}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(null)} disabled={busy}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" onClick={() => void act(confirming)} disabled={busy}>
                {busy ? t("common.saving") : confirmText[confirming].action}
              </Button>
            </>
          }
        />
      )}

      {ending && (
        <EndSponsorshipDialog
          row={row}
          studentName={studentName}
          onClose={() => setEnding(false)}
          onEnded={() => {
            onDecided();
            onClose();
          }}
        />
      )}
    </>
  );
};

/** True while the row is still waiting on a decision in the database. */
const stillWaiting = async (id: string): Promise<boolean> => {
  const { data, error } = await supabase.from("scholarships").select("status").eq("id", id).maybeSingle();
  if (error) return true; // Can't tell: let the action try, and its own error speak.
  return (data as { status?: string } | null)?.status === "needs_decision";
};

export default NeedsDecisionPanel;
