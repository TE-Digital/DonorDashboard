// src/modules/admin/AdminTeacherStudentsPage.tsx
import React, { useEffect, useState } from "react";
import { Group, Modal, Select, Stack, Text } from "@mantine/core";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { LoadingState, PageHeader, TableSection, type TableKpi } from "../../design-system";
import {
  Badge,
  Button as LumenButton,
  type DataColumn,
} from "../../design-system/lumen";

interface TeacherStudent {
  id: string;
  name: string;
  school_name?: string | null;
  isOverdue: boolean;
}

export const AdminTeacherStudentsPage: React.FC = () => {
  const { teacherUserId } = useParams<{ teacherUserId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState<string>("");
  const [students, setStudents] = useState<TeacherStudent[]>([]);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<
    { value: string; label: string }[]
  >([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );

  const load = async () => {
    if (!teacherUserId) return;
    setLoading(true);

    const todayIso = new Date().toISOString().slice(0, 10);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoIso = sixMonthsAgo.toISOString().slice(0, 10);

    // 1) Teacher profile (name)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", teacherUserId)
      .maybeSingle();

    if (profileError || !profile) {
      console.error("Error loading teacher profile", profileError);
      setLoading(false);
      return;
    }

    setTeacherName(profile.full_name ?? "(no name)");

    // 2) Students for this teacher
    const { data: studentRows, error: studentError } = await supabase
      .from("students")
      .select("id, name, school:schools(name)")
      .eq("responsible_teacher_id", teacherUserId)
      .order("name", { ascending: true });

    if (studentError) {
      console.error("Error loading students", studentError);
      setLoading(false);
      return;
    }

    const baseStudents = (studentRows ?? []).map((s: any) => ({
      id: s.id as string,
      name: s.name as string,
      school_name: s.school?.name ?? null,
      isOverdue: false,
    }));

    if (baseStudents.length === 0) {
      setStudents(baseStudents);
      setLoading(false);
      return;
    }

    const studentIds = baseStudents.map((s) => s.id);

    // 3) Active scholarships for these students (same logic as dashboards)
    const { data: scholarships, error: schError } = await supabase
      .from("scholarship_awards")
      .select("student_id, status, period_start, period_end")
      .in("student_id", studentIds);

    if (schError) {
      console.error("Error loading scholarships", schError);
    }

    const activeScholarships = (scholarships ?? []).filter((sch: any) => {
      const start = sch.period_start as string;
      const end = sch.period_end as string;
      return (
        sch.status === "active" &&
        start <= todayIso &&
        end >= todayIso
      );
    });

    const studentsWithActiveScholarship = new Set(
      activeScholarships.map((s: any) => s.student_id as string)
    );

    // 4) Latest report per student from term_updates (same pattern as AdminDashboard)
    const { data: termRows, error: termError } = await supabase
      .from("term_updates")
      .select("student_id, report_date")
      .in("student_id", studentIds)
      .order("report_date", { ascending: false });

    if (termError) {
      console.error("Error loading term updates", termError);
    }

    const latestReportMap = new Map<string, string>();
    (termRows ?? []).forEach((r: any) => {
      const sId = r.student_id as string;
      if (!latestReportMap.has(sId)) {
        latestReportMap.set(sId, r.report_date as string);
      }
    });

    // 5) Determine overdue per student (same 6-month logic)
    const enriched = baseStudents.map((s) => {
      const hasActive = studentsWithActiveScholarship.has(s.id);
      if (!hasActive) {
        return { ...s, isOverdue: false };
      }

      const lastReportDate = latestReportMap.get(s.id);

      // No report at all → overdue
      if (!lastReportDate) {
        return { ...s, isOverdue: true };
      }

      // Latest report older than 6 months → overdue
      if (lastReportDate < sixMonthsAgoIso) {
        return { ...s, isOverdue: true };
      }

      return { ...s, isOverdue: false };
    });

    setStudents(enriched);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherUserId]);

  // ----- workflows -----

  // Only students without a teacher
  const openAddExistingModal = async () => {
    if (!teacherUserId) return;

    const { data, error } = await supabase
      .from("students")
      .select("id, name")
      .is("responsible_teacher_id", null)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error loading available students", error);
      return;
    }

    setAvailableStudents(
      (data ?? []).map((s: any) => ({
        value: s.id as string,
        label: s.name as string,
      }))
    );
    setSelectedStudentId(null);
    setAddModalOpen(true);
  };

  const attachExistingStudent = async () => {
    if (!teacherUserId || !selectedStudentId) return;

    const { error } = await supabase
      .from("students")
      .update({ responsible_teacher_id: teacherUserId })
      .eq("id", selectedStudentId);

    if (error) {
      console.error("Error attaching student", error);
      return;
    }

    setAddModalOpen(false);
    await load();
  };

  const handleCreateNewStudent = () => {
    if (!teacherUserId) return;
    navigate(`/admin/students/new?teacherUserId=${teacherUserId}`);
  };

  const handleUnassignStudent = async (studentId: string) => {
    if (!teacherUserId) return;

    const { error } = await supabase
      .from("students")
      .update({ responsible_teacher_id: null })
      .eq("id", studentId)
      .eq("responsible_teacher_id", teacherUserId);

    if (error) {
      console.error("Error unassigning student", error);
      return;
    }

    await load();
  };

  const overdueCount = students.filter((s) => s.isOverdue).length;

  const kpis: TableKpi[] = (() => {
    const schools = new Set(students.map((s) => s.school_name).filter(Boolean)).size;
    const upToDate = students.length - overdueCount;
    return [
      { label: "Students", value: students.length, footnote: "assigned to this teacher", accent: "blue" },
      {
        label: "Reports overdue",
        value: overdueCount,
        footnote: overdueCount ? "need chasing" : "none outstanding",
        accent: overdueCount ? "amber" : "teal",
      },
      { label: "Up to date", value: upToDate, footnote: "reported recently", accent: "teal" },
      { label: "Schools", value: schools, footnote: "represented", accent: "plum" },
    ];
  })();

  const columns: DataColumn<TeacherStudent>[] = [
    { key: "name", label: "Name", width: 240 },
    { key: "school_name", label: "School", width: 220, render: (s) => s.school_name || "—" },
    {
      key: "isOverdue",
      label: "Overdue report",
      width: 150,
      filterValue: (s) => (s.isOverdue ? "Overdue" : "Up to date"),
      render: (s) =>
        s.isOverdue ? (
          <Badge tone="danger" dot>
            Overdue
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            Up to date
          </Text>
        ),
    },
    {
      key: "actions",
      label: "Actions",
      width: 130,
      align: "right",
      sortable: false,
      filterable: false,
      render: (s) => (
        <div onClick={(e) => e.stopPropagation()}>
          <LumenButton size="sm" variant="secondary" onClick={() => handleUnassignStudent(s.id)}>
            Unassign
          </LumenButton>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState />;

  return (
    <>
      {/* Add existing student modal */}
      <Modal
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add existing student"
      >
        <Stack>
          <Select
            label="Student"
            placeholder="Select a student"
            data={availableStudents}
            value={selectedStudentId}
            onChange={setSelectedStudentId}
            searchable
            nothingFoundMessage="No unassigned students found"
          />
          <Group justify="flex-end" mt="md">
            <LumenButton variant="ghost" onClick={() => setAddModalOpen(false)}>
              Cancel
            </LumenButton>
            <LumenButton
              variant="primary"
              onClick={attachExistingStudent}
              disabled={!selectedStudentId}
            >
              Add to teacher
            </LumenButton>
          </Group>
        </Stack>
      </Modal>

      <Stack gap="md">
        <PageHeader
          title={`Students of ${teacherName}`}
          subtitle="View and manage all students assigned to this teacher."
          onBack={() => navigate("/admin/teachers")}
          backLabel="Back to teachers"
          actions={
            <>
              <LumenButton variant="secondary" icon="plus" onClick={openAddExistingModal}>
                Add existing student
              </LumenButton>
              <LumenButton variant="primary" icon="plus" onClick={handleCreateNewStudent}>
                Create new student
              </LumenButton>
            </>
          }
        />

        <TableSection
          kpis={kpis}
          columns={columns}
          rows={students}
          searchKeys={["name", "school_name"]}
          onRowClick={(s) => navigate(`/admin/students/${s.id}`)}
          emptyTitle="No students assigned yet"
          emptyDescription="Assign an existing student, or create a new one."
          emptyIcon="users"
        />
      </Stack>
    </>
  );
};

export default AdminTeacherStudentsPage;
