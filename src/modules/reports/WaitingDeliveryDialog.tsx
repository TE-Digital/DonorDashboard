// src/modules/reports/WaitingDeliveryDialog.tsx
//
// Send one report to the people still waiting for it (task 1.15).
//
// Opened from the Waiting to send list on Reports beta. Each waiting or failed
// recipient is its own row with its own Send button, and a send reaches that
// one person only: the report went to everybody else already, and sending it
// again to them would be the mistake this list exists to avoid.
//
//   * A donor with no address gets a "Send to" box, and the address is saved
//     to them unless the tick is cleared, so the next report goes by itself.
//   * A donor whose email the service refused is retried at the same address;
//     changing it happens on the donor, where it is checked and kept.
//   * An added address that failed is retried as itself.

import React, { useEffect, useState } from "react";
import { Checkbox, Stack, Text, TextInput } from "@mantine/core";
import { supabase } from "../../lib/supabaseClient";
import { Badge, Banner, Button, Dialog } from "../../design-system/lumen";
import { isEmail } from "../../design-system/fieldValidation";
import { notifyDeliveriesChanged, type ReportDelivery } from "./reportDeliveries";
import styles from "./EmailPreviewDialog.module.scss";

export interface WaitingDeliveryDialogProps {
  opened: boolean;
  reportId: string;
  studentName: string;
  deliveries: ReportDelivery[];
  onClose: () => void;
  /** Something was sent: the list behind the dialog should reload. */
  onSent: () => void;
}

interface Typed {
  email: string;
  save: boolean;
}

const who = (delivery: ReportDelivery): string => delivery.name ?? delivery.email ?? "Someone";

export const WaitingDeliveryDialog: React.FC<WaitingDeliveryDialogProps> = ({
  opened,
  reportId,
  studentName,
  deliveries,
  onClose,
  onSent,
}) => {
  const [open, setOpen] = useState<ReportDelivery[]>(deliveries);
  const [typed, setTyped] = useState<Record<string, Typed>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentNames, setSentNames] = useState<string[]>([]);

  useEffect(() => {
    if (!opened) return;
    setOpen(deliveries);
    setTyped({});
    setTouched({});
    setErrors({});
    setSentNames([]);
  }, [opened, deliveries]);

  const typedFor = (id: string): Typed => typed[id] ?? { email: "", save: true };
  const needsAddress = (delivery: ReportDelivery) => Boolean(delivery.donor_id) && !delivery.email?.trim();
  const addressProblem = (delivery: ReportDelivery): string | null => {
    if (!needsAddress(delivery)) return null;
    const value = typedFor(delivery.id).email.trim();
    if (!value) return "Type the address to send it to.";
    return isEmail(value) ? null : "That doesn't look like a complete email address.";
  };

  const send = async (delivery: ReportDelivery) => {
    if (sendingId) return;
    setTouched((prev) => ({ ...prev, [delivery.id]: true }));
    if (addressProblem(delivery)) return;

    setSendingId(delivery.id);
    setErrors((prev) => {
      const { [delivery.id]: _drop, ...rest } = prev;
      return rest;
    });

    const value = typedFor(delivery.id);
    // One recipient only: onlyDonorIds scopes the send, and an empty list means
    // "no donor", which is what retrying an added address needs.
    const body = delivery.donor_id
      ? {
          reportId,
          onlyDonorIds: [delivery.donor_id],
          donorAddresses: needsAddress(delivery)
            ? [{ donorId: delivery.donor_id, email: value.email.trim(), saveToDonor: value.save }]
            : [],
        }
      : {
          reportId,
          onlyDonorIds: [],
          extraRecipients: [{ email: delivery.email ?? "", language: delivery.language }],
        };

    const { data, error } = await supabase.functions.invoke("report-email", { body });
    setSendingId(null);

    if (error) {
      const detail = await error.context?.json?.().catch(() => null);
      setErrors((prev) => ({
        ...prev,
        [delivery.id]: detail?.error ?? "We couldn't send this. Check your connection and try again.",
      }));
      return;
    }
    if ((data?.failed ?? []).length > 0 || (data?.sent ?? []).length === 0) {
      setErrors((prev) => ({
        ...prev,
        [delivery.id]: "The email service turned this one down. Check the address on the donor, then try again.",
      }));
      return;
    }

    setOpen((prev) => prev.filter((d) => d.id !== delivery.id));
    setSentNames((prev) => [...prev, who(delivery)]);
    notifyDeliveriesChanged();
    onSent();
  };

  const list = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

  return (
    <Dialog
      open={opened}
      onClose={() => (sendingId ? undefined : onClose())}
      width={560}
      title={`Waiting to send · ${studentName}'s report`}
      description="These people haven't got this report yet. Send it to each one here. Nobody else gets it again."
      footer={
        <Button variant={open.length === 0 ? "primary" : "ghost"} onClick={onClose} disabled={Boolean(sendingId)}>
          {open.length === 0 ? "Done" : "Close"}
        </Button>
      }
    >
      <Stack gap="md">
        {sentNames.length > 0 && (
          <Banner tone="success" title={`Sent to ${list.format(sentNames)}`}>
            {open.length === 0 ? "Everyone has this report now." : "The others below are still waiting."}
          </Banner>
        )}

        {open.length === 0 && sentNames.length === 0 && (
          <Text size="sm" c="dimmed">
            Nobody is waiting for this report.
          </Text>
        )}

        {open.map((delivery) => {
          const name = who(delivery);
          const value = typedFor(delivery.id);
          const problem = touched[delivery.id] ? addressProblem(delivery) : null;
          const failed = delivery.status === "failed";
          return (
            <div key={delivery.id} className={styles.missing} aria-label={`Waiting: ${name}`} role="group">
              <div className={styles.waitingHead}>
                <Text fw={600} size="sm">
                  {name}
                </Text>
                <Badge tone={failed ? "danger" : "warning"} dot>
                  {failed ? "Didn't send" : "Waiting"}
                </Badge>
                <Badge tone="neutral">{delivery.language === "th" ? "ไทย" : "EN"}</Badge>
              </div>

              {needsAddress(delivery) ? (
                <>
                  <TextInput
                    type="email"
                    label="Send to"
                    description="We don't have an email address for them."
                    placeholder="name@example.com"
                    value={value.email}
                    error={problem}
                    onBlur={() => setTouched((prev) => ({ ...prev, [delivery.id]: true }))}
                    onChange={(event) => {
                      const email = event.currentTarget.value;
                      setTyped((prev) => ({ ...prev, [delivery.id]: { ...value, email } }));
                    }}
                  />
                  <Checkbox
                    checked={value.save}
                    label={`Also save this address to ${name}`}
                    onChange={(event) => {
                      const save = event.currentTarget.checked;
                      setTyped((prev) => ({ ...prev, [delivery.id]: { ...value, save } }));
                    }}
                  />
                </>
              ) : (
                <Text size="sm">
                  {failed
                    ? `The email service turned down ${delivery.email}. Try again, or fix the address on the donor first.`
                    : `Not sent yet. It goes to ${delivery.email}.`}
                </Text>
              )}

              {errors[delivery.id] && (
                <Text size="sm" c="red" role="alert">
                  {errors[delivery.id]}
                </Text>
              )}

              <div>
                <Button
                  variant="primary"
                  icon="send"
                  onClick={() => void send(delivery)}
                  disabled={Boolean(sendingId)}
                >
                  {sendingId === delivery.id ? "Sending…" : failed ? `Try ${name} again` : `Send to ${name}`}
                </Button>
              </div>
            </div>
          );
        })}
      </Stack>
    </Dialog>
  );
};

export default WaitingDeliveryDialog;
