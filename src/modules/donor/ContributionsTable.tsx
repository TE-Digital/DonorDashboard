// src/modules/donor/ContributionsTable.tsx
//
// The ledger behind a donor's balance.
//
// Every headline figure on the donor page is a sum of these rows, and this is
// where somebody goes when they do not believe it. That is the whole job: a
// number nobody can open is a number somebody re-adds in a spreadsheet, and
// then the spreadsheet becomes the real system.
//
// A voided gift stays in the list, struck through and greyed. Deleting it would
// make the balance right and the history wrong, and the history is the reason
// anyone trusts the balance.

import React, { useState } from "react";
import { Text, Textarea } from "@mantine/core";
import { SectionCard, formatCurrency, formatDate } from "../../design-system";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  IconButton,
  type DataColumn,
} from "../../design-system/lumen";
import {
  contributionMethodLabel,
  restoreContribution,
  voidContribution,
  type Contribution,
} from "./donorMoney";

export interface ContributionsTableProps {
  contributions: Contribution[];
  onEdit: (contribution: Contribution) => void;
  /** Reload the page's balance and ledger after a void or restore. */
  onChanged: () => void;
  onRecord: () => void;
  /** The funding migration is not applied yet. */
  unavailable?: boolean;
}

export const ContributionsTable: React.FC<ContributionsTableProps> = ({
  contributions,
  onEdit,
  onChanged,
  onRecord,
  unavailable,
}) => {
  const [voiding, setVoiding] = useState<Contribution | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeVoid = () => {
    if (busy) return;
    setVoiding(null);
    setReason("");
    setError(null);
  };

  const confirmVoid = async () => {
    if (!voiding) return;
    setBusy(true);
    const result = await voidContribution(voiding.id, reason);
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "We couldn't void this payment. Check your connection and try again.");
      return;
    }
    closeVoid();
    onChanged();
  };

  const restore = async (row: Contribution) => {
    const result = await restoreContribution(row.id);
    if (result.ok) onChanged();
  };

  const columns: DataColumn<Contribution>[] = [
    {
      key: "received_on",
      label: "Received",
      width: 130,
      render: (row) => (
        <Text size="sm" style={{ textDecoration: row.voided_at ? "line-through" : undefined }}>
          {formatDate(row.received_on)}
        </Text>
      ),
    },
    {
      key: "amount_thb",
      label: "Amount",
      align: "right",
      numeric: true,
      width: 130,
      render: (row) => (
        <Text
          size="sm"
          fw={500}
          c={row.voided_at ? "dimmed" : undefined}
          style={{ textDecoration: row.voided_at ? "line-through" : undefined }}
        >
          {formatCurrency(row.amount_thb)}
        </Text>
      ),
    },
    {
      key: "method",
      label: "How",
      width: 140,
      render: (row) => contributionMethodLabel(row.method),
    },
    {
      key: "reference",
      label: "Reference",
      width: 160,
      muted: true,
      render: (row) => row.reference || "Not recorded",
    },
    {
      key: "note",
      label: "Note",
      muted: true,
      render: (row) =>
        row.voided_at ? (
          <Badge tone="neutral">Voided{row.voided_reason ? `: ${row.voided_reason}` : ""}</Badge>
        ) : (
          row.note || "Not recorded"
        ),
    },
    {
      key: "actions",
      label: "",
      width: 92,
      align: "right",
      render: (row) =>
        row.voided_at ? (
          <Button variant="ghost" size="sm" onClick={() => restore(row)}>
            Restore
          </Button>
        ) : (
          <span style={{ display: "inline-flex", gap: 4 }}>
            <IconButton icon="pencil" label="Edit this payment" onClick={() => onEdit(row)} />
            <IconButton icon="x" label="Void this payment" onClick={() => setVoiding(row)} />
          </span>
        ),
    },
  ];

  return (
    <SectionCard
      title="Payments"
      actions={
        <Button variant="secondary" icon="plus" onClick={onRecord} disabled={unavailable}>
          Record payment
        </Button>
      }
    >
      {unavailable ? (
        <EmptyState
          icon="banknote"
          title="Payments can't be recorded yet"
          description="There's nowhere to record money yet. Ask whoever looks after the system to set this up."
        />
      ) : contributions.length === 0 ? (
        <EmptyState
          icon="banknote"
          title="No money recorded"
          description="Record the first payment and this donor gets a balance to allocate from."
          action={
            <Button variant="secondary" icon="plus" onClick={onRecord}>
              Record payment
            </Button>
          }
        />
      ) : (
        <DataTable columns={columns} rows={contributions} density="compact" />
      )}

      {voiding && (
        <Dialog
          open
          onClose={closeVoid}
          title="Void this payment?"
          // The prompt names the amount and the date rather than saying "this
          // item", because voiding changes what the donor can allocate and may
          // push their balance negative.
          description={`${formatCurrency(voiding.amount_thb)} received on ${formatDate(
            voiding.received_on,
          )} stops counting toward this donor's balance. The row stays in the ledger.`}
          footer={
            <>
              <Button variant="ghost" onClick={closeVoid} disabled={busy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmVoid} disabled={busy}>
                {busy ? "Voiding…" : "Void payment"}
              </Button>
            </>
          }
        >
          <Textarea
            label="Why"
            placeholder="Recorded twice by mistake."
            autosize
            minRows={2}
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
          />
          {error && (
            <Text size="sm" c="red" mt="sm">
              {error}
            </Text>
          )}
        </Dialog>
      )}
    </SectionCard>
  );
};

export default ContributionsTable;
