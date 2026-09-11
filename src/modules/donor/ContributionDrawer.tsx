// src/modules/donor/ContributionDrawer.tsx
//
// Recording money that has arrived, and correcting a row that was recorded
// wrong.
//
// One drawer for both. A top-up is not a different act from a first gift — the
// donor sent money, somebody writes it down, the balance moves — so there is no
// "add more money" flow separate from "add money". The only difference between
// creating and editing is which values the fields start with and which sentence
// the footer button carries.
//
// This form does not ask which student the money is for, and that absence is
// the point of the whole feature. A gift arrives before anyone has decided what
// it pays for; making the two one step is what forced money to be invisible
// until it was spent.

import React, { useEffect, useState } from "react";
import { Anchor, NumberInput, Select, SimpleGrid, Textarea, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { formatCurrency } from "../../design-system";
import { DateInput } from "@mantine/dates";
import {
  FormBody,
  FormDrawer,
  FormFeedback,
  FormSection,
  parseDateInput,
  toDateInputValue,
} from "../../design-system";
import { Button } from "../../design-system/lumen";
import {
  CONTRIBUTION_METHODS,
  contributionToInput,
  createContribution,
  emptyContribution,
  updateContribution,
  validateContribution,
  type Contribution,
  type ContributionErrors,
  type ContributionInput,
} from "./donorMoney";

export interface ContributionDrawerProps {
  opened: boolean;
  onClose: () => void;
  donorId: string;
  donorName: string | null;
  /** Present when correcting an existing row; absent when recording new money. */
  contribution?: Contribution | null;
  /** Fired after a successful save, so the page can reload balance and ledger. */
  onSaved: () => void;
  /** Offered in the confirmation when the ledger isn't on screen. */
  onViewPayments?: () => void;
  /**
   * A next step offered in the same confirmation after new money is recorded,
   * such as assigning it to students. One message, not two stacked toasts.
   */
  followUp?: { label: string; onClick: () => void };
}

export const ContributionDrawer: React.FC<ContributionDrawerProps> = ({
  opened,
  onClose,
  donorId,
  donorName,
  contribution,
  onSaved,
  onViewPayments,
  followUp,
}) => {
  const editing = Boolean(contribution);

  const [values, setValues] = useState<ContributionInput>(emptyContribution);
  const [errors, setErrors] = useState<ContributionErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // A fresh opening starts from the row being edited, or from a blank gift
  // dated today. Reset on open rather than on close: closing mid-save would
  // otherwise blank the fields under the person watching them.
  useEffect(() => {
    if (!opened) return;
    setValues(contribution ? contributionToInput(contribution) : emptyContribution());
    setErrors({});
    setFormError(null);
    setDirty(false);
  }, [opened, contribution]);

  const set = <K extends keyof ContributionInput>(key: K, value: ContributionInput[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    // An error clears as soon as the field it belongs to is touched. Leaving it
    // until the next submit makes a corrected field keep accusing the person
    // who just corrected it.
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (saving) return;

    const found = validateContribution(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setFormError(null);
      return;
    }

    setSaving(true);
    setFormError(null);

    const result = contribution
      ? await updateContribution(contribution.id, donorId, values)
      : await createContribution(donorId, values);

    setSaving(false);

    if (!result.ok) {
      setFormError(result.message ?? "We couldn't save this payment. Check your connection and try again.");
      return;
    }

    setDirty(false);
    // One confirmation for every place a payment is recorded from: it says
    // what was added, so an admin working through a bank statement can check
    // each line without opening the ledger.
    const amount = Number(values.amount);
    notifications.show({
      color: "green",
      title: contribution ? `${formatCurrency(Number.isFinite(amount) ? amount : 0)} updated` : `${formatCurrency(Number.isFinite(amount) ? amount : 0)} recorded`,
      message:
        onViewPayments || (followUp && !contribution) ? (
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 12 }}>
            {followUp && !contribution && (
              <Anchor component="button" type="button" size="sm" onClick={followUp.onClick}>
                {followUp.label}
              </Anchor>
            )}
            {onViewPayments && (
              <Anchor component="button" type="button" size="sm" onClick={onViewPayments}>
                View payments
              </Anchor>
            )}
          </span>
        ) : donorName ? (
          `For ${donorName}.`
        ) : undefined,
    });
    onSaved();
    onClose();
  };

  return (
    <FormDrawer
      opened={opened}
      onClose={onClose}
      busy={saving}
      dirty={dirty}
      size={560}
      title={editing ? "Edit payment" : "Record payment"}
      subtitle={
        editing
          ? "Correcting a recorded payment. The balance updates when you save."
          : `Money received from ${donorName || "this donor"}, before it is assigned to a student.`
      }
      status={saving ? "Saving…" : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => submit()} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Record payment"}
          </Button>
        </>
      }
    >
      <FormBody onSubmit={submit}>
        {formError && <FormFeedback tone="error">{formError}</FormFeedback>}

        <FormSection title="The payment" hint="What arrived, and when.">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            {/* Money is a NumberInput everywhere in the product, with the
                separator the amount is read with. */}
            <NumberInput
              label="Amount (THB)"
              placeholder="60,000"
              withAsterisk
              min={0}
              thousandSeparator=","
              hideControls
              value={values.amount}
              error={errors.amount}
              onChange={(value: string | number) => set("amount", value === "" ? "" : String(value))}
              data-autofocus
            />
            <DateInput
              label="Date received"
              placeholder="Pick the day the money arrived"
              withAsterisk
              valueFormat="D MMM YYYY"
              maxDate={new Date()}
              value={parseDateInput(values.receivedOn)}
              error={errors.receivedOn}
              onChange={(value) => set("receivedOn", toDateInputValue(value))}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mt="lg">
            <Select
              label="How it arrived"
              data={CONTRIBUTION_METHODS.map((m) => ({ value: m.value, label: m.label }))}
              value={values.method}
              onChange={(value) => set("method", value ?? "")}
              allowDeselect={false}
            />
            <TextInput
              label="Reference"
              placeholder="Transfer or receipt number"
              value={values.reference}
              onChange={(event) => set("reference", event.currentTarget.value)}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Note" hint="Anything the next person opening this row should know.">
          <Textarea
            label="Internal note"
            placeholder="Sent through the Chiang Rai office; receipt posted."
            autosize
            minRows={3}
            value={values.note}
            onChange={(event) => set("note", event.currentTarget.value)}
          />
        </FormSection>
      </FormBody>
    </FormDrawer>
  );
};

export default ContributionDrawer;
