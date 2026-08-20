// src/modules/admin/AdminStudentsPage.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Anchor, Group, Stack, Text } from "@mantine/core";
import { Link, useNavigate } from "react-router-dom";
import {
  ContactCell,
  LoadingState,
  PageHeader,
  StatusBadge,
  TableSection,
  type TableKpi,
} from "../../design-system";
import { Button, type DataColumn } from "../../design-system/lumen";
import { StudentFormDrawer } from "./StudentFormDrawer";
import styles from "./AdminDirectory.module.scss";

type StudentRow = {
  id: string;
  name: string | null;
  nickname: string | null;
  school_id: string | null;
  school_name: string | null;
  responsible_teacher_id: string | null; // profile id
  teacher_name: string | null;
  grade_level: string | null;
  village: string | null;
  scholarship: string | null;
  /** Who to call about this student, and on which number. From students.contact. */
  guardian_name: string | null;
  guardian_phone: string | null;
  birthdate: string | null;
  age_years: number | null;
  last_report_date: string | null;
  overdue: boolean;
  enrolled_on: string | null;
  monthly_support: number | null;
};
export const AdminStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [studentDrawerOpen, setStudentDrawerOpen] = useState(false);

  const load = async () => {
    setLoading(true);

    // 1) load students (including birthdate)
    const { data: sData, error: sError } = await supabase
      .from("students")
      .select(
        "id, name, nickname, school_id, responsible_teacher_id, grade_level, village, scholarship, created_at, birthdate, monthly_support_expected, contact"
      )
      .order("name", { ascending: true });

    if (sError) {
      console.error("Error loading students", sError);
      setLoading(false);
      return;
    }

    const studentsRaw = (sData ?? []) as any[];

    // collect ids for joins
    const schoolIds = Array.from(
      new Set(studentsRaw.map((s) => s.school_id).filter(Boolean))
    );
    const teacherProfileIds = Array.from(
      new Set(
        studentsRaw.map((s) => s.responsible_teacher_id).filter(Boolean)
      )
    );
    const studentIds = studentsRaw.map((s) => s.id);

    // 2) load schools, profiles and latest reports + scholarships
    const [
      { data: schoolRows, error: schoolError },
      { data: profileRows, error: profileError },
      { data: scholarshipRows, error: scholarshipError },
      { data: termUpdateRows, error: termUpdateError },
    ] = await Promise.all([
      schoolIds.length
        ? supabase.from("schools").select("id, name").in("id", schoolIds)
        : Promise.resolve({ data: [], error: null }),
      teacherProfileIds.length
        ? supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", teacherProfileIds)
        : Promise.resolve({ data: [], error: null }),
      studentIds.length
        ? supabase
            .from("scholarship_awards")
            .select("student_id, status, period_start, period_end")
            .in("student_id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      studentIds.length
        ? supabase
            .from("term_updates")
            .select("student_id, report_date")
            .in("student_id", studentIds)
            .order("report_date", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (schoolError) console.error("Error loading schools", schoolError);
    if (profileError)
      console.error("Error loading teacher profiles", profileError);
    if (scholarshipError)
      console.error("Error loading scholarships", scholarshipError);
    if (termUpdateError)
      console.error("Error loading latest reports", termUpdateError);

    // 3) index schools and teachers
    const schoolsById = new Map<string, string>();
    (schoolRows ?? []).forEach((s: any) => {
      schoolsById.set(s.id, s.name);
    });

    const profilesById = new Map<string, string>();
    (profileRows ?? []).forEach((p: any) => {
      profilesById.set(p.id, p.full_name);
    });

    // 4) compute "active now" scholarships per student
    //    Align with dashboard logic: status = 'active'
    //    and period_start/period_end include today.
    const activeScholarshipStudents = new Set<string>();
    const todayIso = new Date().toISOString().slice(0, 10);

    (scholarshipRows ?? []).forEach((aw: any) => {
      const periodStart: string | null = aw.period_start ?? null;
      const periodEnd: string | null = aw.period_end ?? null;

      const isActiveNow =
        aw.status === "active" &&
        (!periodStart || periodStart <= todayIso) &&
        (!periodEnd || periodEnd >= todayIso);

      if (isActiveNow) {
        activeScholarshipStudents.add(aw.student_id);
      }
    });

    // 5) latest report per student
    const latestReportMap = new Map<string, string>();
    (termUpdateRows ?? []).forEach((r: any) => {
      const current = latestReportMap.get(r.student_id);
      if (!current) {
        latestReportMap.set(r.student_id, r.report_date);
      }
    });

    // 6) now compute age and overdue flag
    const now = new Date();
    const sixMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 6,
      now.getDate()
    );

    const mapped: StudentRow[] = studentsRaw.map((s) => {
      // age
      let age_years: number | null = null;
      if (s.birthdate) {
        const dob = new Date(s.birthdate);
        if (!isNaN(dob.getTime())) {
          const diff =
            (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
          age_years = Math.floor(diff);
        }
      }

      // last report date
      const lastReportDate: string | null =
        latestReportMap.get(s.id) ?? null;

      // overdue?
      let overdue = false;
      if (activeScholarshipStudents.has(s.id)) {
        if (!lastReportDate) {
          overdue = true;
        } else {
          const last = new Date(lastReportDate);
          if (last < sixMonthsAgo) {
            overdue = true;
          }
        }
      }

      return {
        id: s.id,
        name: s.name ?? null,
        nickname: s.nickname ?? null,
        school_id: s.school_id ?? null,
        school_name: s.school_id ? schoolsById.get(s.school_id) ?? null : null,
        responsible_teacher_id: s.responsible_teacher_id ?? null,
        teacher_name: s.responsible_teacher_id
          ? profilesById.get(s.responsible_teacher_id) ?? null
          : null,
        grade_level: s.grade_level ?? null,
        village: s.village ?? null,
        scholarship: s.scholarship ?? null,
        guardian_name: s.contact?.guardian ?? null,
        guardian_phone: s.contact?.phone ?? null,
        birthdate: s.birthdate ?? null,
        age_years,
        last_report_date: lastReportDate,
        overdue,
        enrolled_on: s.created_at ?? null,
        monthly_support:
          s.monthly_support_expected != null ? Number(s.monthly_support_expected) : null,
      };
    });

    setStudents(mapped);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const header = [
        "Name",
        "Nickname",
        "School",
        "Teacher",
        "Grade level",
        "Village",
        "Scholarship",
        "Birthdate",
        "Age (years)",
        "Last report",
        "Overdue report?",
      ];
      const rows = students.map((s) => [
        s.name ?? "",
        s.nickname ?? "",
        s.school_name ?? "",
        s.teacher_name ?? "",
        s.grade_level ?? "",
        s.village ?? "",
        s.scholarship ?? "",
        s.birthdate ?? "",
        s.age_years != null ? String(s.age_years) : "",
        s.last_report_date ?? "",
        s.overdue ? "Yes" : "No",
      ]);

      const csvContent =
        [header, ...rows]
          .map((r) =>
            r
              .map((field) => `"${String(field).replace(/"/g, '""')}"`)
              .join(",")
          )
          .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "students_export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
    }
    setExporting(false);
  };

  const navigate = useNavigate();

  // Nothing here is stored as a metric; each one is derived from the rows the
  // page already loads.
  const kpis: TableKpi[] = React.useMemo(() => {
    const overdue = students.filter((s) => s.overdue).length;
    const schools = new Set(students.map((s) => s.school_id).filter(Boolean)).size;
    const withAge = students.filter((s) => s.age_years != null);
    const avgAge = withAge.length
      ? Math.round(withAge.reduce((sum, s) => sum + (s.age_years ?? 0), 0) / withAge.length)
      : null;

    return [
      { label: "Students", value: students.length, footnote: "on the register", mark: "students" },
      {
        label: "Reports overdue",
        value: overdue,
        footnote: overdue ? "need chasing" : "all up to date",
        mark: overdue ? "overdue" : "ontrack",
      },
      { label: "Schools represented", value: schools, footnote: "with a student", mark: "schools" },
      {
        label: "Average age",
        value: avgAge ?? "—",
        footnote: avgAge ? "years" : "no birthdates on file",
        mark: "average",
      },
    ];
  }, [students]);

  const columns: DataColumn<StudentRow & { id: string }>[] = [
    {
      key: "id",
      label: "Student ID",
      width: 120,
      muted: true,
      render: (s) => `ST-${s.id.slice(0, 6).toUpperCase()}`,
    },
    {
      key: "name",
      label: "Student",
      width: 200,
      render: (s) => (
        <div>
          <Anchor component={Link} to={`/admin/students/${s.id}`} size="sm">
            {s.name || "(no name)"}
          </Anchor>
          {s.nickname && (
            <Text size="xs" c="dimmed">
              Nickname: {s.nickname}
            </Text>
          )}
        </div>
      ),
    },
    {
      key: "school_name",
      label: "School",
      width: 170,
      render: (s) =>
        s.school_id ? (
          <Anchor component={Link} to={`/admin/schools/${s.school_id}`} size="sm">
            {s.school_name || "School"}
          </Anchor>
        ) : (
          "–"
        ),
    },
    {
      key: "teacher_name",
      label: "Teacher",
      width: 160,
      render: (s) =>
        s.responsible_teacher_id ? (
          <Anchor component={Link} to={`/admin/teachers/${s.responsible_teacher_id}`} size="sm">
            {s.teacher_name || "Teacher"}
          </Anchor>
        ) : (
          "–"
        ),
    },
    {
      // The guardian's number, one click from the clipboard. A teacher chasing
      // a missing report needs to dial it, not read it.
      key: "contact",
      label: "Contact",
      width: 90,
      sortable: false,
      filterable: false,
      render: (s) => (
        <ContactCell
          phone={s.guardian_phone}
          owner={s.guardian_name ? `${s.guardian_name} · ${s.name ?? ""}`.trim() : s.name}
          channels={["phone"]}
          labels={{ phone: "Copy guardian's phone number" }}
        />
      ),
    },
    { key: "grade_level", label: "Grade", width: 90 },
    { key: "village", label: "Village", width: 130 },
    { key: "scholarship", label: "Scholarship", width: 140 },
    { key: "age_years", label: "Age", align: "right", numeric: true, width: 80 },
    {
      key: "enrolled_on",
      label: "Enrolled",
      width: 120,
      muted: true,
      render: (s) =>
        s.enrolled_on ? new Date(s.enrolled_on).toLocaleDateString() : "—",
    },
    {
      key: "monthly_support",
      label: "Monthly support",
      width: 140,
      align: "right",
      numeric: true,
      render: (s) =>
        s.monthly_support != null ? s.monthly_support.toLocaleString() : "—",
    },
    { key: "last_report_date", label: "Last report", width: 120, muted: true },
    {
      key: "overdue",
      label: "Reports",
      width: 110,
      filterValue: (s) => (s.overdue ? "Overdue" : "OK"),
      render: (s) => (
        <StatusBadge
          kind="report"
          value={s.overdue ? "overdue" : "ok"}
          label={s.overdue ? "Overdue" : "OK"}
        />
      ),
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
        <StudentFormDrawer
          opened={studentDrawerOpen}
          onClose={() => setStudentDrawerOpen(false)}
          onCreated={(student) => {
            setStudentDrawerOpen(false);
            navigate(`/admin/students/${student.id}`);
          }}
        />

        <PageHeader
          title="Students"
          subtitle="Overview of all registered students, their schools, teachers, and report status."
          actions={
            <>
              <Button variant="secondary" icon="download" onClick={handleExport} disabled={exporting}>
                {exporting ? "Exporting…" : "Export CSV"}
              </Button>
              <Button variant="primary" icon="plus" onClick={() => setStudentDrawerOpen(true)}>
                Add student
              </Button>
            </>
          }
        />

        {!loading && (
          <TableSection
            kpis={kpis}
            columns={columns}
            rows={students}
            density="compact"
            pageSize={14}
            onRowClick={(s) => navigate(`/admin/students/${s.id}`)}
            emptyTitle="No students found"
            emptyDescription="Start by adding a new student."
            emptyIcon="users"
            emptyAction={
              <Button variant="secondary" icon="plus" onClick={() => setStudentDrawerOpen(true)}>
                Add student
              </Button>
            }
          />
        )}
      </Stack>
    </>
  );
};
