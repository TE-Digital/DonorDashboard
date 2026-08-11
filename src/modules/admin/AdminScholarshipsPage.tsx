import React, { useEffect, useState } from "react";
import { Select, Stack, Text } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { asRows } from "../../lib/supabaseRelations";
import {
  InlineMessage,
  LoadingState,
  PageHeader,
  StatusBadge,
  TableSection,
  type TableKpi,
} from "../../design-system";
import { Button as LumenButton, type DataColumn } from "../../design-system/lumen";

type RelatedName = {
  id: string;
  name: string | null;
} | null;

type ScholarshipRow = {
  id: string;
  period_start: string | null;
  period_end: string | null;
  amount_for_period: number | null; // <- matches DB column
  currency: string | null;
  status: string | null;
  is_paid: boolean | null;
  payment_date: string | null;
  grant_types: RelatedName;
  students: RelatedName;
  donors: RelatedName;
};

const statusOptions = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const AdminScholarshipsPage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [scholarships, setScholarships] = useState<ScholarshipRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("scholarship_awards")
        .select(
          `
          id,
          period_start,
          period_end,
          amount_for_period,
          currency,
          status,
          is_paid,
          payment_date,
          grant_types ( id, name ),
          students ( id, name ),
          donors ( id, name )
        `
        )
        .order("period_start", { ascending: false });

      if (error) {
        console.error("Error loading scholarships", error);
        setError("Could not load scholarships.");
        setScholarships([]);
      } else {
        setScholarships(asRows<ScholarshipRow>(data));
      }

      setLoading(false);
    };

    load();
  }, []);

  const normalize = (s: string | null | undefined) =>
    (s ?? "").toLowerCase();

  const filtered = scholarships.filter((row) => {
    const term = search.toLowerCase();

    if (statusFilter && (row.status ?? "") !== statusFilter) {
      return false;
    }

    if (year) {
      const y = parseInt(year, 10);
      const startYear = row.period_start
        ? new Date(row.period_start).getFullYear()
        : null;
      const endYear = row.period_end
        ? new Date(row.period_end).getFullYear()
        : null;

      if (startYear !== y && endYear !== y) {
        return false;
      }
    }

    if (!term) return true;

    const gtName = normalize(row.grant_types?.name);
    const studentName = normalize(row.students?.name);
    const donorName = normalize(row.donors?.name);

    return (
      gtName.includes(term) ||
      studentName.includes(term) ||
      donorName.includes(term)
    );
  });

  const yearOptions = React.useMemo(() => {
    const years = new Set<number>();
    scholarships.forEach((row) => {
      if (row.period_start) {
        years.add(new Date(row.period_start).getFullYear());
      }
      if (row.period_end) {
        years.add(new Date(row.period_end).getFullYear());
      }
    });
    return Array.from(years)
      .sort((a, b) => b - a)
      .map((y) => ({ value: String(y), label: String(y) }));
  }, [scholarships]);

  const renderStatusBadge = (status: string | null | undefined) => (
    <StatusBadge kind="scholarship" value={status} size="xs" />
  );

  const renderPaidBadge = (isPaid: boolean | null | undefined) => (
    <StatusBadge kind="payment" value={isPaid ? "paid" : "unpaid"} size="xs" />
  );

  const handleExport = () => {
    const rowsToExport = filtered;

    if (rowsToExport.length === 0) {
      alert("No scholarships to export for the current filter.");
      return;
    }

    const header = [
      "Student",
      "Donor",
      "GrantType",
      "PeriodStart",
      "PeriodEnd",
      "AmountForPeriod",
      "Currency",
      "Status",
      "IsPaid",
      "PaymentDate",
    ];

    const csvRows = rowsToExport.map((row) => {
      const studentName = row.students?.name ?? "";
      const donorName = row.donors?.name ?? "";
      const grantName = row.grant_types?.name ?? "";
      const periodStart = row.period_start ?? "";
      const periodEnd = row.period_end ?? "";
      const amount =
        row.amount_for_period != null
          ? String(row.amount_for_period)
          : "";
      const currency = row.currency ?? "";
      const status = row.status ?? "";
      const isPaid = row.is_paid ? "Yes" : "No";
      const paymentDate = row.payment_date ?? "";

      const cells = [
        studentName,
        donorName,
        grantName,
        periodStart,
        periodEnd,
        amount,
        currency,
        status,
        isPaid,
        paymentDate,
      ];

      // basic CSV escaping
      return cells
        .map((value) => {
          const v = value.replace(/"/g, '""');
          return `"${v}"`;
        })
        .join(",");
    });

    const csvContent = [header.join(","), ...csvRows].join("\r\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-");

    link.href = url;
    link.setAttribute(
      "download",
      `scholarships-export-${timestamp}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingState />;

  // Flat, sortable projection of the joined rows. TableSection owns search and
  // per-column filtering from here.
  const tableRows = filtered.map((row) => ({
    id: row.id,
    student: row.students?.name || "Unassigned",
    donor: row.donors?.name || "Unassigned",
    grant: row.grant_types?.name || "—",
    period:
      row.period_start && row.period_end
        ? `${new Date(row.period_start).toLocaleDateString()} – ${new Date(
            row.period_end
          ).toLocaleDateString()}`
        : "—",
    amount: row.amount_for_period ?? null,
    currency: row.currency || "THB",
    status: row.status ?? null,
    is_paid: row.is_paid ?? null,
    payment: row.payment_date ? new Date(row.payment_date).toLocaleDateString() : "—",
  }));

  const kpis: TableKpi[] = (() => {
    const total = tableRows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
    const paid = tableRows.filter((r) => r.is_paid).length;
    const active = tableRows.filter((r) => r.status === "active").length;
    const currency = tableRows[0]?.currency ?? "THB";
    return [
      { label: "Scholarships", value: tableRows.length, footnote: "in this view", accent: "blue" },
      {
        label: "Committed",
        value: total.toLocaleString("en-US", { maximumFractionDigits: 0 }),
        footnote: currency,
        accent: "teal",
      },
      { label: "Active now", value: active, footnote: "running this period", accent: "amber" },
      {
        label: "Paid",
        value: paid,
        footnote: `${tableRows.length - paid} awaiting payment`,
        accent: "plum",
      },
    ];
  })();

  const columns: DataColumn<(typeof tableRows)[number]>[] = [
    { key: "student", label: "Student", width: 180 },
    { key: "donor", label: "Donor", width: 180 },
    { key: "grant", label: "Grant type", width: 160 },
    { key: "period", label: "Period", width: 190, muted: true },
    {
      key: "amount",
      label: "Amount (period)",
      align: "right",
      numeric: true,
      width: 150,
      render: (r) =>
        r.amount != null
          ? `${r.amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${r.currency}`
          : "—",
    },
    {
      key: "status",
      label: "Status",
      width: 120,
      filterValue: (r) => r.status ?? "—",
      render: (r) => renderStatusBadge(r.status),
    },
    {
      key: "is_paid",
      label: "Payment",
      width: 140,
      filterValue: (r) => (r.is_paid ? "Paid" : "Not paid"),
      render: (r) => (
        <Stack gap={2}>
          {renderPaidBadge(r.is_paid)}
          <Text size="xs" c="dimmed">
            {r.payment}
          </Text>
        </Stack>
      ),
    },
  ];

  if (loading) return <LoadingState />;

  return (
    <Stack>
      <PageHeader
        title="Scholarships"
        subtitle="Every award, who funds it, and whether it has been paid."
      />

      <InlineMessage tone="error">{error}</InlineMessage>

      <TableSection
        kpis={kpis}
        columns={columns}
        rows={tableRows}
        searchKeys={["student", "donor", "grant"]}
        onRowClick={(r) => navigate(`/admin/scholarships/${r.id}/edit`)}
        controls={
          <>
            <Select
              placeholder="All statuses"
              data={statusOptions}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              w={160}
            />
            <Select
              placeholder="All years"
              data={yearOptions}
              value={year}
              onChange={setYear}
              clearable
              w={130}
            />
          </>
        }
        emptyTitle="No scholarships found"
        emptyDescription="Add a scholarship to start tracking an award."
        emptyIcon="hand-coins"
        emptyAction={
          <LumenButton
            variant="secondary"
            icon="plus"
            onClick={() => navigate("/admin/scholarships/new")}
          >
            Add scholarship
          </LumenButton>
        }
        actions={
          <>
            <LumenButton variant="secondary" icon="download" onClick={handleExport}>
              Export to Excel
            </LumenButton>
            <LumenButton
              variant="primary"
              icon="plus"
              onClick={() => navigate("/admin/scholarships/new")}
            >
              Add scholarship
            </LumenButton>
          </>
        }
      />
    </Stack>
  );
};

export default AdminScholarshipsPage;
