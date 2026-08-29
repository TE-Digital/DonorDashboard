// src/modules/admin/AdminTeachersPage.tsx
//
// The teacher directory: who teaches, where, how to reach them, how much they
// carry, and whether they can get in at all.
//
// Every column here answers a question a supervisor actually arrives with.
// Three used not to. "Subject" was an em-dash with no column behind it. School
// was derived only from the students a teacher supervises, so a teacher
// assigned to a school with no students yet read "—" even though the form had
// saved the school. And nothing said when a teacher last submitted anything —
// only how many students were overdue, which moves long after a teacher has
// gone quiet.
//
// Report health uses the shared cycle vocabulary (reportStatus.ts), on the
// student's own school rhythm. This page used to keep a private six-month
// constant, which meant the same student could read overdue here and on time
// on the students page.

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Anchor, Avatar, Stack, Text } from "@mantine/core";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ContactCell, LoadingState, PageHeader, TableSection, type TableKpi } from "../../design-system";
import { TeacherFormDrawer } from "./TeacherFormDrawer";
import { reportTeacherCreated } from "./AdminCreateTeacherPage";
import { AccessBadge, AccessMenu } from "./AccessActions";
import {
  ACCESS_META,
  ACCESS_RANK,
  accessStateOf,
  loadAccessMap,
  type AccessMap,
  type AccessState,
} from "./userAccess";
import { TEACHER_BASE_COLUMNS, TEACHER_EXTENDED_COLUMNS, isMissingColumnError } from "./teacherProfile";
import { reportingPeriodMonths } from "./schoolProfile";
import { CYCLE_MONTHS, loadCycleReports, reportCycle } from "../reports";
import { Badge, Button, type DataColumn } from "../../design-system/lumen";
import { profileAvatarStyle, profileInitials } from "../../design-system/profileAvatar";
import styles from "./AdminDirectory.module.scss";

interface TeacherRow {
  id: string; // profiles.id (user id)
  full_name: string | null;
  /** Shown under the English name. Null until the teacher-profile migration lands. */
  full_name_th: string | null;
  email: string | null;
  phone: string | null;
  /** LINE is the channel teachers actually answer on. Null until the profile migration lands. */
  line_id: string | null;
  created_at: string | null;
  studentCount: number;
  overdueCount: number;
  /** The school on the teacher's own record, falling back to their students'. */
  schools: string;
  /** Most recent accepted report across their students. Null when there is none. */
  lastReport: string | null;
}

/**
 * School names, plus the reporting period each one keeps — the same read the
 * students directory makes, degrading the same way on a database without the
 * reporting-period migration.
 */
const loadSchoolCycleRows = async (schoolIds: string[]) => {
  const withPeriod = await supabase
    .from("schools")
    .select("id, name, reporting_period_months")
    .in("id", schoolIds);

  if (!withPeriod.error) return withPeriod;

  return supabase.from("schools").select("id, name").in("id", schoolIds);
};

/** How long ago, in the words an admin would use. */
const relativeDate = (iso: string | null): string => {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never";

  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} months ago`;
  return `${Math.floor(months / 12)} years ago`;
};

/** A KPI the table can be narrowed to, so a tile is a filter and not just a number. */
type Focus = "all" | "waiting" | "overdue" | "silent";

/** No accepted report in this long is silence worth chasing, whatever the cycle says. */
const SILENT_DAYS = 180;

const isSilent = (teacher: TeacherRow): boolean => {
  if (teacher.studentCount === 0) return false;
  if (!teacher.lastReport) return true;
  const then = new Date(teacher.lastReport).getTime();
  if (Number.isNaN(then)) return true;
  return Date.now() - then > SILENT_DAYS * 86_400_000;
};

export const AdminTeachersPage: React.FC = () => {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherDrawerOpen, setTeacherDrawerOpen] = useState(false);
  const [focus, setFocus] = useState<Focus>("all");
  /** Who can sign in, read from auth.users rather than stored on the profile. */
  const [access, setAccess] = useState<AccessMap>({ byUser: {}, available: false, error: null });

  const load = React.useCallback(async () => {
      setLoading(true);

      // Who can sign in travels with the directory. An admin scanning teachers
      // asks "who still has no account?" before anything else on this screen.
      setAccess(await loadAccessMap());

      // 1) Load all profiles (users). The extended columns carry the Thai name,
      //    the LINE ID and the teacher's own school, and are dropped when the
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

      const teacherProfiles = (profiles ?? [])
        .filter((p: any) => teacherIds.has(p.id as string))
        .map((p: any) => ({
          id: p.id as string,
          full_name: p.full_name,
          full_name_th: p.full_name_th ?? null,
          email: p.email,
          phone: p.phone,
          line_id: p.line_id ?? null,
          school_id: (p.school_id ?? null) as string | null,
          created_at: p.created_at,
          studentCount: 0,
          overdueCount: 0,
          schools: "—",
          lastReport: null as string | null,
        }));

      if (teacherProfiles.length === 0) {
        setTeachers([]);
        setLoading(false);
        return;
      }

      const teacherUserIds = teacherProfiles.map((t) => t.id);

      // 4) Load all students supervised by these teachers. Enrolment dates
      //    anchor a cycle for a student who has never had a report.
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("id, school_id, responsible_teacher_id, enrolled_on, created_at")
        .in("responsible_teacher_id", teacherUserIds);

      if (studentsError) {
        console.error("Error loading students for teachers", studentsError);
        setTeachers(teacherProfiles.map(({ school_id, ...row }) => row));
        setLoading(false);
        return;
      }

      const students = (studentsData ?? []) as any[];
      const studentIds = students.map((s) => s.id as string);

      // The teacher's own school is the answer when they have one; the schools
      // of the students they supervise fill in for a record saved before that
      // column existed.
      const schoolIds = Array.from(
        new Set([
          ...students.map((s) => s.school_id),
          ...teacherProfiles.map((t) => t.school_id),
        ].filter(Boolean))
      ) as string[];

      const schoolNameById = new Map<string, string>();
      // A student reports on their school's rhythm, not on a global six months.
      const periodBySchool = new Map<string, number>();

      if (schoolIds.length > 0) {
        const schoolRows = await loadSchoolCycleRows(schoolIds);
        if (schoolRows.error) console.error("Error loading schools for teachers", schoolRows.error);
        ((schoolRows.data ?? []) as any[]).forEach((school) => {
          schoolNameById.set(school.id, school.name);
          periodBySchool.set(school.id, reportingPeriodMonths(school));
        });
      }

      const schoolsByTeacher = new Map<string, Set<string>>();
      students.forEach((s) => {
        const name = s.school_id ? schoolNameById.get(s.school_id) : null;
        if (!name) return;
        const teacherId = s.responsible_teacher_id as string;
        if (!schoolsByTeacher.has(teacherId)) schoolsByTeacher.set(teacherId, new Set());
        schoolsByTeacher.get(teacherId)!.add(name);
      });

      // 5) Load scholarships for these students to detect active scholarships.
      //    Only a funded student is somebody a donor is waiting to hear about,
      //    so only a funded student can make a teacher's report overdue.
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
          const todayIso = new Date().toISOString().slice(0, 10);

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

      // 6) Report health, on the shared cycle rules rather than this page's own.
      const { byStudent } = await loadCycleReports(supabase, studentIds);

      const studentCountByTeacher = new Map<string, number>();
      const overdueCountByTeacher = new Map<string, number>();
      const lastReportByTeacher = new Map<string, string>();

      students.forEach((s) => {
        const teacherId = s.responsible_teacher_id as string;
        const studentId = s.id as string;
        const reports = byStudent.get(studentId) ?? [];

        studentCountByTeacher.set(
          teacherId,
          (studentCountByTeacher.get(teacherId) ?? 0) + 1
        );

        // The teacher's own last delivery, across everyone they look after.
        // An accepted report is one the organisation has taken; a draft is not
        // evidence that anything reached anybody.
        reports.forEach((report) => {
          if (report.status && report.status !== "approved") return;
          if (!report.report_date) return;
          const held = lastReportByTeacher.get(teacherId);
          if (!held || report.report_date > held) {
            lastReportByTeacher.set(teacherId, report.report_date);
          }
        });

        if (!activeScholarshipStudents.has(studentId)) return;

        const cycle = reportCycle(
          reports,
          s.enrolled_on ?? s.created_at ?? null,
          new Date(),
          (s.school_id && periodBySchool.get(s.school_id)) || CYCLE_MONTHS,
        );

        if (cycle.state === "overdue") {
          overdueCountByTeacher.set(
            teacherId,
            (overdueCountByTeacher.get(teacherId) ?? 0) + 1
          );
        }
      });

      const enriched: TeacherRow[] = teacherProfiles.map(({ school_id, ...t }) => {
        const own = school_id ? schoolNameById.get(school_id) : null;
        const derived = Array.from(schoolsByTeacher.get(t.id) ?? []);
        // The teacher's own school leads; the rest of the list is where their
        // students actually are, which is not always the same place.
        const names = own ? [own, ...derived.filter((name) => name !== own)] : derived;

        return {
          ...t,
          studentCount: studentCountByTeacher.get(t.id) ?? 0,
          overdueCount: overdueCountByTeacher.get(t.id) ?? 0,
          lastReport: lastReportByTeacher.get(t.id) ?? null,
          schools: names.length
            ? names.length > 1
              ? `${names[0]} +${names.length - 1}`
              : names[0]
            : "—",
        };
      });

      setTeachers(enriched);
      setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const navigate = useNavigate();
  const location = useLocation();

  // A teacher created a moment ago, on the route or in the drawer. The row is
  // tinted until the admin does anything else, so "where did it go?" is not a
  // question they have to ask of a table sorted by name.
  const [created, setCreated] = useState<string | null>(
    (location.state as { createdTeacherId?: string } | null)?.createdTeacherId ?? null,
  );

  // The state is consumed once. Without this a reload, or a step back to this
  // page later, lights up a row that is no longer news.
  useEffect(() => {
    if ((location.state as { createdTeacherId?: string } | null)?.createdTeacherId) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stateOf = React.useCallback(
    (teacher: TeacherRow): AccessState =>
      access.available ? accessStateOf(access.byUser[teacher.id]) : "unknown",
    [access],
  );

  const isWaiting = React.useCallback(
    (teacher: TeacherRow) => {
      const state = stateOf(teacher);
      return state === "none" || state === "invited" || state === "stale";
    },
    [stateOf],
  );

  /** What the table shows: everyone, narrowed to the KPI in focus. */
  const visible = React.useMemo(() => {
    if (focus === "all") return teachers;
    if (focus === "waiting") return teachers.filter(isWaiting);
    if (focus === "overdue") return teachers.filter((t) => t.overdueCount > 0);
    return teachers.filter(isSilent);
  }, [teachers, focus, isWaiting]);

  // Derived on the page: caseload and report health per teacher, rolled up.
  // Each tile is also a filter — a number an admin cannot act on is decoration.
  const kpis: TableKpi[] = React.useMemo(() => {
    const students = teachers.reduce((sum, t) => sum + t.studentCount, 0);
    const overdue = teachers.reduce((sum, t) => sum + t.overdueCount, 0);
    const withOverdue = teachers.filter((t) => t.overdueCount > 0).length;
    const silent = teachers.filter(isSilent).length;

    // Teachers who cannot use the platform yet: no account, or an invitation
    // still sitting unopened. This is the number an admin acts on.
    const waiting = access.available ? teachers.filter(isWaiting).length : 0;

    const toggle = (next: Exclude<Focus, "all">) => () =>
      setFocus((current) => (current === next ? "all" : next));

    return [
      {
        label: "Teachers",
        value: teachers.length,
        footnote: "in the directory",
        mark: "teachers",
        active: focus === "all",
        onClick: () => setFocus("all"),
      },
      {
        label: "Not signed in yet",
        value: access.available ? waiting : "—",
        footnote: access.available ? "invited or without an account" : "account state unavailable",
        mark: "accounts",
        active: focus === "waiting",
        onClick: access.available ? toggle("waiting") : undefined,
      },
      {
        label: "Teachers with overdue",
        value: withOverdue,
        footnote: `${overdue} reports outstanding`,
        mark: withOverdue ? "overdue" : "ontrack",
        active: focus === "overdue",
        onClick: toggle("overdue"),
      },
      {
        label: "Nothing in 6 months",
        value: silent,
        footnote: "no accepted report",
        mark: silent ? "overdue" : "ontrack",
        active: focus === "silent",
        onClick: toggle("silent"),
      },
      { label: "Students covered", value: students, footnote: "assigned in total", mark: "students" },
    ];
  }, [teachers, access, focus, isWaiting]);

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
      width: 220,
      render: (t) => (
        <div className={styles.nameCell}>
          <Avatar size={28} style={profileAvatarStyle(t.id)}>{profileInitials(t.full_name)}</Avatar>
          <span className={styles.nameLines}>
            <Anchor component={Link} to={`/admin/teachers/${t.id}`}>
              {t.full_name || "(no name)"}
            </Anchor>
            {t.full_name_th && <span className={styles.nameSecondary}>{t.full_name_th}</span>}
          </span>
        </div>
      ),
    },
    { key: "schools", label: "School", width: 200 },
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
    { key: "studentCount", label: "Students", align: "right", numeric: true, width: 100 },
    {
      // The column a supervisor opens this page for: a teacher going quiet is
      // visible here long before the overdue count moves.
      key: "lastReport",
      label: "Last report",
      width: 140,
      // Sorting on the raw date, so "never" sorts as the oldest thing there is
      // rather than alphabetically among the words.
      filterValue: (t) => t.lastReport ?? "",
      render: (t) => (
        <span title={t.lastReport ? new Date(t.lastReport).toLocaleDateString() : "No accepted report"}>
          {isSilent(t) ? (
            <Badge tone="warning" dot>
              {relativeDate(t.lastReport)}
            </Badge>
          ) : (
            <Text size="sm" c={t.lastReport ? undefined : "dimmed"}>
              {t.studentCount === 0 && !t.lastReport ? "—" : relativeDate(t.lastReport)}
            </Text>
          )}
        </span>
      ),
    },
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
      key: "access",
      label: "Account",
      width: 150,
      // Filtering reads the label the way it reads on screen; sorting puts what
      // needs attention first, which is not alphabetical order.
      filterValue: (t) => ACCESS_META[stateOf(t)].label,
      sortValue: (t) => ACCESS_RANK[stateOf(t)],
      render: (t) => (
        <AccessBadge
          state={stateOf(t)}
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

  const EMPTY_COPY: Record<Focus, { title: string; body: string }> = {
    all: {
      title: "No teachers found",
      body: "Teachers appear here once they have an account.",
    },
    waiting: {
      title: "Everyone has signed in",
      body: "No teacher is waiting on an invitation.",
    },
    overdue: {
      title: "No overdue reports",
      body: "Every funded student has a report inside their school's cycle.",
    },
    silent: {
      title: "Everyone has reported recently",
      body: "No teacher has been quiet for six months.",
    },
  };

  return (
    <Stack className={styles.page}>
      <TeacherFormDrawer
        opened={teacherDrawerOpen}
        onClose={() => setTeacherDrawerOpen(false)}
        onCreated={(teacher) => {
          setTeacherDrawerOpen(false);
          // Adding a teacher from the directory keeps the admin in the
          // directory: the outcome is a toast and a tinted row, not a detour
          // through a page they did not ask for.
          reportTeacherCreated(teacher);
          setCreated(teacher.id);
          setFocus("all");
          void load();
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
        rows={visible}
        density="compact"
        pageSize={14}
        highlightRowId={created}
        onRowClick={(t) => {
          setCreated(null);
          navigate(`/admin/teachers/${t.id}`);
        }}
        emptyTitle={EMPTY_COPY[focus].title}
        emptyDescription={EMPTY_COPY[focus].body}
        emptyIcon="users"
      />
    </Stack>
  );
};

export default AdminTeachersPage;
