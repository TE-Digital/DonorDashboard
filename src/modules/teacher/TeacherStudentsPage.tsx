// src/modules/teacher/TeacherStudentsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase, Student } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  Box,
  Button,
  Card,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
  useMantineTheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useNavigate } from "react-router-dom";
import { EmptyState, LoadingState, PageHeader, color } from "../../design-system";

type ReportStatus = "ok" | "missing" | "overdue";

interface StudentRow extends Student {
  school_name?: string | null;
  last_report_date?: string | null; // ISO date string
  report_status?: ReportStatus;
}

export const TeacherStudentsPage: React.FC = () => {
  const { profile } = useAuth();
  const [data, setData] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);

  const navigate = useNavigate();

  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  useEffect(() => {
    const load = async () => {
      if (!profile) return;
      setLoading(true);

      // 1) Load students + their term_updates
      const { data: studentData, error } = await supabase
        .from("students")
        .select(
          `
          id,
          name,
          school_id,
          grade_level,
          village,
          monthly_support_expected,
          created_at,
          grant_type_id,
          birthdate,
          bio,
          schools(name),
          term_updates ( report_date )
        `
        )
        .eq("responsible_teacher_id", profile.id);

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const baseRows: StudentRow[] =
        studentData?.map((s: any) => {
          const lastReport = s.term_updates?.length
            ? [...s.term_updates].sort(
                (a, b) =>
                  new Date(b.report_date).getTime() -
                  new Date(a.report_date).getTime()
              )[0]
            : null;

          return {
            id: s.id,
            name: s.name,
            school_id: s.school_id,
            scholarship: s.scholarship,
            responsible_teacher_id: profile.id,
            created_at: s.created_at,
            grant_type_id: s.grant_type_id,
            birthdate: s.birthdate,
            grade_level: s.grade_level,
            village: s.village,
            bio: s.bio,
            monthly_support_expected: s.monthly_support_expected,
            school_name: s.schools?.name ?? null,
            last_report_date: lastReport?.report_date ?? null,
          };
        }) ?? [];

      const studentIds = baseRows.map((r) => r.id);
      if (studentIds.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // 2) Load scholarships for these students to determine active ones
      const { data: scholarshipData, error: schError } = await supabase
        .from("scholarship_awards")
        .select("id, student_id, status, period_start, period_end")
        .in("student_id", studentIds);

      if (schError) {
        console.error(
          "Error loading scholarships for teacher students",
          schError
        );
      }

      const todayIso = new Date().toISOString().slice(0, 10);

      const activeScholarshipStudents = new Set<string>();
      (scholarshipData ?? []).forEach((sch: any) => {
        if (
          sch.status === "active" &&
          sch.period_start <= todayIso &&
          sch.period_end >= todayIso
        ) {
          activeScholarshipStudents.add(sch.student_id);
        }
      });

      // 3) Determine report status for each student
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoIso = sixMonthsAgo.toISOString().slice(0, 10);

      const enrichedRows: StudentRow[] = baseRows.map((row) => {
        const hasActiveScholarship = activeScholarshipStudents.has(row.id);
        let report_status: ReportStatus = "ok";

        if (hasActiveScholarship) {
          if (!row.last_report_date) {
            report_status = "missing";
          } else if (row.last_report_date < sixMonthsAgoIso) {
            report_status = "overdue";
          }
        }

        return { ...row, report_status };
      });

      setData(enrichedRows);
      setLoading(false);
    };

    load();
  }, [profile]);

  // --- Dynamic grade filter options based on real data ---
  const gradeOptions = useMemo(() => {
    const set = new Set<string>();
    data.forEach((row) => {
      if (row.grade_level) {
        set.add(row.grade_level);
      }
    });
    return Array.from(set)
      .sort()
      .map((g) => ({ value: g, label: g }));
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      const term = search.toLowerCase();

      const matchesSearch =
        !term ||
        row.name.toLowerCase().includes(term) ||
        (row.village ?? "").toLowerCase().includes(term);

      const matchesGrade =
        !gradeFilter || row.grade_level === gradeFilter;

      return matchesSearch && matchesGrade;
    });
  }, [data, search, gradeFilter]);

  // ---------- Table columns (desktop only) ----------
  const columns = useMemo<ColumnDef<StudentRow>[]>(
    () => [
      {
        header: "Name",
        accessorKey: "name",
        cell: (info) => info.getValue() || "—",
      },
      {
        header: "Grade",
        accessorKey: "grade_level",
        cell: (info) => info.getValue() || "—",
      },
      {
        header: "Last report",
        accessorKey: "last_report_date",
        cell: ({ row }) => {
          const last = row.original.last_report_date;
          const status = row.original.report_status;
          let label: string;

          if (!last) {
            label = "No report";
          } else {
            label = new Date(last).toLocaleDateString();
          }

          if (status === "overdue") {
            label += " (overdue)";
          } else if (status === "missing") {
            label += " (required)";
          }

          let color: string | undefined;
          if (status === "overdue") color = "red";
          else if (status === "missing") color = "orange";

          return (
            <Text size="sm" c={color}>
              {label}
            </Text>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              onClick={() => navigate(`/teacher/students/${row.original.id}`)}
            >
              Open
            </Button>
            <Button
              size="xs"
              variant="subtle"
              onClick={() =>
                navigate(`/teacher/reports/new?studentId=${row.original.id}`)
              }
            >
              Add report
            </Button>
          </Group>
        ),
      },
    ],
    [navigate]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Helper to format last-report label for cards
  const getLastReportLabel = (row: StudentRow) => {
    const last = row.last_report_date;
    const status = row.report_status;

    let label = last
      ? new Date(last).toLocaleDateString()
      : "No report";

    if (status === "overdue") label += " (overdue)";
    else if (status === "missing") label += " (required)";

    let color: string | undefined;
    if (status === "overdue") color = "red";
    else if (status === "missing") color = "orange";

    return { label, color };
  };

  return (
    <Stack>
      <PageHeader title="My students" />

      {/* Filters */}
      {isMobile ? (
        <Stack gap="xs">
          <TextInput
            placeholder="Search by name or village"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
          <Select
            placeholder="Filter by grade level"
            value={gradeFilter}
            onChange={setGradeFilter}
            data={gradeOptions}
            clearable
          />
        </Stack>
      ) : (
        <Group gap="sm">
          <TextInput
            placeholder="Search by name or village"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={260}
          />
          <Select
            placeholder="Filter by grade level"
            value={gradeFilter}
            onChange={setGradeFilter}
            data={gradeOptions}
            clearable
          />
        </Group>
      )}

      {loading ? (
        <LoadingState variant="inline" />
      ) : isMobile ? (
        // ---------- MOBILE: cards ----------
        <Stack gap="sm">
          {filteredData.length === 0 && (
            <EmptyState title="No students found." />
          )}

          {filteredData.map((row) => {
            const { label, color } = getLastReportLabel(row);

            return (
              <Card key={row.id} withBorder radius="md" shadow="xs">
                <Stack gap={4}>
                  <Text fw={600}>{row.name || "Unnamed student"}</Text>
                  {row.grade_level && (
                    <Text size="sm" c="dimmed">
                      Grade {row.grade_level}
                    </Text>
                  )}
                  <Text size="sm" c={color}>
                    Last report: {label}
                  </Text>

                  <Group mt="xs" grow>
                    <Button variant="default"
                      size="xs"
                      onClick={() =>
                        navigate(`/teacher/students/${row.id}`)
                      }
                    >
                      Open
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        navigate(
                          `/teacher/reports/new?studentId=${row.id}`
                        )
                      }
                    >
                      Add report
                    </Button>
                  </Group>
                </Stack>
              </Card>
            );
          })}
        </Stack>
      ) : (
        // ---------- DESKTOP: table ----------
        <Box
          style={{
            border: `1px solid ${color.border.subtle}`,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ backgroundColor: "var(--mantine-color-gray-0)" }}>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        cursor: header.column.getCanSort()
                          ? "pointer"
                          : "default",
                      }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <Group gap={4} wrap="nowrap">
                        <span>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </span>
                        {{
                          asc: "↑",
                          desc: "↓",
                        }[
                          header.column.getIsSorted() as "asc" | "desc"
                        ] ?? null}
                      </Group>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const status = (row.original as StudentRow).report_status;
                let bg: string | undefined;
                if (status === "missing") {
                  bg = "var(--mantine-color-yellow-0)";
                } else if (status === "overdue") {
                  bg = "var(--mantine-color-red-0)";
                }

                return (
                  <tr key={row.id} style={{ backgroundColor: bg }}>
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{
                          padding: "8px 12px",
                          borderTop: `1px solid ${color.border.subtle}`,
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={columns.length} style={{ padding: "16px" }}>
                    <Text c="dimmed" size="sm">
                      No students found.
                    </Text>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Box>
      )}
    </Stack>
  );
};

export default TeacherStudentsPage;
