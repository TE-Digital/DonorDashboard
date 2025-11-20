// src/modules/admin/AdminDashboardPage.tsx
import React, { useEffect, useState } from "react";
import {
  SimpleGrid,
  Card,
  Text,
  Group,
  Loader,
  Stack,
  Center,
  Button,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { HeroSection } from "../../components/HeroSection";

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    schools: 0,
    donors: 0,
    scholarships_total: 0,
    scholarships_active: 0,
    overdue_reports: 0,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const todayIso = new Date().toISOString().slice(0, 10);

      // Base counts
      const [
        studentsRes,
        schoolsRes,
        donorsRes,
        teachersRes,
        totalSchRes,
        activeSchRes,
      ] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("schools").select("id", { count: "exact", head: true }),
        supabase.from("donors").select("id", { count: "exact", head: true }),
        supabase
          .from("person_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "teacher"),
        supabase
          .from("scholarship_awards")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("scholarship_awards")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .lte("period_start", todayIso)
          .gte("period_end", todayIso),
      ]);

      // ---- OVERDUE REPORT CALCULATION ----
      // 1. Load all students (admin sees global state)
      const { data: allStudents } = await supabase
        .from("students")
        .select("id");

      const allStudentIds = allStudents?.map((s) => s.id) ?? [];

      // 2. Load ALL active scholarships
      const { data: activeSchRows } = await supabase
        .from("scholarship_awards")
        .select("student_id, status, period_start, period_end")
        .eq("status", "active")
        .lte("period_start", todayIso)
        .gte("period_end", todayIso);

      const activeStudentIds = new Set(
        (activeSchRows ?? []).map((s) => s.student_id)
      );

      // 3. Load latest reports (term_updates)
      const { data: termUpdates } = await supabase
        .from("term_updates")
        .select("student_id, report_date")
        .in("student_id", allStudentIds)
        .order("report_date", { ascending: false });

      // Build a map: student_id → latest report_date
      const latestReportMap = new Map<string, string>();
      (termUpdates ?? []).forEach((r) => {
        if (!latestReportMap.has(r.student_id)) {
          latestReportMap.set(r.student_id, r.report_date);
        }
      });

      // 4. Evaluate overdue
      let overdue = 0;
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoIso = sixMonthsAgo.toISOString().slice(0, 10);

      allStudentIds.forEach((id) => {
        if (!activeStudentIds.has(id)) return; // only students with active scholarships

        const lastReport = latestReportMap.get(id);

        if (!lastReport) {
          overdue++;
          return;
        }

        if (lastReport < sixMonthsAgoIso) {
          overdue++;
        }
      });

      setStats({
        students: studentsRes.count ?? 0,
        teachers: teachersRes.count ?? 0,
        schools: schoolsRes.count ?? 0,
        donors: donorsRes.count ?? 0,
        scholarships_total: totalSchRes.count ?? 0,
        scholarships_active: activeSchRes.count ?? 0,
        overdue_reports: overdue,
      });

      setLoading(false);
    };

    load();
  }, []);

  if (loading)
    return (
      <Center mih="60vh">
        <Loader />
      </Center>
    );

  return (
    <Stack>
      <HeroSection />

      <Group justify="space-between" mt="xs" align="center">
        <Text fw={700} size="lg">
          Dashboard Overview
        </Text>

        {/* Quick actions */}
        <Group gap="xs">
          <Button size="xs" onClick={() => navigate("/admin/students/new")}>
            Add student
          </Button>
          <Button size="xs" onClick={() => navigate("/admin/scholarships/new")}>
            Add scholarship
          </Button>
          <Button size="xs" onClick={() => navigate("/admin/donors/new")}>
            Add donor
          </Button>
          <Button size="xs" variant="outline" onClick={() => navigate("/admin/teachers")}>
            View teachers
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xs">
        <StatCard label="Students" value={stats.students} />
        <StatCard label="Teachers" value={stats.teachers} />
        <StatCard label="Schools" value={stats.schools} />
        <StatCard label="Donors" value={stats.donors} />
        <StatCard label="Active scholarships" value={stats.scholarships_active} />
        <StatCard label="Total scholarships" value={stats.scholarships_total} />
        <StatCard label="Overdue reports" value={stats.overdue_reports} />
      </SimpleGrid>
    </Stack>
  );
};

const StatCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <Card shadow="xs" radius="md" withBorder>
    <Group justify="space-between" align="flex-end">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fw={700} size="xl">
        {value}
      </Text>
    </Group>
  </Card>
);
