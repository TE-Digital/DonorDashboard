// src/modules/sponsorship/SponsorshipEditDrawer.tsx
//
// Changing the terms of one donor's support for one student.
//
// The same fields as assigning, so an admin who has assigned a donor already
// knows this form. Raising the amount draws on the donor's free balance, which
// here includes what this support already holds; going past it is shown and
// blocks saving, for the same reason it does when assigning.

import React, { useEffect, useMemo, useState } from "react";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { FormDrawer, FormFeedback, formatCurrency } from "../../design-system";
import { Button, Icon } from "../../design-system/lumen";
import { loadDonorBalance } from "../donor/donorMoney";
import { pledgeFor } from "./fit";
import { SponsorshipFields, type SponsorshipDraft } from "./SponsorshipFields";
import { draftFromSponsorship, updateSponsorship } from "./sponsorshipActions";
import type { Sponsorship } from "./sponsorships";

export interface SponsorshipEditDrawerProps {
  row: Sponsorship | null;
  studentName: string;
  /** What the student is short each month, not counting this support. */
  monthlyGap: number;
  onClose: () => void;
  onSaved: () => void;
}

export const SponsorshipEditDrawer: React.FC<SponsorshipEditDrawerProps> = ({
  row,
  studentName,
  monthlyGap,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<SponsorshipDraft | null>(null);
  const [freeBalance, setFreeBalance] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!row) return;
    setDraft(draftFromSponsorship(row));
    setError(null);
    setFreeBalance(null);
    let cancelled = false;
    loadDonorBalance(row.donorId).then(({ data }) => {
      if (!cancelled) setFreeBalance(data.free_balance_thb);
    });
    return () => {
      cancelled = true;
    };
  }, [row]);

  const pledge = useMemo(() => (draft ? pledgeFor(draft) : 0), [draft]);

  if (!row || !draft) return null;

  const donor = row.donorName ?? t("donorCard.aDonor");
  // This support's own money is available to itself.
  const available = (freeBalance ?? 0) + row.totalAmountThb;
  const over = freeBalance !== null && pledge > available;
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFromSponsorship(row));

  const save = async () => {
    if (draft.supportType === "specific_item" && !draft.item.trim()) {
      setError(t("sponsorship.assign.needItem", { name: studentName }));
      return;
    }
    if (!pledge) {
      setError(t("sponsorship.assign.needAmount", { name: studentName }));
      return;
    }
    if (draft.supportType !== "specific_item" && draft.end && draft.end < draft.start) {
      setError(t("sponsorship.assign.endBeforeStart", { name: studentName }));
      return;
    }
    if (over) return;

    setSaving(true);
    setError(null);
    const result = await updateSponsorship(row, draft, studentName);
    setSaving(false);

    if (!result.ok) {
      setError(t(`sponsorship.errors.${result.reason ?? "failed"}`));
      return;
    }

    notifications.show({
      title: t("sponsorship.edit.savedTitle"),
      message: t("sponsorship.edit.savedMessage", { donor, student: studentName }),
      color: "green",
      icon: <Icon name="check" size={16} />,
      withBorder: true,
    });
    onSaved();
    onClose();
  };

  return (
    <FormDrawer
      opened
      onClose={onClose}
      busy={saving}
      dirty={dirty}
      size={720}
      title={t("sponsorship.edit.title", { donor, student: studentName })}
      subtitle={
        freeBalance === null ? undefined : t("sponsorship.edit.available", { amount: formatCurrency(available) })
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving || !dirty || over}>
            {saving ? t("common.saving") : t("common.saveChanges")}
          </Button>
        </>
      }
    >
      {over && (
        <FormFeedback tone="error">
          {t("sponsorship.edit.over", { amount: formatCurrency(pledge - available) })}
        </FormFeedback>
      )}
      {error && <FormFeedback tone="error">{error}</FormFeedback>}

      <SponsorshipFields
        idPrefix={`edit-${row.id}`}
        draft={draft}
        monthlyGap={monthlyGap + (row.status === "active" ? row.monthlyAmountThb : 0)}
        pledge={pledge}
        emailsLockedReason={row.donorWantsEmails ? null : t("sponsorship.actions.donorEmailsOff", { donor })}
        onChange={(patch) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
      />
    </FormDrawer>
  );
};

export default SponsorshipEditDrawer;
