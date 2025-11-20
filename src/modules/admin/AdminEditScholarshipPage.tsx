// src/modules/admin/AdminEditScholarshipPage.tsx
import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

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

export const AdminEditScholarshipPage: React.FC = () => {
  const { scholarshipId } = useParams<{ scholarshipId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          setError("Scholarship not found.");
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
      } catch (err: any) {
        console.error("Error loading scholarship", err);
        setError("Could not load scholarship.");
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
    if (
      periodStart &&
      gt.default_duration_months &&
      gt.default_duration_months > 0
    ) {
      setPeriodEnd((prev) => {
        if (prev) return prev; // don't override if admin already set an end date
        return addMonths(periodStart, gt.default_duration_months);
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

    if (!grantTypeId) {
      setError("Please select a grant type.");
      return;
    }
    if (!periodStart || !periodEnd) {
      setError("Please choose both period start and end.");
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
        console.error("Update scholarship error", updateError);
        setError(updateError.message);
        setSaving(false);
        return;
      }

      navigate("/admin/scholarships", { replace: true });
    } catch (err: any) {
      console.error("Unexpected error updating scholarship", err);
      setError(err.message ?? "Unexpected error while updating scholarship.");
      setSaving(false);
    }
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <Stack>
      <Group justify="space-between" mb="sm">
        <Title order={3}>Edit scholarship</Title>
        <Button
          variant="subtle"
          size="xs"
          onClick={() => navigate("/admin/scholarships")}
        >
          Back to overview
        </Button>
      </Group>

      <Card withBorder component="form" onSubmit={handleSubmit}>
        <Stack gap="md">
          <Group align="flex-end">
            <div style={{ flex: 1 }}>
              <Select
                label="Grant type"
                placeholder="Select grant type"
                data={grantTypeOptions}
                value={grantTypeId}
                onChange={handleGrantTypeChange}
                required
                searchable
              />
            </div>
          </Group>

          <Group grow>
            <Select
              label="Student (optional)"
              placeholder="Select student"
              data={studentOptions}
              value={studentId}
              onChange={setStudentId}
              clearable
              searchable
            />
            <Select
              label="Donor (optional)"
              placeholder="Select donor"
              data={donorOptions}
              value={donorId}
              onChange={setDonorId}
              clearable
              searchable
            />
          </Group>

          <Group grow>
            <DateInput
              label="Period start"
              value={periodStart}
              onChange={setPeriodStart}
              required
            />
            <DateInput
              label="Period end"
              value={periodEnd}
              onChange={setPeriodEnd}
              required
            />
          </Group>

          <Group grow>
            <NumberInput
              label="Amount for scholarship period"
              value={amountForPeriod}
              onChange={(val) =>
                setAmountForPeriod(
                  typeof val === "number" ? val : undefined
                )
              }
              min={0}
              placeholder="e.g. 8400"
            />
            <TextInput
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.currentTarget.value)}
            />
          </Group>

          <Group grow>
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
            <Stack gap={4}>
              <Switch
                label="Paid"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.currentTarget.checked)}
              />
              <DateInput
                label="Payment date"
                value={paymentDate}
                onChange={setPaymentDate}
                disabled={!isPaid}
              />
            </Stack>
          </Group>

          <TextInput
            label="Payment note / reference"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.currentTarget.value)}
          />

          <Textarea
            label="Internal notes"
            minRows={3}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />

          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}

          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => navigate("/admin/scholarships")}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
};

