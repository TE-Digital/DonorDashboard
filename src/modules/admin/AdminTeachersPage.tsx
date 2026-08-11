// src/modules/admin/AdminTeachersPage.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Anchor, Stack, Text } from "@mantine/core";
import { Link, useNavigate } from "react-router-dom";
import { LoadingState, PageHeader, TableSection, type TableKpi } from "../../design-system";
import { Badge, type DataColumn } from "../../design-system/lumen";

interface TeacherRow {
  id: string; // profiles.id (user id)
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  studentCount: number;
  overdueCount: number;
}

export const AdminTeachersPage: React.FC = () => {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // 1) Load all profiles (users)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, created_at");

      if (profilesError) {
        console.error("Error loading profiles", profilesError);
        setLoading(false);
        return;
      }

      // 2) Load all roles
      const { data: roles, error: rolesError } = await supabase
        .from("person_roles")
        .select("user_id, role");

      if (rolesError) {
        console.error("Error loading roles", rolesError);
        setLoading(false);
        return;
      }

      // 3) Filter for teacher role (profiles.id)
      const teacherIds = new Set(
        (roles ?? [])
          .filter((r: any) => r.role === "teacher")
          .map((r: any) => r.user_id as string)
      );

      const teacherProfiles: TeacherRow[] = (profiles ?? [])
        .filter((p: any) => teacherIds.has(p.id as string))
        .map((p: any) => ({
          id: p.id as string,
          full_name: p.full_name,
          email: p.email,
          phone: p.phone,
          created_at: p.created_at,
          studentCount: 0,
          overdueCount: 0,
        }));

      if (teacherProfiles.length === 0) {
        setTeachers([]);
        setLoading(false);
        return;
      }

      const teacherUserIds = teacherProfiles.map((t) => t.id);

      // 4) Load all students supervised by these teachers,
      //    including their term updates (for last_report_date)
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select(
          `
          id,
          responsible_teacher_id,
          term_updates ( report_date )
        `
        )
        .in("responsible_teacher_id", teacherUserIds);

      if (studentsError) {
        console.error("Error loading students for teachers", studentsError);
        setTeachers(teacherProfiles);
        setLoading(false);
        return;
      }

      const students = (studentsData ?? []) as any[];

      const studentIds = students.map((s) => s.id as string);

      // 5) Load scholarships for these students to detect active scholarships
      let activeScholarshipStudents = new Set<string>();

      if (studentIds.length > 0) {
        const { data: scholarshipData, error: schError } = await supabase
          .from("scholarship_awards")
          .select("id, student_id, status, period_start, period_end")
          .in("student_id", studentIds);

        if (schError) {
          console.error(
            "Error loading scholarships for teacher students",
            schError
          );
        } else {
          const today = new Date();
          const todayIso = today.toISOString().slice(0, 10);

          activeScholarshipStudents = new Set<string>();
          (scholarshipData ?? []).forEach((sch: any) => {
            if (
              sch.status === "active" &&
              sch.period_start <= todayIso &&
              sch.period_end >= todayIso
            ) {
              activeScholarshipStudents.add(sch.student_id);
            }
          });
        }
      }

      // 6) Determine overdue status per student
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoIso = sixMonthsAgo.toISOString().slice(0, 10);

      const studentCountByTeacher = new Map<string, number>();
      const overdueCountByTeacher = new Map<string, number>();

      students.forEach((s) => {
        const teacherId = s.responsible_teacher_id as string;
        const studentId = s.id as string;

        // count all students per teacher
        studentCountByTeacher.set(
          teacherId,
          (studentCountByTeacher.get(teacherId) ?? 0) + 1
        );

        const hasActiveScholarship =
          activeScholarshipStudents.has(studentId);

        if (!hasActiveScholarship) {
          // Only students with an active scholarship are eligible for overdue logic
          return;
        }

        // compute last_report_date from term_updates
        let lastReportDate: string | null = null;
        const updates = s.term_updates ?? [];
        if (updates.length > 0) {
          const sorted = [...updates].sort(
            (a, b) =>
              new Date(b.report_date).getTime() -
              new Date(a.report_date).getTime()
          );
          lastReportDate = sorted[0].report_date;
        }

        let isOverdue = false;

        // No report at all -> overdue
        if (!lastReportDate) {
          isOverdue = true;
        } else if (lastReportDate < sixMonthsAgoIso) {
          // Last report older than 6 months -> overdue
          isOverdue = true;
        }

        if (isOverdue) {
          overdueCountByTeacher.set(
            teacherId,
            (overdueCountByTeacher.get(teacherId) ?? 0) + 1
          );
        }
      });

      const enriched = teacherProfiles.map((t) => ({
        ...t,
        studentCount: studentCountByTeacher.get(t.id) ?? 0,
        overdueCount: overdueCountByTeacher.get(t.id) ?? 0,
      }));

      setTeachers(enriched);
      setLoading(false);
    };

    load();
  }, []);

  const navigate = useNavigate();

  // Derived on the page: caseload and report health per teacher, rolled up.
  const kpis: TableKpi[] = React.useMemo(() => {
    const students = teachers.reduce((sum, t) => sum + t.studentCount, 0);
    const overdue = teachers.reduce((sum, t) => sum + t.overdueCount, 0);
    const withOverdue = teachers.filter((t) => t.overdueCount > 0).length;
    const avg = teachers.length ? Math.round((students / teachers.length) * 10) / 10 : 0;

    return [
      { label: "Teachers", value: teachers.length, footnote: "with an account", accent: "blue" },
      { label: "Students covered", value: students, footnote: "assigned in total", accent: "teal" },
      {
        label: "Teachers with overdue",
        value: withOverdue,
        footnote: `${overdue} reports outstanding`,
        accent: withOverdue ? "amber" : "teal",
      },
      { label: "Average caseload", value: avg, footnote: "students per teacher", accent: "plum" },
    ];
  }, [teachers]);

  const columns: DataColumn<TeacherRow>[] = [
    {
      key: "full_name",
      label: "Name",
      width: 200,
      render: (t) => (
        <Anchor component={Link} to={`/admin/teachers/${t.id}/students`}>
          {t.full_name || "(no name)"}
        </Anchor>
      ),
    },
    {
      key: "email",
      label: "Email",
      width: 230,
      render: (t) =>
        t.email ? (
          <Anchor href={`mailto:${t.email}`}>{t.email}</Anchor>
        ) : (
          <Text c="dimmed" size="sm">
            no email
          </Text>
        ),
    },
    { key: "phone", label: "Phone", width: 140, render: (t) => t.phone || "—" },
    {
      key: "created_at",
      label: "Created",
      width: 120,
      muted: true,
      render: (t) => (t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"),
    },
    { key: "studentCount", label: "Students", align: "right", numeric: true, width: 100 },
    {
      key: "overdueCount",
      label: "Overdue students",
      align: "right",
      numeric: true,
      width: 150,
      render: (t) =>
        t.overdueCount > 0 ? (
          <Badge tone="danger" dot>
            {t.overdueCount}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            0
          </Text>
        ),
    },
  ];

  if (loading) return <LoadingState />;

  return (
    <Stack>
      <PageHeader title="Teachers" subtitle="Caseload and report health for every teacher." />

      <TableSection
        kpis={kpis}
        columns={columns}
        rows={teachers}
        searchKeys={["full_name", "email", "phone"]}
        onRowClick={(t) => navigate(`/admin/teachers/${t.id}/students`)}
        emptyTitle="No teachers found"
        emptyDescription="Teachers appear here once they have an account."
        emptyIcon="users"
      />
    </Stack>
  );
};


export default AdminTeachersPage;
