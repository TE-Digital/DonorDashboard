// src/modules/admin/AdminStudentsPage.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  Card,
  Stack,
  Table,
  Text,
  Group,
  Button,
  Anchor,
} from "@mantine/core";
import { Link } from "react-router-dom";
import {
  EmptyState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "../../design-system";

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
  birthdate: string | null;
  age_years: number | null;
  last_report_date: string | null;
  overdue: boolean;
};

export const AdminStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);

    // 1) load students (including birthdate)
    const { data: sData, error: sError } = await supabase
      .from("students")
      .select(
        "id, name, nickname, school_id, responsible_teacher_id, grade_level, village, scholarship, created_at, birthdate"
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
        birthdate: s.birthdate ?? null,
        age_years,
        last_report_date: lastReportDate,
        overdue,
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

  return (
    <Card p="lg" pos="relative">
      {loading && (
        <Group justify="center" mb="md">
          <LoadingState variant="inline" />
        </Group>
      )}

      <Stack gap="md">
        <PageHeader
          title="Students"
          subtitle="Overview of all registered students, their schools, teachers, and report status."
          actions={
            <>
              <Button
                variant="outline"
                size="xs"
                onClick={handleExport}
                loading={exporting}
              >
                Export CSV
              </Button>
              <Button component={Link} to="/admin/students/create" size="xs">
                Add student
              </Button>
            </>
          }
        />

        {!loading && students.length === 0 && (
          <EmptyState
            title="No students found."
            description="Start by adding a new student."
          />
        )}

        {!loading && students.length > 0 && (
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Student</Table.Th>
                <Table.Th>School</Table.Th>
                <Table.Th>Teacher</Table.Th>
                <Table.Th>Grade</Table.Th>
                <Table.Th>Village</Table.Th>
                <Table.Th>Scholarship</Table.Th>
                <Table.Th>Age</Table.Th>
                <Table.Th>Last report</Table.Th>
                <Table.Th>Reports</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {students.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>
                    <Anchor
                      component={Link}
                      to={`/admin/students/${s.id}`}
                      size="sm"
                    >
                      {s.name || "(no name)"}
                    </Anchor>
                    {s.nickname && (
                      <Text size="xs" c="dimmed">
                        Nickname: {s.nickname}
                      </Text>
                    )}
                  </Table.Td>

                  <Table.Td>
                    {s.school_id ? (
                      <Anchor
                        component={Link}
                        to={`/admin/schools/${s.school_id}`}
                        size="sm"
                      >
                        {s.school_name || "School"}
                      </Anchor>
                    ) : (
                      <Text size="xs" c="dimmed">
                        –
                      </Text>
                    )}
                  </Table.Td>

                  <Table.Td>
                    {s.responsible_teacher_id ? (
                      <Anchor
                        component={Link}
                        to={`/admin/teachers/${s.responsible_teacher_id}`}
                        size="sm"
                      >
                        {s.teacher_name || "Teacher"}
                      </Anchor>
                    ) : (
                      <Text size="xs" c="dimmed">
                        –
                      </Text>
                    )}
                  </Table.Td>

                  <Table.Td>{s.grade_level || "-"}</Table.Td>
                  <Table.Td>{s.village || "-"}</Table.Td>
                  <Table.Td>{s.scholarship || "-"}</Table.Td>
                  <Table.Td>{s.age_years != null ? s.age_years : "-"}</Table.Td>
                  <Table.Td>{s.last_report_date || "-"}</Table.Td>
                  <Table.Td>
                    <StatusBadge
                      kind="report"
                      value={s.overdue ? "overdue" : "ok"}
                      label={s.overdue ? "Overdue" : "OK"}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Card>
  );
};
