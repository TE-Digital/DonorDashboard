// src/modules/admin/AdminTeacherStudentsPage.tsx
import React, { useEffect, useState } from "react";
import {
  Card,
  Stack,
  Text,
  Loader,
  Table,
  Button,
  Group,
  Modal,
  Select,
  Anchor,
  Badge,
} from "@mantine/core";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

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

  if (loading) return <Loader />;

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
            <Button variant="subtle" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={attachExistingStudent} disabled={!selectedStudentId}>
              Add to teacher
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Card withBorder>
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={700} size="lg">
                Students of {teacherName}
              </Text>
              <Text size="sm" c="dimmed">
                View and manage all students assigned to this teacher.
              </Text>
              <Group gap="xs" mt="xs">
                <Badge>
                  {students.length} student{students.length === 1 ? "" : "s"}
                </Badge>
                <Badge color={overdueCount > 0 ? "red" : "gray"}>
                  {overdueCount} student
                  {overdueCount === 1 ? "" : "s"} with overdue reports
                </Badge>
              </Group>
            </div>

            <Button
              variant="subtle"
              size="xs"
              onClick={() => navigate("/admin/teachers")}
            >
              Back to teachers
            </Button>
          </Group>

          <Group justify="space-between" mt="xs">
            <Button size="xs" variant="outline" onClick={openAddExistingModal}>
              Add existing student
            </Button>
            <Button size="xs" onClick={handleCreateNewStudent}>
              Create new student
            </Button>
          </Group>

          {students.length === 0 ? (
            <Text size="sm" c="dimmed" mt="sm">
              No students assigned yet.
            </Text>
          ) : (
            <Table
              striped
              highlightOnHover
              withTableBorder
              withColumnBorders
              horizontalSpacing="md"
              verticalSpacing="xs"
              mt="sm"
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>School</Table.Th>
                  <Table.Th style={{ textAlign: "center" }}>
                    Overdue report
                  </Table.Th>
                  <Table.Th style={{ textAlign: "center" }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {students.map((s) => (
                  <Table.Tr
                    key={s.id}
                    style={{
                      borderBottom: "1px solid var(--mantine-color-gray-3)",
                    }}
                  >
                    <Table.Td>
                      <Anchor
                        component="button"
                        onClick={() => navigate(`/admin/students/${s.id}`)}
                      >
                        {s.name}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>{s.school_name || "—"}</Table.Td>
                    <Table.Td style={{ textAlign: "center" }}>
                      {s.isOverdue ? (
                        <Badge color="red" variant="filled">
                          Overdue
                        </Badge>
                      ) : (
                        <Text size="sm" c="dimmed">
                          Up to date
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ textAlign: "center" }}>
                      <Group gap="xs" justify="center">
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => navigate(`/admin/students/${s.id}`)}
                        >
                          View
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          color="red"
                          onClick={() => handleUnassignStudent(s.id)}
                        >
                          Unassign
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>
    </>
  );
};

export default AdminTeacherStudentsPage;
