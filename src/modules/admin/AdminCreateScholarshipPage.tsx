// src/modules/admin/AdminCreateScholarshipPage.tsx
import React, { useEffect, useState } from "react";
import {
  Button,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { toFriendlyError } from "../../i18n/errors";
import {
  FormBody,
  FormError,
  FormFooter,
  FormPage,
  FormSection,
  LoadingState,
  CURRENCY,
  currencyOptionsFor,
  errorSummary,
  fieldId,
  firstError,
  focusField,
  hasErrors,
  type FieldErrors,
} from "../../design-system";

type Option = { value: string; label: string };

type GrantTypeMeta = {
  id: string;
  name: string | null;
  amount_per_period: number | null;     // <- matches grant_types
  currency: string | null;
  default_duration_months: number | null;
};

// helper: add N months to a date
const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};


/** Namespaces this form's field ids. */
const FORM_ID = "scholarship-new";

/** The fields an award can be wrong about, in the order the form asks. */
type AwardField = "grantTypeId" | "periodStart" | "periodEnd" | "amount" | "paymentDate";

const AWARD_FIELD_ORDER: readonly AwardField[] = [
  "grantTypeId",
  "periodStart",
  "periodEnd",
  "amount",
  "paymentDate",
];

/**
 * Everything wrong with an award, by field.
 *
 * Twelve inputs used to share one sentence in a banner — "Please choose both
 * period start and end" left the person to work out which of the two dates it
 * meant.
 */
const validateAward = (values: {
  grantTypeId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  amount: number | undefined;
  isPaid: boolean;
  paymentDate: Date | null;
}): FieldErrors<AwardField> => {
  const errors: FieldErrors<AwardField> = {};

  if (!values.grantTypeId) errors.grantTypeId = "Choose the grant type this award is under.";
  if (!values.periodStart) errors.periodStart = "Choose the day this award starts.";
  if (!values.periodEnd) errors.periodEnd = "Choose the day this award ends.";

  if (values.periodStart && values.periodEnd && values.periodStart > values.periodEnd) {
    errors.periodEnd = "The period ends before it starts.";
  }

  if (values.amount != null && values.amount < 0) {
    errors.amount = "Enter an amount of 0 or more.";
  }

  // Money that is marked as paid needs the day it was paid, or the payment
  // cannot be reconciled against a bank statement later.
  if (values.isPaid && !values.paymentDate) {
    errors.paymentDate = "Add the date this was paid.";
  }

  return errors;
};

export const AdminCreateScholarshipPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const prefillStudentId = searchParams.get("studentId");
  const prefillDonorId = searchParams.get("donorId");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<AwardField>>({});

  /** id + error together, so no field can be marked without being reachable. */
  const field = (key: AwardField) => ({ id: fieldId(FORM_ID, key), error: fieldErrors[key] });

  const [grantTypeOptions, setGrantTypeOptions] = useState<Option[]>([]);
  const [grantTypeMeta, setGrantTypeMeta] = useState<GrantTypeMeta[]>([]);
  const [studentOptions, setStudentOptions] = useState<Option[]>([]);
  const [donorOptions, setDonorOptions] = useState<Option[]>([]);

  const [grantTypeId, setGrantTypeId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(prefillStudentId);
  const [donorId, setDonorId] = useState<string | null>(prefillDonorId);

  // amount for this scholarship period (maps to scholarship_awards.amount_for_period)
  const [amountForPeriod, setAmountForPeriod] = useState<number | undefined>(
    undefined
  );
  const [currency, setCurrency] = useState<string>("THB");

  const today = new Date();
  const defaultEnd = addMonths(today, 12);

  const [periodStart, setPeriodStart] = useState<Date | null>(today);
  const [periodEnd, setPeriodEnd] = useState<Date | null>(defaultEnd);

  const [status, setStatus] = useState<string>("planned");

  const [isPaid, setIsPaid] = useState(false);
  const [paymentDate, setPaymentDate] = useState<Date | null>(null);
  const [paymentNote, setPaymentNote] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // grant types with meta
        const { data: gtData, error: gtError } = await supabase
          .from("grant_types")
          .select(
            "id, name, amount_per_period, currency, default_duration_months"
          ) // <-- use amount_per_period here
          .order("name", { ascending: true });

        if (gtError) throw gtError;

        const meta: GrantTypeMeta[] = (gtData ?? []).map((g: any) => ({
          id: g.id,
          name: g.name ?? null,
          amount_per_period: g.amount_per_period ?? null,
          currency: g.currency ?? null,
          default_duration_months: g.default_duration_months ?? null,
        }));

        setGrantTypeMeta(meta);
        setGrantTypeOptions(
          meta.map((g) => ({
            value: g.id,
            label: g.name ?? "Unnamed grant type",
          }))
        );

        // students
        const { data: stData, error: stError } = await supabase
          .from("students")
          .select("id, name")
          .order("name", { ascending: true });

        if (stError) throw stError;

        setStudentOptions(
          (stData ?? []).map((s: any) => ({
            value: s.id,
            label: s.name ?? "Unnamed student",
          }))
        );

        // donors
        const { data: dData, error: dError } = await supabase
          .from("donors")
          .select("id, name")
          .order("name", { ascending: true });

        if (dError) throw dError;

        setDonorOptions(
          (dData ?? []).map((d: any) => ({
            value: d.id,
            label: d.name ?? "Unnamed donor",
          }))
        );
      } catch (err: unknown) {
        console.error("Error loading scholarship options", err);
        setError("We couldn't load the options for this form. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // smart defaults when grant type changes
  const handleGrantTypeChange = (value: string | null) => {
    setGrantTypeId(value);
    if (!value) return;

    const gt = grantTypeMeta.find((g) => g.id === value);
    if (!gt) return;

    // Suggest amount for full period from grant type
    if (typeof gt.amount_per_period === "number") {
      setAmountForPeriod(gt.amount_per_period);
    }

    // Suggest currency from grant type if available
    if (gt.currency) {
      setCurrency(gt.currency);
    }

    // Suggest period end based on default_duration_months, if we know start
    if (
      periodStart &&
      gt.default_duration_months &&
      gt.default_duration_months > 0
    ) {
      setPeriodEnd(addMonths(periodStart, gt.default_duration_months));
    }
  };

  // if user marks as paid and there is no payment date, default to today
  useEffect(() => {
    if (isPaid && !paymentDate) {
      setPaymentDate(new Date());
    }
  }, [isPaid, paymentDate]);

  const toIso = (d: Date | null): string | null =>
    d ? d.toISOString().slice(0, 10) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problems = validateAward({
      grantTypeId,
      periodStart,
      periodEnd,
      amount: typeof amountForPeriod === "number" ? amountForPeriod : undefined,
      isPaid,
      paymentDate,
    });
    setFieldErrors(problems);

    if (hasErrors(problems)) {
      setError(errorSummary(problems));
      focusField(FORM_ID, firstError(problems, AWARD_FIELD_ORDER));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        grant_type_id: grantTypeId,
        student_id: studentId || null,
        donor_id: donorId || null,
        amount_for_period:
          typeof amountForPeriod === "number" ? amountForPeriod : null, // <- matches scholarship_awards
        currency: currency || "THB",
        period_start: toIso(periodStart),
        period_end: toIso(periodEnd),
        status: status || "planned",
        is_paid: isPaid,
        payment_date: isPaid ? toIso(paymentDate) : null,
        payment_note: paymentNote || null,
        notes: notes || null,
      };

      const { error: insertError } = await supabase
        .from("scholarship_awards")
        .insert(payload);

      if (insertError) {
        setError(toFriendlyError(insertError, "errors.create"));
        setSaving(false);
        return;
      }

      navigate("/admin/scholarships", { replace: true });
    } catch (err: unknown) {
      setError(toFriendlyError(err, "errors.create"));
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <FormPage title="Add scholarship" subtitle="One grant, for one period, against one student.">
      <FormBody onSubmit={handleSubmit}>
        <FormError>{error}</FormError>

        <FormSection title="Grant">
          <Group align="flex-end" gap="md" wrap="nowrap">
            <div style={{ flex: 1, minWidth: 0 }}>
              <Select
                label="Grant type"
                {...field("grantTypeId")}
                placeholder="Select grant type"
                data={grantTypeOptions}
                value={grantTypeId}
                onChange={handleGrantTypeChange}
                required
                searchable
              />
            </div>
            <Button
              type="button"
              variant="default"
              onClick={() =>
                navigate(
                  `/admin/grant-types/new?returnTo=${encodeURIComponent(
                    "/admin/scholarships/new"
                  )}`
                )
              }
            >
              Add grant type
            </Button>
          </Group>
        </FormSection>

        <FormSection title="People">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <Select
              label="Student"
              placeholder="Select student"
              data={studentOptions}
              value={studentId}
              onChange={setStudentId}
              clearable
              searchable
            />
            <Select
              label="Donor"
              placeholder="Select donor"
              data={donorOptions}
              value={donorId}
              onChange={setDonorId}
              clearable
              searchable
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Period and amount">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <DateInput label="Period start" {...field("periodStart")} value={periodStart} onChange={setPeriodStart} required />
            <DateInput label="Period end" {...field("periodEnd")} value={periodEnd} onChange={setPeriodEnd} required />
            <NumberInput
              label="Amount for scholarship period"
              {...field("amount")}
              value={amountForPeriod}
              onChange={(val) => setAmountForPeriod(typeof val === "number" ? val : undefined)}
              min={0}
              placeholder="8400 or 150000"
            />
            <Select
              label="Currency"
              data={currencyOptionsFor(currency)}
              allowDeselect={false}
              value={currency}
              onChange={(value: string | null) => setCurrency(value ?? CURRENCY)}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Status and payment">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <Select
              label="Status"
              value={status}
              onChange={(value) => setStatus(value || "planned")}
              data={[
                { value: "planned", label: "Planned" },
                { value: "active", label: "Active" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
            <Stack gap="md">
              <Switch
                label="Paid"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.currentTarget.checked)}
              />
              <DateInput
                label="Payment date"
                {...field("paymentDate")}
                value={paymentDate}
                onChange={setPaymentDate}
                disabled={!isPaid}
              />
            </Stack>
            <TextInput
              label="Payment note or reference"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.currentTarget.value)}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Internal notes">
          <Textarea
            label="Notes"
            minRows={3}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />
        </FormSection>

        <FormFooter
          left={
            <Button
              variant="subtle"
              type="button"
              disabled={saving}
              onClick={() => navigate("/admin/scholarships")}
            >
              Cancel
            </Button>
          }
        >
          <Button type="submit" loading={saving}>
            Save scholarship
          </Button>
        </FormFooter>
      </FormBody>
    </FormPage>
  );
};
