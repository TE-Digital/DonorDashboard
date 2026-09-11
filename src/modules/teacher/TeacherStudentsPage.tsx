// src/modules/teacher/TeacherStudentsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase, Student } from "../../lib/supabaseClient";
import { useEffectiveTeacherId } from "../viewAs/ViewAsContext";
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
import { useTranslation } from "react-i18next";
import {
  EmptyState,
  InlineMessage,
  LoadingState,
  PageHeader,
  color,
  emptyValue,
  formatDate,
} from "../../design-system";
import { toFriendlyError } from "../../i18n/errors";

type ReportStatus = "ok" | "missing" | "overdue";

interface StudentRow extends Student {
  school_name?: string | null;
  last_report_date?: string | null; // ISO date string
  report_status?: ReportStatus;
}

export const TeacherStudentsPage: React.FC = () => {
  const { t } = useTranslation();
  const teacherId = useEffectiveTeacherId();
  const [data, setData] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);

  const navigate = useNavigate();

  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  useEffect(() => {
    const load = async () => {
      if (!teacherId) return;
      setLoading(true);
      setLoadError(null);

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
        .eq("responsible_teacher_id", teacherId)
        // Archived students leave the working lists. Nothing about them is lost.
        .neq("status", "archived");

      if (error) {
        setLoadError(toFriendlyError(error, "errors.load", "Error loading teacher students"));
        setData([]);
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
            responsible_teacher_id: teacherId,
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
  }, [teacherId]);

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
        header: t("person.name"),
        accessorKey: "name",
        cell: (info) => (info.getValue() as string | null) || t("teacherPages.common.unnamed"),
      },
      {
        header: t("student.gradeLevel"),
        accessorKey: "grade_level",
        cell: (info) => (info.getValue() as string | null) || emptyValue(),
      },
      {
        header: t("report.lastReport"),
        accessorKey: "last_report_date",
        cell: ({ row }) => {
          const { label, color } = getLastReportLabel(row.original);
          return (
            <Text size="sm" c={color}>
              {label}
            </Text>
          );
        },
      },
      {
        id: "actions",
        header: t("teacherPages.students.actions"),
        cell: ({ row }) => {
          const name = row.original.name || t("teacherPages.common.unnamed");
          return (
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                aria-label={t("teacherPages.students.openFor", { name })}
                onClick={() => navigate(`/teacher/students/${row.original.id}`)}
              >
                {t("teacherPages.students.open")}
              </Button>
              <Button
                size="xs"
                variant="subtle"
                aria-label={t("teacherPages.students.addReportFor", { name })}
                onClick={() =>
                  navigate(`/teacher/reports/new?studentId=${row.original.id}`)
                }
              >
                {t("teacherPages.students.addReport")}
              </Button>
            </Group>
          );
        },
      },
    ],
    // getLastReportLabel only reads t, so t is the dependency that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, t]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // The last report as a teacher reads it: when, and whether one is owed now.
  function getLastReportLabel(row: StudentRow): { label: string; color?: string } {
    if (row.report_status === "missing") {
      return { label: t("teacherPages.students.reportNeeded"), color: "orange" };
    }
    const date = row.last_report_date ? formatDate(row.last_report_date) : t("report.none");
    if (row.report_status === "overdue") {
      return { label: t("teacherPages.students.reportOverdue", { date }), color: "red" };
    }
    return { label: date };
  }

  // Empty because nothing is assigned yet, or because the filters hide
  // everyone: two different things to tell the teacher.
  const empty =
    data.length === 0
      ? {
          title: t("teacherPages.students.emptyTitle"),
          description: t("teacherPages.students.emptyBody"),
        }
      : {
          title: t("teacherPages.students.noMatchTitle"),
          description: t("teacherPages.students.noMatchBody"),
        };
  const showEmpty = filteredData.length === 0 && !loadError;

  return (
    <Stack>
      <PageHeader title={t("nav.myStudents")} />

      {loadError && <InlineMessage tone="error">{loadError}</InlineMessage>}

      {/* Filters */}
      {isMobile ? (
        <Stack gap="xs">
          <TextInput
            size="sm"
            placeholder={t("teacherPages.students.searchPlaceholder")}
            aria-label={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
          <Select
            size="sm"
            placeholder={t("student.filterByGrade")}
            aria-label={t("student.filterByGrade")}
            value={gradeFilter}
            onChange={setGradeFilter}
            data={gradeOptions}
            clearable
          />
        </Stack>
      ) : (
        <Group gap="sm">
          <TextInput
            size="sm"
            placeholder={t("teacherPages.students.searchPlaceholder")}
            aria-label={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={260}
          />
          <Select
            size="sm"
            placeholder={t("student.filterByGrade")}
            aria-label={t("student.filterByGrade")}
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
          {showEmpty && <EmptyState title={empty.title} description={empty.description} />}

          {filteredData.map((row) => {
            const { label, color } = getLastReportLabel(row);
            const name = row.name || t("teacherPages.common.unnamed");

            return (
              <Card key={row.id} withBorder radius="md" shadow="xs">
                <Stack gap={4}>
                  <Text fw={600}>{name}</Text>
                  {row.grade_level && (
                    <Text size="sm" c="dimmed">
                      {t("teacherPages.common.classLabel", { grade: row.grade_level })}
                    </Text>
                  )}
                  <Text size="sm" c={color}>
                    {t("teacherPages.students.lastReportLine", { label })}
                  </Text>

                  <Group mt="xs" grow>
                    <Button variant="default"
                      size="xs"
                      aria-label={t("teacherPages.students.openFor", { name })}
                      onClick={() =>
                        navigate(`/teacher/students/${row.id}`)
                      }
                    >
                      {t("teacherPages.students.open")}
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      aria-label={t("teacherPages.students.addReportFor", { name })}
                      onClick={() =>
                        navigate(
                          `/teacher/reports/new?studentId=${row.id}`
                        )
                      }
                    >
                      {t("teacherPages.students.addReport")}
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
              {showEmpty && (
                <tr>
                  <td colSpan={columns.length} style={{ padding: "16px" }}>
                    <EmptyState title={empty.title} description={empty.description} />
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
