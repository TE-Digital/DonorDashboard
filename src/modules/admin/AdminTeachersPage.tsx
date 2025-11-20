// src/modules/admin/AdminTeachersPage.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  Card,
  Table,
  Text,
  Loader,
  Stack,
  Anchor,
  Group,
  ActionIcon,
  Tooltip,
  Badge,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { IconUsers } from "@tabler/icons-react";

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

  if (loading) return <Loader />;

  return (
    <Stack>
      <Text fw={700} size="lg">
        Teachers
      </Text>

      <Card withBorder>
        <Table
          striped
          highlightOnHover
          withTableBorder
          withColumnBorders
          horizontalSpacing="md"
          verticalSpacing="xs"
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Phone</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th style={{ textAlign: "center" }}>Students</Table.Th>
              <Table.Th style={{ textAlign: "center" }}>
                Overdue students
              </Table.Th>
              <Table.Th style={{ textAlign: "center" }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {teachers.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text c="dimmed">No teachers found.</Text>
                </Table.Td>
              </Table.Tr>
            )}

            {teachers.map((t) => (
              <Table.Tr
                key={t.id}
                style={{
                  borderBottom: "1px solid var(--mantine-color-gray-3)",
                }}
              >
                {/* Name – clickable to teacher's students */}
                <Table.Td>
                  <Anchor
                    component={Link}
                    to={`/admin/teachers/${t.id}/students`}
                  >
                    {t.full_name || "(no name)"}
                  </Anchor>
                </Table.Td>

                {/* Email */}
                <Table.Td>
                  {t.email ? (
                    <Anchor href={`mailto:${t.email}`}>{t.email}</Anchor>
                  ) : (
                    <Text c="dimmed" size="sm">
                      no email
                    </Text>
                  )}
                </Table.Td>

                {/* Phone */}
                <Table.Td>{t.phone || "—"}</Table.Td>

                {/* Created */}
                <Table.Td>
                  {t.created_at
                    ? new Date(t.created_at).toLocaleDateString()
                    : "—"}
                </Table.Td>

                {/* Student count */}
                <Table.Td style={{ textAlign: "center" }}>
                  {t.studentCount}
                </Table.Td>

                {/* Overdue students */}
                <Table.Td style={{ textAlign: "center" }}>
                  {t.overdueCount > 0 ? (
                    <Badge color="red" variant="light">
                      {t.overdueCount}
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">
                      0
                    </Text>
                  )}
                </Table.Td>

                {/* Actions */}
                <Table.Td style={{ textAlign: "center" }}>
                  <Group gap="xs" justify="center">
                    <Tooltip label="View & manage students">
                      <ActionIcon
                        component={Link}
                        to={`/admin/teachers/${t.id}/students`}
                        variant="subtle"
                        aria-label="Manage students"
                      >
                        <IconUsers size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
};

export default AdminTeachersPage;
