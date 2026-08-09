// src/modules/admin/AdminDashboardPage.tsx
import React, { useEffect, useState } from "react";
import { SimpleGrid, Stack, Button } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { HeroSection } from "../../components/HeroSection";
import { LoadingState, PageHeader, StatCard } from "../../design-system";

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
    contact_requests_unhandled: 0, // ⬅ updated key
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const todayIso = new Date().toISOString().slice(0, 10);

      const [
        studentsRes,
        schoolsRes,
        donorsRes,
        teachersRes,
        totalSchRes,
        activeSchRes,
        contactReqRes,
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
        supabase
          .from("contact_requests")
          .select("id", { count: "exact", head: true })
          .eq("handled", false),
      ]);

      // ---- OVERDUE REPORT CALCULATION ----
      const { data: allStudents } = await supabase
        .from("students")
        .select("id");

      const allStudentIds = allStudents?.map((s) => s.id) ?? [];

      const { data: activeSchRows } = await supabase
        .from("scholarship_awards")
        .select("student_id, status, period_start, period_end")
        .eq("status", "active")
        .lte("period_start", todayIso)
        .gte("period_end", todayIso);

      const activeStudentIds = new Set(
        (activeSchRows ?? []).map((s) => s.student_id)
      );

      const { data: termUpdates } = await supabase
        .from("term_updates")
        .select("student_id, report_date")
        .in("student_id", allStudentIds)
        .order("report_date", { ascending: false });

      const latestReportMap = new Map<string, string>();
      (termUpdates ?? []).forEach((r) => {
        if (!latestReportMap.has(r.student_id)) {
          latestReportMap.set(r.student_id, r.report_date);
        }
      });

      let overdue = 0;
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoIso = sixMonthsAgo.toISOString().slice(0, 10);

      allStudentIds.forEach((id) => {
        if (!activeStudentIds.has(id)) return;

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
        contact_requests_unhandled: contactReqRes.count ?? 0,
      });

      setLoading(false);
    };

    load();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <Stack>
      <HeroSection />

      <PageHeader
        title="Dashboard Overview"
        actions={
          <>
            <Button size="xs" onClick={() => navigate("/admin/students/new")}>
              Add student
            </Button>
            <Button
              size="xs"
              onClick={() => navigate("/admin/scholarships/new")}
            >
              Add scholarship
            </Button>
            <Button size="xs" onClick={() => navigate("/admin/donors/new")}>
              Add donor
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => navigate("/admin/teachers")}
            >
              View teachers
            </Button>
          </>
        }
      />

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xs">
        <StatCard label="Students" value={stats.students} />
        <StatCard label="Teachers" value={stats.teachers} />
        <StatCard label="Schools" value={stats.schools} />
        <StatCard label="Donors" value={stats.donors} />
        <StatCard label="Active scholarships" value={stats.scholarships_active} />
        <StatCard label="Total scholarships" value={stats.scholarships_total} />
        <StatCard label="Overdue reports" value={stats.overdue_reports} />
        <StatCard
          label="Open contact requests"
          value={stats.contact_requests_unhandled}
        />
      </SimpleGrid>
    </Stack>
  );
};
