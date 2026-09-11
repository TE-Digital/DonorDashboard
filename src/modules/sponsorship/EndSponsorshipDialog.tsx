// src/modules/sponsorship/EndSponsorshipDialog.tsx
//
// Ending a donor's support for a student.
//
// Names the donor, the student, the date and the money that goes back, because
// "end this item?" is a question nobody can answer confidently. A reason is
// required: the ledger row it writes is the only explanation anyone will have
// in a year for why the balance moved.

import React, { useEffect, useState } from "react";
import { Select, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { InlineMessage, formatCurrency, formatDate } from "../../design-system";
import { Button, Dialog, Icon } from "../../design-system/lumen";
import { endSponsorship, releasePreview } from "./sponsorshipActions";
import type { Sponsorship } from "./sponsorships";

const REASONS = ["student_left", "donor_withdrew", "completed", "other"] as const;
type Reason = (typeof REASONS)[number];

export interface EndSponsorshipDialogProps {
  row: Sponsorship | null;
  studentName: string;
  onClose: () => void;
  onEnded: () => void;
}

export const EndSponsorshipDialog: React.FC<EndSponsorshipDialogProps> = ({ row, studentName, onClose, onEnded }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    setReason(null);
    setNote("");
    setError(null);
    setNoteError(null);
  }, [row?.id]);

  if (!row) return null;

  const donor = row.donorName ?? t("donorCard.aDonor");
  const release = releasePreview(row);
  const today = formatDate(new Date().toISOString().slice(0, 10));

  const confirm = async () => {
    if (!reason) {
      setNoteError(t("sponsorship.end.reasonRequired"));
      return;
    }
    if (reason === "other" && !note.trim()) {
      setNoteError(t("sponsorship.end.noteRequired"));
      document.getElementById("end-sponsorship-note")?.focus();
      return;
    }
    setNoteError(null);
    setBusy(true);
    setError(null);

    const label = t(`sponsorship.end.reasons.${reason}`);
    const result = await endSponsorship(row, note.trim() ? `${label}: ${note.trim()}` : label, studentName);
    setBusy(false);

    if (!result.ok) {
      setError(t(`sponsorship.errors.${result.reason ?? "failed"}`));
      return;
    }

    notifications.show({
      title: t("sponsorship.end.endedTitle"),
      message:
        result.released > 0
          ? t("sponsorship.end.endedMessage", { donor, student: studentName, amount: formatCurrency(result.released) })
          : t("sponsorship.end.endedMessageNothing", { donor, student: studentName }),
      color: "green",
      icon: <Icon name="check" size={16} />,
      withBorder: true,
    });
    onEnded();
    onClose();
  };

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      title={t("sponsorship.end.title", { donor, student: studentName })}
      description={
        release > 0
          ? t("sponsorship.end.body", { donor, student: studentName, date: today, amount: formatCurrency(release) })
          : t("sponsorship.end.bodyNothing", { donor, student: studentName, date: today })
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={() => void confirm()} disabled={busy}>
            {busy ? t("sponsorship.end.ending") : t("sponsorship.end.confirm")}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        <Select
          label={t("sponsorship.end.reason")}
          data={REASONS.map((value) => ({ value, label: t(`sponsorship.end.reasons.${value}`) }))}
          value={reason}
          onChange={(value) => setReason(value as Reason | null)}
          error={noteError && !reason ? noteError : undefined}
          data-autofocus
        />
        <Textarea
          id="end-sponsorship-note"
          label={reason === "other" ? t("sponsorship.end.note") : t("sponsorship.end.noteOptional")}
          minRows={2}
          autosize
          value={note}
          onChange={(event) => setNote(event.currentTarget.value)}
          error={noteError && reason ? noteError : undefined}
        />
        {error && <InlineMessage tone="error">{error}</InlineMessage>}
      </div>
    </Dialog>
  );
};

export default EndSponsorshipDialog;
