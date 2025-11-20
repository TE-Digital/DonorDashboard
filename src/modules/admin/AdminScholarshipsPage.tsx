import React, { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

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
        setScholarships((data ?? []) as ScholarshipRow[]);
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

  const renderStatusBadge = (status: string | null | undefined) => {
    if (!status) {
      return (
        <Badge size="xs" variant="light" color="gray">
          —
        </Badge>
      );
    }

    const s = status.toLowerCase();
    let color: string = "gray";

    if (s === "active") color = "green";
    else if (s === "planned") color = "yellow";
    else if (s === "completed") color = "blue";
    else if (s === "cancelled") color = "red";

    return (
      <Badge size="xs" variant="light" color={color}>
        {status}
      </Badge>
    );
  };

  const renderPaidBadge = (isPaid: boolean | null | undefined) => {
    if (isPaid) {
      return (
        <Badge size="xs" color="green" variant="light">
          Paid
        </Badge>
      );
    }
    return (
      <Badge size="xs" color="red" variant="light">
        Not paid
      </Badge>
    );
  };

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

  if (loading) return <Loader />;

  return (
    <Stack>
      <Group justify="space-between" mb="sm">
        <Text fw={600} size="lg">
          Scholarships
        </Text>
        <Group gap="xs">
          <Button
            variant="outline"
            size="xs"
            onClick={handleExport}
          >
            Export to Excel
          </Button>
          <Button
            size="xs"
            onClick={() => navigate("/admin/scholarships/new")}
          >
            Add scholarship
          </Button>
        </Group>
      </Group>

      <Card withBorder>
        <Stack gap="sm">
          <Group grow>
            <TextInput
		label="Search"
              placeholder="Search by student, donor, grant type…"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            <Select
              label="Status"
              placeholder="All"
              data={statusOptions}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
            />
            <Select
              label="Year"
              placeholder="All"
              data={yearOptions}
              value={year}
              onChange={setYear}
              clearable
            />
          </Group>

          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}

          {filtered.length === 0 ? (
            <Text size="sm" c="dimmed">
              No scholarships found.
            </Text>
          ) : (
            <Table
              striped
              highlightOnHover
              horizontalSpacing="md"
              verticalSpacing="xs"
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Student</Table.Th>
                  <Table.Th>Donor</Table.Th>
                  <Table.Th>Grant type</Table.Th>
                  <Table.Th>Period</Table.Th>
                  <Table.Th>Amount (period)</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Payment</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((row) => {
                  const studentName =
                    row.students?.name || "Unassigned";
                  const donorName =
                    row.donors?.name || "Unassigned";
                  const grantName =
                    row.grant_types?.name || "—";

                  const periodLabel =
                    row.period_start && row.period_end
                      ? `${new Date(
                          row.period_start
                        ).toLocaleDateString()} – ${new Date(
                          row.period_end
                        ).toLocaleDateString()}`
                      : "—";

                  const amountLabel =
                    row.amount_for_period != null
                      ? `${row.amount_for_period.toLocaleString(
                          "en-US",
                          {
                            maximumFractionDigits: 0,
                          }
                        )} ${row.currency || "THB"}`
                      : "—";

                  const paymentLabel = row.payment_date
                    ? new Date(
                        row.payment_date
                      ).toLocaleDateString()
                    : "—";

                  return (
                    <Table.Tr key={row.id}>
                      <Table.Td>
                        <Text size="sm">{studentName}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{donorName}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{grantName}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{periodLabel}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{amountLabel}</Text>
                      </Table.Td>
                      <Table.Td>{renderStatusBadge(row.status)}</Table.Td>
                      <Table.Td>
                        <Stack gap={2}>
                          {renderPaidBadge(row.is_paid)}
                          <Text size="xs" c="dimmed">
                            {paymentLabel}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() =>
                            navigate(
                              `/admin/scholarships/${row.id}/edit`
                            )
                          }
                        >
                          Edit
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>
    </Stack>
  );
};

