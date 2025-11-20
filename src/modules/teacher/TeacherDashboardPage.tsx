// src/modules/teacher/TeacherDashboardPage.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { SimpleGrid, Card, Text, Loader, Stack, Center } from "@mantine/core";

type ReportStatus = "ok" | "missing" | "overdue";

interface StudentRow {
  id: string;
  last_report_date?: string | null;
  report_status?: ReportStatus;
}

export const TeacherDashboardPage: React.FC = () => {
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    students: 0,
    scholarships: 0,
    missingReports: 0,
  });

  useEffect(() => {
    const load = async () => {
      if (!profile) return;
      setLoading(true);

      // 1) Load students + their term_updates (same logic as TeacherStudentsPage)
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
        console.error("Error loading students for teacher dashboard", error);
        setStats({ students: 0, scholarships: 0, missingReports: 0 });
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
            last_report_date: lastReport?.report_date ?? null,
          };
        }) ?? [];

      const studentIds = baseRows.map((r) => r.id);
      const studentCount = studentIds.length;

      if (studentIds.length === 0) {
        setStats({
          students: 0,
          scholarships: 0,
          missingReports: 0,
        });
        setLoading(false);
        return;
      }

      // 2) Load scholarships for these students (same filter as TeacherStudentsPage)
      const { data: scholarshipData, error: schError } = await supabase
        .from("scholarship_awards")
        .select("id, student_id, status, period_start, period_end")
        .in("student_id", studentIds);

      if (schError) {
        console.error(
          "Error loading scholarships for teacher dashboard",
          schError
        );
      }

      const today = new Date();
      const todayIso = today.toISOString().slice(0, 10);

      const activeScholarshipStudents = new Set<string>();
      let totalScholarships = 0;

      (scholarshipData ?? []).forEach((sch: any) => {
        totalScholarships += 1;
        if (
          sch.status === "active" &&
          sch.period_start <= todayIso &&
          sch.period_end >= todayIso
        ) {
          activeScholarshipStudents.add(sch.student_id);
        }
      });

      // 3) Determine overdue / missing reports
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoIso = sixMonthsAgo.toISOString().slice(0, 10);

      let missingReports = 0;

      baseRows.forEach((row) => {
        const hasActiveScholarship = activeScholarshipStudents.has(row.id);

        if (!hasActiveScholarship) {
          // Only students with an active scholarship are required to have reports
          return;
        }

        const last = row.last_report_date;

        if (!last) {
          // No report at all → missing
          missingReports += 1;
        } else if (last < sixMonthsAgoIso) {
          // Report older than 6 months → overdue
          missingReports += 1;
        }
      });

      setStats({
        students: studentCount,
        scholarships: totalScholarships,
        missingReports,
      });

      setLoading(false);
    };

    load();
  }, [profile]);

  if (loading) {
    return (
      <Center mih="60vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack>
      <Text fw={700} size="lg">
        Teacher dashboard
      </Text>

      <SimpleGrid cols={{ base: 2, sm: 3 }}>
        <StatCard label="My students" value={stats.students} />
        <StatCard label="Awarded scholarships" value={stats.scholarships} />
        <StatCard
          label="Students with overdue reports"
          value={stats.missingReports}
        />
      </SimpleGrid>
    </Stack>
  );
};

const StatCard: React.FC<{ label: string; value: number }> = ({
  label,
  value,
}) => (
  <Card withBorder radius="md" shadow="xs">
    <Text size="sm" c="dimmed">
      {label}
    </Text>
    <Text fw={700} size="xl">
      {value}
    </Text>
  </Card>
);

export default TeacherDashboardPage;

