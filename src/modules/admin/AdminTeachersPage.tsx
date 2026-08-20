// src/modules/admin/AdminTeachersPage.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Anchor, Avatar, Stack, Text } from "@mantine/core";
import { Link, useNavigate } from "react-router-dom";
import { ContactCell, LoadingState, PageHeader, TableSection, type TableKpi } from "../../design-system";
import { TeacherFormDrawer } from "./TeacherFormDrawer";
import { AccessBadge, AccessMenu } from "./AccessActions";
import {
  ACCESS_META,
  accessStateOf,
  loadAccessMap,
  type AccessMap,
} from "./userAccess";
import { TEACHER_BASE_COLUMNS, TEACHER_EXTENDED_COLUMNS, isMissingColumnError } from "./teacherProfile";
import { Badge, Button, type DataColumn } from "../../design-system/lumen";
import { profileAvatarStyle, profileInitials } from "../../design-system/profileAvatar";
import styles from "./AdminDirectory.module.scss";

interface TeacherRow {
  id: string; // profiles.id (user id)
  full_name: string | null;
  email: string | null;
  phone: string | null;
  /** LINE is the channel teachers actually answer on. Null until the profile migration lands. */
  line_id: string | null;
  created_at: string | null;
  studentCount: number;
  overdueCount: number;
  /** Schools this teacher supervises students at, joined for display. */
  schools: string;
  /** No subject column exists on profiles yet; shown as a placeholder. */
  subject: string;
}

export const AdminTeachersPage: React.FC = () => {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherDrawerOpen, setTeacherDrawerOpen] = useState(false);
  /** Who can sign in, read from auth.users rather than stored on the profile. */
  const [access, setAccess] = useState<AccessMap>({ byUser: {}, available: false, error: null });

  const load = React.useCallback(async () => {
      setLoading(true);

      // Who can sign in travels with the directory. An admin scanning teachers
      // asks "who still has no account?" before anything else on this screen.
      setAccess(await loadAccessMap());

      // 1) Load all profiles (users). The extended columns carry the LINE ID —
      //    the channel a teacher actually answers on — and are dropped when the
      //    teacher-profile migration has not been applied.
      const extended = await supabase.from("profiles").select(TEACHER_EXTENDED_COLUMNS);

      if (extended.error && !isMissingColumnError(extended.error)) {
        console.error("Error loading profiles", extended.error);
        setLoading(false);
        return;
      }

      let profiles = extended.data as any[] | null;

      if (extended.error) {
        const base = await supabase.from("profiles").select(TEACHER_BASE_COLUMNS);
        if (base.error) {
          console.error("Error loading profiles", base.error);
          setLoading(false);
          return;
        }
        profiles = base.data as any[];
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
          line_id: p.line_id ?? null,
          created_at: p.created_at,
          studentCount: 0,
          overdueCount: 0,
          schools: "—",
          subject: "—",
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
          school_id,
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

      // A teacher's school is not stored on the profile; it follows from the
      // students they supervise.
      const schoolIds = Array.from(
        new Set(students.map((s) => s.school_id).filter(Boolean))
      ) as string[];
      const schoolNameById = new Map<string, string>();

      if (schoolIds.length > 0) {
        const { data: schoolRows, error: schoolError } = await supabase
          .from("schools")
          .select("id, name")
          .in("id", schoolIds);
        if (schoolError) console.error("Error loading schools for teachers", schoolError);
        (schoolRows ?? []).forEach((school: any) => schoolNameById.set(school.id, school.name));
      }

      const schoolsByTeacher = new Map<string, Set<string>>();
      students.forEach((s) => {
        const name = s.school_id ? schoolNameById.get(s.school_id) : null;
        if (!name) return;
        const teacherId = s.responsible_teacher_id as string;
        if (!schoolsByTeacher.has(teacherId)) schoolsByTeacher.set(teacherId, new Set());
        schoolsByTeacher.get(teacherId)!.add(name);
      });

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
        schools: Array.from(schoolsByTeacher.get(t.id) ?? []).join(", ") || "—",
      }));

      setTeachers(enriched);
      setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const navigate = useNavigate();

  // Derived on the page: caseload and report health per teacher, rolled up.
  const kpis: TableKpi[] = React.useMemo(() => {
    const students = teachers.reduce((sum, t) => sum + t.studentCount, 0);
    const overdue = teachers.reduce((sum, t) => sum + t.overdueCount, 0);
    const withOverdue = teachers.filter((t) => t.overdueCount > 0).length;
    const avg = teachers.length ? Math.round((students / teachers.length) * 10) / 10 : 0;

    // Teachers who cannot use the platform yet: no account, or an invitation
    // still sitting unopened. This is the number an admin acts on.
    const waiting = access.available
      ? teachers.filter((t) => {
          const state = accessStateOf(access.byUser[t.id]);
          return state === "none" || state === "invited" || state === "stale";
        }).length
      : 0;

    return [
      { label: "Teachers", value: teachers.length, footnote: "in the directory", mark: "teachers" },
      {
        label: "Not signed in yet",
        value: access.available ? waiting : "—",
        footnote: access.available ? "invited or without an account" : "account state unavailable",
        mark: "accounts",
      },
      { label: "Students covered", value: students, footnote: "assigned in total", mark: "students" },
      {
        label: "Teachers with overdue",
        value: withOverdue,
        footnote: `${overdue} reports outstanding`,
        mark: withOverdue ? "overdue" : "ontrack",
      },
      { label: "Average caseload", value: avg, footnote: "students per teacher", mark: "average" },
    ];
  }, [teachers, access]);

  const columns: DataColumn<TeacherRow>[] = [
    {
      key: "id",
      label: "Teacher ID",
      width: 120,
      muted: true,
      render: (t) => `TC-${t.id.slice(0, 6).toUpperCase()}`,
    },
    {
      key: "full_name",
      label: "Name",
      width: 200,
      render: (t) => (
        <div className={styles.profileName}>
          <Avatar size={28} style={profileAvatarStyle(t.id)}>{profileInitials(t.full_name)}</Avatar>
          <Anchor component={Link} to={`/admin/teachers/${t.id}`}>
            {t.full_name || "(no name)"}
          </Anchor>
        </div>
      ),
    },
    { key: "schools", label: "School", width: 200 },
    { key: "subject", label: "Subject", width: 150, muted: true },
    {
      // One cell instead of an email column and a phone column. Hover reads the
      // value, click puts it on the clipboard — which is what an admin was
      // going to do with it anyway.
      key: "contact",
      label: "Contact",
      width: 110,
      sortable: false,
      filterable: false,
      render: (t) => (
        <ContactCell
          email={t.email}
          phone={t.phone}
          line={t.line_id}
          owner={t.full_name || "This teacher"}
          channels={["email", "phone", "line"]}
        />
      ),
    },
    {
      key: "access",
      label: "Account",
      width: 150,
      // Sorting and filtering both work off the label, so "Invite not used"
      // groups together in the column menu the way it reads on screen.
      filterValue: (t) => ACCESS_META[accessStateOf(access.byUser[t.id])].label,
      render: (t) => (
        <AccessBadge
          state={access.available ? accessStateOf(access.byUser[t.id]) : "unknown"}
          inviteCount={access.byUser[t.id]?.invite_count}
        />
      ),
    },
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
    {
      // Row-level actions live at the end of the row and never conflict with
      // the row click, which opens the teacher.
      key: "actions",
      label: "",
      width: 60,
      align: "right",
      sortable: false,
      filterable: false,
      render: (t) => (
        <AccessMenu
          userId={t.id}
          name={t.full_name || "this teacher"}
          email={t.email}
          access={access.byUser[t.id]}
          available={access.available}
          onChanged={() => void load()}
        />
      ),
    },
  ];

  if (loading) return <LoadingState />;

  return (
    <Stack className={styles.page}>
      <TeacherFormDrawer
        opened={teacherDrawerOpen}
        onClose={() => setTeacherDrawerOpen(false)}
        onCreated={(teacher) => {
          setTeacherDrawerOpen(false);
          navigate(`/admin/teachers/${teacher.id}`);
        }}
      />

      <PageHeader
        title="Teachers"
        subtitle="Teacher directory, assigned students, and report health."
        actions={<Button variant="primary" icon="plus" onClick={() => setTeacherDrawerOpen(true)}>Add teacher</Button>}
      />

      <TableSection
        kpis={kpis}
        columns={columns}
        rows={teachers}
        density="compact"
        pageSize={14}
        onRowClick={(t) => navigate(`/admin/teachers/${t.id}`)}
        emptyTitle="No teachers found"
        emptyDescription="Teachers appear here once they have an account."
        emptyIcon="users"
      />
    </Stack>
  );
};


export default AdminTeachersPage;
