import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  MultiSelect,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { supabase } from "../../lib/supabaseClient";
import { Link } from "react-router-dom";
import { EmptyState, LoadingState, PageHeader, StatusBadge } from "../../design-system";
import styles from "./AdminDirectory.module.scss";

type ColumnType = "text" | "number" | "date" | "boolean";

type ColumnDef = {
  name: string;
  label: string;
  type: ColumnType;
};

type TableDef = {
  value: string;
  label: string;
  columns: ColumnDef[];
};

// 🔹 Tables & columns that can be used for generic reporting.
//    Add/adjust columns here as your schema evolves.
const TABLE_DEFS: TableDef[] = [
  {
    value: "students",
    label: "Students",
    columns: [
      { name: "id", label: "ID", type: "text" },
      { name: "name", label: "Name", type: "text" },
      { name: "nickname", label: "Nickname", type: "text" },
      { name: "school_id", label: "School (id)", type: "text" },
      { name: "grade_level", label: "Grade level", type: "text" },
      { name: "village", label: "Village", type: "text" },
      { name: "scholarship", label: "Scholarship", type: "text" },
      { name: "birthdate", label: "Birthdate", type: "date" },
      {
        name: "monthly_support_expected",
        label: "Monthly support expected",
        type: "number",
      },
      {
        name: "responsible_teacher_id",
        label: "Responsible teacher (id)",
        type: "text",
      },
      { name: "created_at", label: "Created at", type: "date" },
    ],
  },
  {
    value: "term_updates",
    label: "Term updates / reports",
    columns: [
      { name: "id", label: "ID", type: "text" },
      { name: "student_id", label: "Student (id)", type: "text" },
      { name: "report_date", label: "Report date", type: "date" },
      { name: "covers_start", label: "Covers from", type: "date" },
      { name: "covers_end", label: "Covers to", type: "date" },
      { name: "grade", label: "Grade label", type: "text" },
      { name: "grade_numeric", label: "Grade numeric", type: "number" },
      { name: "grade_text", label: "Grade text", type: "text" },
      { name: "donor_comment", label: "Donor comment", type: "text" },
      { name: "info", label: "Additional info", type: "text" },
      { name: "created_at", label: "Created at", type: "date" },
    ],
  },
  {
    value: "scholarship_awards",
    label: "Scholarship awards",
    columns: [
      { name: "id", label: "ID", type: "text" },
      { name: "student_id", label: "Student (id)", type: "text" },
      { name: "donor_id", label: "Donor (id)", type: "text" },
      { name: "grant_type_id", label: "Grant type (id)", type: "text" },
      { name: "period_start", label: "Period start", type: "date" },
      { name: "period_end", label: "Period end", type: "date" },
      {
        name: "amount_for_period",
        label: "Amount for period",
        type: "number",
      },
      { name: "currency", label: "Currency", type: "text" },
      { name: "status", label: "Status", type: "text" },
      { name: "is_paid", label: "Is paid?", type: "boolean" },
      { name: "payment_date", label: "Payment date", type: "date" },
      { name: "created_at", label: "Created at", type: "date" },
    ],
  },
  {
    value: "donors",
    label: "Donors",
    columns: [
      { name: "id", label: "ID", type: "text" },
      { name: "user_id", label: "User ID", type: "text" },
      { name: "name", label: "Name", type: "text" },
      { name: "contact->>email", label: "Email", type: "text" },
      { name: "contact->>phone", label: "Phone", type: "text" },
      { name: "contact->>address", label: "Address", type: "text" },
      { name: "contact->>other_contact", label: "Other contact", type: "text" },
      { name: "contact->>agent_id", label: "Agent ID", type: "text" },
      { name: "is_dashboard_enabled", label: "Dashboard enabled", type: "boolean" },
      { name: "wants_email_updates", label: "Wants email updates", type: "boolean" },
      { name: "wants_newsletter", label: "Wants newsletter", type: "boolean" },
      { name: "preferred_language", label: "Preferred language", type: "text" },
      { name: "note_internal", label: "Internal note", type: "text" },
      { name: "invited_at", label: "Invited at", type: "date" },
      { name: "invited_email", label: "Invited email", type: "text" },
      { name: "created_at", label: "Created at", type: "date" },
    ],
  },
  {
    value: "schools",
    label: "Schools",
    columns: [
      { name: "id", label: "ID", type: "text" },
      { name: "name", label: "Name", type: "text" },
      { name: "address", label: "Address", type: "text" },
      { name: "created_at", label: "Created at", type: "date" },
    ],
  },
  {
    value: "profiles",
    label: "Users/Profiles",
    columns: [
      { name: "id", label: "ID", type: "text" },
      { name: "full_name", label: "Full name", type: "text" },
      { name: "email", label: "Email", type: "text" },
      { name: "phone", label: "Phone", type: "text" },
      { name: "created_at", label: "Created at", type: "date" },
    ],
  },
  {
    value: "grant_types",
    label: "Grant Types",
    columns: [
      { name: "id", label: "ID", type: "text" },
      { name: "name", label: "Name", type: "text" },
      { name: "description", label: "Description", type: "text" },
      { name: "amount_per_period", label: "Amount per period", type: "number" },
      { name: "currency", label: "Currency", type: "text" },
      { name: "default_duration_months", label: "Default duration (months)", type: "number" },
      { name: "created_at", label: "Created at", type: "date" },
    ],
  },
];

// 🔹 Relation mapping to show nicer labels instead of raw IDs in results.
//    Example: students.school_id -> schools.name
const RELATIONS: Record<
  string,
  Record<
    string,
    {
      table: string;
      displayColumn: string;
      linkBase?: string; // optional route prefix for clickable links
    }
  >
> = {
  students: {
    school_id: {
      table: "schools",
      displayColumn: "name",
      linkBase: "/admin/schools/",
    },
    responsible_teacher_id: {
      table: "profiles",
      displayColumn: "full_name",
      linkBase: "/admin/teachers/",
    },
  },
  scholarship_awards: {
    student_id: {
      table: "students",
      displayColumn: "name",
      linkBase: "/admin/students/",
    },
    donor_id: {
      table: "donors",
      displayColumn: "name",
      linkBase: "/admin/donors/",
    },
    grant_type_id: {
      table: "grant_types",
      displayColumn: "name",
    },
  },
  term_updates: {
    student_id: {
      table: "students",
      displayColumn: "name",
      linkBase: "/admin/students/",
    },
  },
  donors: {
    user_id: {
      table: "profiles",
      displayColumn: "full_name",
    },
    "contact->>agent_id": {
      table: "agents",
      displayColumn: "name",
    },
  },
};

type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "in";

const OPERATOR_OPTIONS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "≠" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "contains", label: "contains" },
  { value: "in", label: "in list" },
];

type FilterRow = {
  id: string;
  column: string | null;
  operator: FilterOperator;
  value: string;
};

type GenericRow = Record<string, any>;

export const AdminReportsPage: React.FC = () => {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<GenericRow[]>([]);
  const [count, setCount] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const tableDef = useMemo(
    () => TABLE_DEFS.find((t) => t.value === selectedTable) || null,
    [selectedTable]
  );

  // Reset columns & filters when table changes
  useEffect(() => {
    if (!tableDef) {
      setSelectedColumns([]);
      setFilters([]);
      setRows([]);
      setCount(null);
      setPage(1);
      setSortColumn(null);
      setSortDirection('asc');
      return;
    }

    // Default: preselect a few common columns
    const defaultCols = tableDef.columns.slice(0, 4).map((c) => c.name);
    setSelectedColumns(defaultCols);
    setFilters([]);
    setRows([]);
    setCount(null);
    setPage(1);
    setSortColumn(null);
    setSortDirection('asc');
  }, [tableDef?.value]);

  const handleAddFilter = () => {
    if (!tableDef) return;
    const firstCol = tableDef.columns[0]?.name ?? null;
    setFilters((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        column: firstCol,
        operator: "eq",
        value: "",
      },
    ]);
  };

  const handleRemoveFilter = (id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  const handleFilterChange = (
    id: string,
    field: keyof Omit<FilterRow, "id">,
    value: any
  ) => {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  const parseValueByType = (raw: string, type: ColumnType) => {
    if (raw === "") return null;

    switch (type) {
      case "number":
        return Number(raw);
      case "boolean":
        return raw.toLowerCase() === "true" || raw === "1";
      case "date":
        // keep as ISO-ish string; backend will parse
        return raw;
      default:
        return raw;
    }
  };

  const runQuery = useCallback(async () => {
    if (!tableDef || !selectedTable) return;

    setLoading(true);

    try {
      // Build base query
      const columnsToSelect =
        selectedColumns.length > 0
          ? selectedColumns.join(",")
          : tableDef.columns.map((c) => c.name).join(",");

      let query = supabase
        .from(selectedTable)
        .select(columnsToSelect, { count: "exact" });

      // Apply filters
      for (const f of filters) {
        if (!f.column || f.value.trim() === "") continue;

        const colDef =
          tableDef.columns.find((c) => c.name === f.column) ??
          ({ type: "text" } as ColumnDef);

        if (f.operator === "contains") {
          query = query.ilike(f.column, `%${f.value}%`);
        } else if (f.operator === "in") {
          const rawParts = f.value
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
          const parsed = rawParts.map((p) => parseValueByType(p, colDef.type));
          if (parsed.length > 0) {
            query = query.in(f.column, parsed as any[]);
          }
        } else {
          const parsed = parseValueByType(f.value, colDef.type);
          if (parsed === null) continue;

          switch (f.operator) {
            case "eq":
              query = query.eq(f.column, parsed);
              break;
            case "neq":
              query = query.neq(f.column, parsed);
              break;
            case "gt":
              query = query.gt(f.column, parsed);
              break;
            case "gte":
              query = query.gte(f.column, parsed);
              break;
            case "lt":
              query = query.lt(f.column, parsed);
              break;
            case "lte":
              query = query.lte(f.column, parsed);
              break;
          }
        }
      }

      // Apply sorting
      if (sortColumn) {
        query = query.order(sortColumn, { ascending: sortDirection === 'asc' });
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count: newCount } = await query;

      if (error) {
        console.error("Error running report query", error);
        setRows([]);
        setCount(null);
        return;
      }

      const rawRows = (data ?? []) as GenericRow[];

      // Resolve relation fields (IDs -> names)
      const relConfig = RELATIONS[selectedTable] || {};
      const relFields = Object.keys(relConfig).filter((field) =>
        selectedColumns.includes(field)
      );

      const relationMaps: Record<string, Record<string, any>> = {};

      if (relFields.length > 0 && rawRows.length > 0) {
        const relQueries = relFields.map(async (field) => {
          const cfg = relConfig[field];
          const ids = Array.from(
            new Set(
              rawRows
                .map((r) => r[field])
                .filter((v) => v !== null && v !== undefined)
            )
          );
          if (ids.length === 0) {
            relationMaps[field] = {};
            return;
          }

          const { data: relRows, error: relError } = await supabase
            .from(cfg.table)
            .select(`id, ${cfg.displayColumn}`)
            .in("id", ids);

          if (relError) {
            console.error("Error loading relation data", field, relError);
            relationMaps[field] = {};
            return;
          }

          const map: Record<string, any> = {};
          (relRows ?? []).forEach((r: any) => {
            map[r.id] = r[cfg.displayColumn];
          });
          relationMaps[field] = map;
        });

        await Promise.all(relQueries);
      }

      const processedRows = rawRows.map((row) => {
        const newRow: GenericRow = { ...row };

        for (const field of relFields) {
          const original = row[field];
          if (
            original != null &&
            relationMaps[field] &&
            relationMaps[field][original]
          ) {
            newRow[field] = relationMaps[field][original];
          }
        }
        return newRow;
      });

      setRows(processedRows);
      setCount(newCount ?? null);
    } catch (err) {
      console.error("Unexpected error running report", err);
      setRows([]);
      setCount(null);
    } finally {
      setLoading(false);
    }
  }, [tableDef, selectedTable, selectedColumns, filters, page, pageSize]);

  const handleExportCsv = () => {
    if (!rows.length || !tableDef) return;

    const colsToUse =
      selectedColumns.length > 0 ? selectedColumns : tableDef.columns.map((c) => c.name);

    const header = colsToUse;
    const csvRows = rows.map((r) =>
      colsToUse.map((c) => {
        const v = r[c];
        if (v === null || v === undefined) return "";
        return String(v).replace(/"/g, '""');
      })
    );

    const csvContent =
      [header, ...csvRows]
        .map((r) => r.map((f) => `"${f}"`).join(","))
        .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTable ?? "report"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages =
    count != null && pageSize > 0
      ? Math.max(1, Math.ceil(count / pageSize))
      : 1;

  const currentColumns =
    selectedColumns.length > 0
      ? selectedColumns
      : tableDef?.columns.map((c) => c.name) ?? [];

  return (
    <>
      <Stack gap="md" className={styles.page}>
        <PageHeader
          title="Reports"
          subtitle="Review student progress reports by source, period, school, and submission status."
          actions={
            <Button
              variant="outline"
              size="xs"
              onClick={handleExportCsv}
              disabled={!rows.length}
            >
              Export CSV
            </Button>
          }
        />

        <div className={styles.reportHint}>
          Start with <strong>Term updates / reports</strong>, then select report date, student,
          coverage period, grade, and comments. Add date filters to create a mid-year or year-end
          workspace, and export the resulting review list when it is ready.
        </div>

        {/* Table & configuration */}
        <Card>
          <Stack gap="md">
            <Group align="flex-end" grow>
              <Select
                label="Data source"
                placeholder="Select a table"
                value={selectedTable}
                onChange={(value) => {
                  setSelectedTable(value);
                  setPage(1);
                }}
                data={TABLE_DEFS.map((t) => ({
                  value: t.value,
                  label: t.label,
                }))}
              />

              <NumberInput
                label="Rows per page"
                min={10}
                max={500}
                step={10}
                value={pageSize}
                onChange={(val) => {
                  const v = typeof val === "number" ? val : 50;
                  setPageSize(v);
                  setPage(1);
                }}
              />
            </Group>

            {tableDef && (
              <>
                <MultiSelect
                  label="Columns"
                  data={tableDef.columns.map((c) => ({
                    value: c.name,
                    label: c.label,
                  }))}
                  value={selectedColumns}
                  onChange={setSelectedColumns}
                  searchable
                  clearable
                  placeholder="All columns"
                />

                <Stack gap="xs">
                  <Group justify="space-between" align="center">
                    <Text fw={500} size="sm">
                      Filters
                    </Text>
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={handleAddFilter}
                    >
                      Add filter
                    </Button>
                  </Group>

                  {filters.length === 0 && (
                    <Text size="xs" c="dimmed">
                      No filters added. All rows from the selected table will be
                      shown.
                    </Text>
                  )}

                  {filters.map((f) => (
                    <Group key={f.id} gap="xs" align="flex-end">
                      <Select
                        label="Column"
                        style={{ flex: 1 }}
                        data={tableDef.columns.map((c) => ({
                          value: c.name,
                          label: c.label,
                        }))}
                        value={f.column}
                        onChange={(value) =>
                          handleFilterChange(f.id, "column", value)
                        }
                      />
                      <Select
                        label="Op"
                        style={{ width: 120 }}
                        data={OPERATOR_OPTIONS}
                        value={f.operator}
                        onChange={(value) =>
                          handleFilterChange(
                            f.id,
                            "operator",
                            (value || "eq") as FilterOperator
                          )
                        }
                      />
                      <TextInput
                        label="Value"
                        style={{ flex: 2 }}
                        placeholder="Filter value"
                        value={f.value}
                        onChange={(e) =>
                          handleFilterChange(f.id, "value", e.currentTarget.value)
                        }
                      />
                      <Button
                        variant="subtle"
                        color="red"
                        size="xs"
                        onClick={() => handleRemoveFilter(f.id)}
                      >
                        Remove
                      </Button>
                    </Group>
                  ))}
                </Stack>

                <Group justify="flex-end">
                  <Button variant="default"
                    onClick={() => {
                      setPage(1);
                      runQuery();
                    }}
                    loading={loading}
                    disabled={!selectedTable}
                  >
                    Run report
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        </Card>

        {/* Results */}
        <Card>
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={500}>Results</Text>
              <Group gap="xs" align="center">
                {count != null && (
                  <Text size="xs" c="dimmed">
                    {count} rows total
                  </Text>
                )}
                <Group gap="4" align="center">
                  <Button
                    size="xs"
                    variant="subtle"
                    disabled={page <= 1 || loading}
                    onClick={() => {
                      setPage((p) => Math.max(1, p - 1));
                      // runQuery will be triggered manually
                    }}
                  >
                    Previous
                  </Button>
                  <Text size="xs">
                    Page {page} / {totalPages}
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    disabled={page >= totalPages || loading}
                    onClick={() => {
                      setPage((p) => Math.min(totalPages, p + 1));
                    }}
                  >
                    Next
                  </Button>
                </Group>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={runQuery}
                  disabled={!selectedTable}
                  loading={loading}
                >
                  Refresh
                </Button>
              </Group>
            </Group>

            {loading && (
              <Group justify="center" mt="md">
                <LoadingState variant="inline" />
              </Group>
            )}

            {!loading && (!rows || rows.length === 0) && (
              <EmptyState
                title="No data to display yet."
                description="Configure a report above and click Run report."
              />
            )}

            {!loading && rows.length > 0 && (
              <ScrollArea w="100%">
                <Table
                  striped
                  highlightOnHover
                  withTableBorder
                  withColumnBorders
                  horizontalSpacing="xs"
                  verticalSpacing="xs"
                >
                  <Table.Thead>
                    <Table.Tr>
                      {currentColumns.map((c) => {
                        const colDef = tableDef?.columns.find(
                          (col) => col.name === c
                        );
                        const isSorted = sortColumn === c;
                        return (
                          <Table.Th key={c}>
                            <Button
                              variant="subtle"
                              size="xs"
                              fullWidth
                              justify="left"
                              rightSection={
                                isSorted ? (
                                  sortDirection === 'asc' ? '↑' : '↓'
                                ) : null
                              }
                              onClick={() => {
                                if (sortColumn === c) {
                                  setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setSortColumn(c);
                                  setSortDirection('asc');
                                }
                                setPage(1);
                                runQuery();
                              }}
                            >
                              {colDef?.label ?? c}
                            </Button>
                          </Table.Th>
                        );
                      })}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((row, idx) => (
                      <Table.Tr key={idx}>
                        {currentColumns.map((c) => {
                          const value = row[c];
                          const relCfg =
                            selectedTable && RELATIONS[selectedTable]?.[c];

                          // clickable link if we have a linkBase and the original id is present somewhere
                          if (relCfg && value != null) {
                            // this assumes the id and label are aligned; for generic use we just link by row[c] is label,
                            // but in many cases ID will also be available as another selected column if needed.
                            const linkBase = relCfg.linkBase;
                            return (
                              <Table.Td key={c}>
                                {linkBase ? (
                                  <Anchor
                                    component={Link}
                                    to={`${linkBase}${row.id ?? ""}`}
                                    size="sm"
                                  >
                                    {String(value)}
                                  </Anchor>
                                ) : (
                                  <Text size="sm">{String(value)}</Text>
                                )}
                              </Table.Td>
                            );
                          }

                          if (typeof value === "boolean") {
                            return (
                              <Table.Td key={c}>
                                <StatusBadge kind="boolean" value={value} />
                              </Table.Td>
                            );
                          }

                          return (
                            <Table.Td key={c}>
                              <Text size="sm">
                                {value === null || value === undefined
                                  ? "–"
                                  : String(value)}
                              </Text>
                            </Table.Td>
                          );
                        })}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Stack>
        </Card>
      </Stack>
    </>
  );
};

export default AdminReportsPage;
