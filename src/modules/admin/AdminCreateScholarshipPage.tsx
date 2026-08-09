// src/modules/admin/AdminCreateScholarshipPage.tsx
import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  Group,
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
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { LoadingState, PageHeader } from "../../design-system";

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

export const AdminCreateScholarshipPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const prefillStudentId = searchParams.get("studentId");
  const prefillDonorId = searchParams.get("donorId");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err: any) {
        console.error("Error loading scholarship options", err);
        setError("Could not load reference data.");
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
        console.error("Insert scholarship error", insertError);
        setError(insertError.message);
        setSaving(false);
        return;
      }

      navigate("/admin/scholarships", { replace: true });
    } catch (err: any) {
      console.error("Unexpected error creating scholarship", err);
      setError(err.message ?? "Unexpected error while creating scholarship.");
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <Stack>
      <PageHeader
        title="Add scholarship"
        actions={
          <Button
              variant="subtle"
              size="xs"
              onClick={() => navigate("/admin/scholarships")}
            >
              Back to overview
            </Button>
        }
      />

      <Card withBorder component="form" onSubmit={handleSubmit}>
        <Stack gap="md">
          {/* Grant type + quick add button */}
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
            <Button
              size="xs"
              variant="light"
              onClick={() =>
                navigate(
                  `/admin/grant-types/new?returnTo=${encodeURIComponent(
                    "/admin/scholarships/new"
                  )}`
                )
              }
              style={{ marginBottom: 2 }}
            >
              Add grant type
            </Button>
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
              placeholder="e.g. 8400, 150000"
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
              Save scholarship
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
};

