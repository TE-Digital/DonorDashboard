// src/modules/admin/AdminEditScholarshipPage.tsx
import React, { useEffect, useState } from "react";
import {
  Button,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useNavigate, useParams } from "react-router-dom";
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

type ScholarshipRow = {
  id: string;
  grant_type_id: string | null;
  student_id: string | null;
  donor_id: string | null;
  amount_for_period: number | null;   // ← matches DB
  currency: string | null;
  period_start: string | null;
  period_end: string | null;
  status: string | null;
  is_paid: boolean | null;
  payment_date: string | null;
  payment_note: string | null;
  notes: string | null;
};

type GrantTypeMeta = {
  id: string;
  name: string | null;
  amount_per_period: number | null;   // ← from grant_types
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
const FORM_ID = "scholarship-edit";

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

export const AdminEditScholarshipPage: React.FC = () => {
  const { scholarshipId } = useParams<{ scholarshipId: string }>();
  const navigate = useNavigate();

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
  const [studentId, setStudentId] = useState<string | null>(null);
  const [donorId, setDonorId] = useState<string | null>(null);

  // local amount for this scholarship period (maps to scholarship_awards.amount_for_period)
  const [amountForPeriod, setAmountForPeriod] = useState<number | undefined>();
  const [currency, setCurrency] = useState<string>("THB");
  const [periodStart, setPeriodStart] = useState<Date | null>(null);
  const [periodEnd, setPeriodEnd] = useState<Date | null>(null);
  const [status, setStatus] = useState<string>("planned");
  const [isPaid, setIsPaid] = useState(false);
  const [paymentDate, setPaymentDate] = useState<Date | null>(null);
  const [paymentNote, setPaymentNote] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!scholarshipId) return;

      setLoading(true);
      setError(null);

      try {
        // reference data
        const [
          { data: gtData, error: gtError },
          { data: stData, error: stError },
          { data: dData, error: dError },
        ] = await Promise.all([
          supabase
            .from("grant_types")
            .select(
              "id, name, amount_per_period, currency, default_duration_months"
            )
            .order("name"),
          supabase.from("students").select("id, name").order("name"),
          supabase.from("donors").select("id, name").order("name"),
        ]);

        if (gtError) throw gtError;
        if (stError) throw stError;
        if (dError) throw dError;

        const gtMeta: GrantTypeMeta[] = (gtData ?? []).map((g: any) => ({
          id: g.id,
          name: g.name ?? null,
          amount_per_period: g.amount_per_period ?? null, // ← fixed typo
          currency: g.currency ?? null,
          default_duration_months: g.default_duration_months ?? null,
        }));

        setGrantTypeMeta(gtMeta);
        setGrantTypeOptions(
          gtMeta.map((g) => ({
            value: g.id,
            label: g.name ?? "Unnamed grant type",
          }))
        );

        setStudentOptions(
          (stData ?? []).map((s: any) => ({
            value: s.id,
            label: s.name ?? "Unnamed student",
          }))
        );
        setDonorOptions(
          (dData ?? []).map((d: any) => ({
            value: d.id,
            label: d.name ?? "Unnamed donor",
          }))
        );

        // scholarship itself
        const { data: schData, error: schError } = await supabase
          .from("scholarship_awards")
          .select(
            `
            id,
            grant_type_id,
            student_id,
            donor_id,
            amount_for_period,
            currency,
            period_start,
            period_end,
            status,
            is_paid,
            payment_date,
            payment_note,
            notes
          `
          )
          .eq("id", scholarshipId)
          .maybeSingle();

        if (schError) throw schError;
        if (!schData) {
          setError("We couldn't find this scholarship. It may have been removed.");
          setLoading(false);
          return;
        }

        const row = schData as ScholarshipRow;

        setGrantTypeId(row.grant_type_id);
        setStudentId(row.student_id);
        setDonorId(row.donor_id);
        setAmountForPeriod(
          typeof row.amount_for_period === "number"
            ? row.amount_for_period
            : undefined
        ); // ← use amount_for_period from DB
        setCurrency(row.currency || "THB");
        setPeriodStart(
          row.period_start ? new Date(row.period_start) : null
        );
        setPeriodEnd(row.period_end ? new Date(row.period_end) : null);
        setStatus(row.status || "planned");
        setIsPaid(!!row.is_paid);
        setPaymentDate(
          row.payment_date ? new Date(row.payment_date) : null
        );
        setPaymentNote(row.payment_note || "");
        setNotes(row.notes || "");
      } catch (err: unknown) {
        setError(toFriendlyError(err, "errors.load"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [scholarshipId]);

  // smart defaults when grant type changes
  const handleGrantTypeChange = (value: string | null) => {
    setGrantTypeId(value);
    if (!value) return;

    const gt = grantTypeMeta.find((g) => g.id === value);
    if (!gt) return;

    // Suggest amount if empty
    setAmountForPeriod((prev) => {
      if (prev === undefined || prev === null) {
        return typeof gt.amount_per_period === "number"
          ? gt.amount_per_period
          : prev;
      }
      return prev;
    });

    // Suggest currency if empty / THB
    if ((!currency || currency === "THB") && gt.currency) {
      setCurrency(gt.currency);
    }

    // Suggest period end if none yet and periodStart set
    // Hoisted out of the condition: the `> 0` narrowing does not survive into
    // the setPeriodEnd callback, so `default_duration_months` would still read
    // as `number | null` in there.
    const durationMonths = gt.default_duration_months;
    if (periodStart && durationMonths && durationMonths > 0) {
      setPeriodEnd((prev) => {
        if (prev) return prev; // don't override if admin already set an end date
        return addMonths(periodStart, durationMonths);
      });
    }
  };

  useEffect(() => {
    if (isPaid && !paymentDate) {
      setPaymentDate(new Date());
    }
  }, [isPaid]); // eslint-disable-line react-hooks/exhaustive-deps

  const toIso = (d: Date | null): string | null =>
    d ? d.toISOString().slice(0, 10) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scholarshipId) return;

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
          typeof amountForPeriod === "number" ? amountForPeriod : null, // ← matches DB
        currency: currency || "THB",
        period_start: toIso(periodStart),
        period_end: toIso(periodEnd),
        status: status || "planned",
        is_paid: isPaid,
        payment_date: isPaid ? toIso(paymentDate) : null,
        payment_note: paymentNote || null,
        notes: notes || null,
      };

      const { error: updateError } = await supabase
        .from("scholarship_awards")
        .update(payload)
        .eq("id", scholarshipId);

      if (updateError) {
        setError(toFriendlyError(updateError, "errors.save"));
        setSaving(false);
        return;
      }

      navigate("/admin/scholarships", { replace: true });
    } catch (err: unknown) {
      setError(toFriendlyError(err, "errors.save"));
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <FormPage title="Edit scholarship" subtitle="One grant, for one period, against one student.">
      <FormBody onSubmit={handleSubmit}>
        <FormError>{error}</FormError>

        <FormSection title="Grant">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
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
          </SimpleGrid>
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
              placeholder="8400"
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
            Save changes
          </Button>
        </FormFooter>
      </FormBody>
    </FormPage>
  );
};
