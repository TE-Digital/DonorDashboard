// src/modules/admin/AdminReportsBetaPage.tsx
//
// Every report the teachers have sent in, as one list.
//
// The existing "Field reports" screen is a query builder: pick a table, pick
// columns, get rows. It answers questions about the database. It does not
// answer the question an administrator actually opens the product with —
// what has come in, from whom, about which child, and does it need me?
//
// This screen is that list and nothing else. One row per report, with the
// student it is about, the teacher responsible for that student, the school,
// the term it covers and where it is in review. It is marked beta because the
// review actions still live on the report itself; this is the way in.

import React, { useEffect, useMemo, useState } from "react";
import { Group, Select, Stack, Text } from "@mantine/core";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { InlineMessage, LoadingState, PageHeader, TableSection, type TableKpi } from "../../design-system";
import { Badge, Button, type DataColumn } from "../../design-system/lumen";
import { supabase } from "../../lib/supabaseClient";
import {
  REPORT_COLUMNS,
  REPORT_STATE_META,
  REPORT_STATE_RANK,
  type ReportCycleState,
  type ReportRecord,
  type ReportStatus,
} from "../reports";
import styles from "./AdminDirectory.module.scss";

type ReportRow = {
  id: string;
  student_id: string | null;
  student_name: string;
  teacher_id: string | null;
  teacher_name: string;
  school_id: string | null;
  school_name: string;
  report_date: string | null;
  covers: string;
  grade: string;
  status: ReportStatus;
  /** Set while a donor's question on this report is unanswered. */
  flagged: boolean;
  /** The donor-facing sentence, trimmed to a line so the row stays one line. */
  summary: string;
};

const asDate = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(value),
      )
    : "—";

const shortDate = (value: string | null): string =>
  value ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(value)) : "";

export const AdminReportsBetaPage: React.FC = () => {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * The status filter is part of the address.
   *
   * The dashboard counts reports awaiting verification and links here with
   * ?status=submitted. Keeping the filter in the URL means that link survives a
   * reload, and that the count on the front page and the rows on this one are
   * demonstrably the same set.
   */
  const statusFilter = searchParams.get("status") ?? "all";

  const setStatusFilter = (next: string) => {
    setSearchParams(
      (params) => {
        if (next === "all") params.delete("status");
        else params.set("status", next);
        return params;
      },
      { replace: true },
    );
  };

  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setLoadError(null);

    const reportResult = await supabase
      .from("term_updates")
      .select(REPORT_COLUMNS)
      .order("report_date", { ascending: false })
      .limit(500);

    if (reportResult.error) {
      console.error("Error loading reports", reportResult.error);
      setLoadError("The reports could not be loaded. Check your connection and try again.");
      setRows([]);
      setLoading(false);
      return;
    }

    const reports = (reportResult.data ?? []) as unknown as ReportRecord[];
    const studentIds = Array.from(
      new Set(reports.map((report) => report.student_id).filter(Boolean)),
    ) as string[];

    const studentResult = studentIds.length
      ? await supabase
          .from("students")
          .select("id, name, school_id, responsible_teacher_id")
          .in("id", studentIds)
      : { data: [] as any[] };

    const students = (studentResult.data ?? []) as any[];
    const schoolIds = Array.from(new Set(students.map((s) => s.school_id).filter(Boolean))) as string[];
    const teacherIds = Array.from(
      new Set(students.map((s) => s.responsible_teacher_id).filter(Boolean)),
    ) as string[];

    const [schoolResult, teacherResult] = await Promise.all([
      schoolIds.length
        ? supabase.from("schools").select("id, name").in("id", schoolIds)
        : Promise.resolve({ data: [] as any[] }),
      teacherIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", teacherIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    // Flags live behind the funding migration, and REPORT_COLUMNS cannot name
    // them: PostgREST rejects a select that mentions a column the database does
    // not have, which would take the whole reports table down on a deploy where
    // the code has landed and the migration has not. So they are read
    // separately, and their absence simply means no report is flagged.
    const flagRead = await supabase
      .from("term_updates")
      .select("id, flagged_at, flag_resolved_at")
      .in("id", reports.map((report) => report.id));

    const flaggedIds = new Set<string>(
      flagRead.error
        ? []
        : (flagRead.data ?? [])
            .filter((row: any) => row.flagged_at && !row.flag_resolved_at)
            .map((row: any) => row.id),
    );

    const studentById = new Map(students.map((s) => [s.id, s]));
    const schoolById = new Map(((schoolResult.data ?? []) as any[]).map((s) => [s.id, s.name]));
    const teacherById = new Map(((teacherResult.data ?? []) as any[]).map((t) => [t.id, t.full_name]));

    setRows(
      reports.map((report) => {
        const student = report.student_id ? studentById.get(report.student_id) : null;
        const covers = [shortDate(report.covers_start), shortDate(report.covers_end)]
          .filter(Boolean)
          .join(" – ");

        return {
          id: report.id,
          student_id: report.student_id,
          student_name: student?.name || "Unknown student",
          teacher_id: student?.responsible_teacher_id ?? null,
          teacher_name: student?.responsible_teacher_id
            ? teacherById.get(student.responsible_teacher_id) || "Unnamed teacher"
            : "No teacher assigned",
          school_id: student?.school_id ?? null,
          school_name: student?.school_id ? schoolById.get(student.school_id) || "School" : "—",
          report_date: report.report_date,
          covers: covers || "—",
          grade: report.grade || report.grade_text || (report.grade_numeric != null ? String(report.grade_numeric) : "") || "—",
          status: (report.status ?? "submitted") as ReportStatus,
          flagged: flaggedIds.has(report.id),
          summary: (report.donor_comment || report.info || "").replace(/\s+/g, " ").trim(),
        };
      }),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    if (statusFilter === "all") return rows;
    // "Flagged" is not one of the stored statuses — it is a donor waiting on an
    // answer, which can be true of a report in any state — so it filters on its
    // own column rather than on status.
    if (statusFilter === "flagged") return rows.filter((row) => row.flagged);
    return rows.filter((row) => row.status === statusFilter);
  }, [rows, statusFilter]);

  // What is waiting on somebody, not how many rows exist.
  const kpis: TableKpi[] = useMemo(() => {
    const count = (status: ReportStatus) => rows.filter((row) => row.status === status).length;
    const waiting = count("submitted") + count("under_review");

    return [
      { label: "Reports received", value: rows.length, footnote: "all time", accent: "blue" },
      { label: "Waiting on us", value: waiting, footnote: "submitted or in review", accent: "amber" },
      {
        label: "Back with the teacher",
        value: count("changes_requested"),
        footnote: "changes requested",
        accent: "orange",
      },
      { label: "Approved", value: count("approved"), footnote: "sent to the donor", accent: "green" },
    ];
  }, [rows]);

  const columns: DataColumn<ReportRow>[] = [
    {
      key: "student_name",
      label: "Student",
      width: 200,
      pin: "left",
      render: (row) =>
        row.student_id ? (
          <Link className={styles.recordLink} to={`/admin/students/${row.student_id}`}>
            {row.student_name}
          </Link>
        ) : (
          row.student_name
        ),
    },
    {
      key: "teacher_name",
      label: "Teacher",
      width: 180,
      render: (row) =>
        row.teacher_id ? (
          <Link className={styles.recordLink} to={`/admin/teachers/${row.teacher_id}`}>
            {row.teacher_name}
          </Link>
        ) : (
          <Text size="sm" c="dimmed">
            {row.teacher_name}
          </Text>
        ),
    },
    {
      key: "school_name",
      label: "School",
      width: 180,
      render: (row) =>
        row.school_id ? (
          <Link className={styles.recordLink} to={`/admin/schools/${row.school_id}`}>
            {row.school_name}
          </Link>
        ) : (
          row.school_name
        ),
    },
    { key: "report_date", label: "Report date", width: 130, muted: true, render: (row) => asDate(row.report_date) },
    { key: "covers", label: "Covers", width: 150, muted: true },
    { key: "grade", label: "Grade", width: 90 },
    {
      key: "summary",
      label: "What the donor reads",
      width: 320,
      muted: true,
      render: (row) => (row.summary ? row.summary : "—"),
    },
    {
      key: "status",
      label: "Status",
      width: 160,
      pin: "right",
      align: "right",
      filterValue: (row) => REPORT_STATE_META[row.status as ReportCycleState].label,
      render: (row) => {
        // A flag outranks the stored status in the cell as well as in the
        // sort: the report may be approved and still have somebody waiting.
        const meta = row.flagged
          ? REPORT_STATE_META.flagged
          : REPORT_STATE_META[row.status as ReportCycleState];
        return (
          <span title={meta.hint}>
            <Badge tone={meta.tone} dot>
              {meta.label}
            </Badge>
          </span>
        );
      },
    },
  ];

  return (
    <>
      {loading && (
        <Group justify="center" mb="md">
          <LoadingState variant="inline" />
        </Group>
      )}

      <Stack gap="md" className={styles.page}>
        <PageHeader
          title="Reports beta"
          subtitle="Everything the teachers have sent in, newest first — who it is about, who wrote it, and whether it still needs you."
          actions={
            <Button variant="primary" icon="plus" onClick={() => navigate("/admin/reports/new")}>
              Add report
            </Button>
          }
        />

        {loadError && <InlineMessage tone="error">{loadError}</InlineMessage>}

        {!loading && (
          <TableSection
            kpis={kpis}
            columns={columns}
            rows={visible}
            density="compact"
            pageSize={25}
            controls={
              <Select
                label={undefined}
                aria-label="Which reports to show"
                allowDeselect={false}
                w={200}
                data={[
                  { value: "all", label: "All statuses" },
                  { value: "flagged", label: "Flagged by a donor" },
                  ...[...Object.keys(REPORT_STATE_META)]
                    .filter((state) =>
                      ["draft", "submitted", "under_review", "changes_requested", "approved"].includes(state),
                    )
                    .sort(
                      (a, b) =>
                        REPORT_STATE_RANK[a as ReportCycleState] - REPORT_STATE_RANK[b as ReportCycleState],
                    )
                    .map((state) => ({
                      value: state,
                      label: REPORT_STATE_META[state as ReportCycleState].label,
                    })),
                ]}
                value={statusFilter}
                onChange={(value) => value && setStatusFilter(value)}
              />
            }
            // A report that has been submitted goes to verification, not to
            // the edit form: the next act on it is deciding whether it is fit
            // to send, and that decision has its own screen.
            onRowClick={(row) =>
              navigate(
                ["submitted", "under_review", "approved"].includes(row.status)
                  ? `/admin/reports/${row.id}/verify`
                  : `/admin/reports/${row.id}/edit`,
              )
            }
            emptyTitle="No reports yet"
            emptyDescription="Reports written by teachers appear here as soon as they are saved."
          />
        )}
      </Stack>
    </>
  );
};

export default AdminReportsBetaPage;
