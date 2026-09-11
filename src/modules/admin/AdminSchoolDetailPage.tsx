// src/modules/admin/AdminSchoolDetailPage.tsx
//
// The school record screen: identity strip, a row of KPIs, then Overview /
// Teachers / Students / Reports as tabs over the same loaded data.
//
// Only name, address and created_at are real columns. Every other field shown
// here comes from schoolProfile.ts and is a placeholder — see that file. Counts,
// rosters and report periods are genuine, derived from students and term_updates.

import React, { useEffect, useMemo, useState } from "react";
import { Menu, Modal, Stack, Text, Group } from "@mantine/core";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  KpiRow,
  LoadingState,
  TableSection,
  emptyValue,
  formatDate,
  type KpiItem,
} from "../../design-system";
import { toFriendlyError } from "../../i18n/errors";
import { Badge, Banner, Button, Icon, Tabs, type DataColumn } from "../../design-system/lumen";
import { supabase } from "../../lib/supabaseClient";
import { StudentFormDrawer } from "./StudentFormDrawer";
import { TeacherFormDrawer } from "./TeacherFormDrawer";
import { isMissingColumnError, teacherColumnsAvailable } from "./teacherProfile";
import {
  deriveSchoolProfile,
  statusTone,
  reportingPeriodLabel,
  type SchoolProfile,
  type SchoolRecord,
} from "./schoolProfile";
import styles from "./AdminDirectory.module.scss";

type TabValue = "overview" | "teachers" | "students" | "reports";

interface StudentRow {
  id: string;
  name: string;
  displayId: string;
  grade: string;
  teacherId: string | null;
  teacherName: string;
  scholarship: string;
  lastReport: string | null;
}

interface TeacherRow {
  id: string;
  displayId: string;
  name: string;
  email: string;
  phone: string;
  studentCount: number;
  lastActive: string | null;
}

interface ReportFolder {
  key: string;
  period: string;
  submitted: number;
  total: number;
  latest: string | null;
}

const shortId = (prefix: string, id: string) => `${prefix}-${id.slice(0, 6).toUpperCase()}`;
const asDate = (value: string | null) => formatDate(value);

/** Reports land in one of two cycles a year; the design groups them that way. */
const periodOf = (isoDate: string): string => {
  const date = new Date(isoDate);
  return `${date.getFullYear()} ${date.getMonth() < 6 ? "mid-year" : "year-end"}`;
};

export const AdminSchoolDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { schoolId } = useParams<{ schoolId: string }>();

  const [school, setSchool] = useState<SchoolRecord | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [folders, setFolders] = useState<ReportFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabValue>("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Roster building happens here, in drawers, rather than by leaving the page.
  const [teacherDrawerOpen, setTeacherDrawerOpen] = useState(false);
  const [studentDrawerOpen, setStudentDrawerOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  /** Bumped after a drawer saves, to re-run the load effect. */
  const [reloadKey, setReloadKey] = useState(0);
  /** False until the teacher-profile migration lands: a teacher cannot name a
   *  school, so this page can only see the ones supervising its students. */
  const [teacherLinkSupported, setTeacherLinkSupported] = useState(true);

  // The add-school route lands here with ?created=1 rather than confirming on a
  // screen the admin is about to leave.
  const [searchParams, setSearchParams] = useSearchParams();
  const justCreated = searchParams.get("created") === "1";

  useEffect(() => {
    const load = async () => {
      if (!schoolId) {
        setError("We couldn't tell which school to open. Go back to the list and choose one.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      // The reporting period is read alongside the rest, and its absence on a
      // database without the migration is not a reason to fail the page.
      let { data: schoolData, error: schoolError } = await supabase
        .from("schools")
        .select("id, name, address, created_at, reporting_period_months")
        .eq("id", schoolId)
        .maybeSingle();

      if (schoolError) {
        ({ data: schoolData, error: schoolError } = await supabase
          .from("schools")
          .select("id, name, address, created_at")
          .eq("id", schoolId)
          .maybeSingle());
      }

      if (schoolError || !schoolData) {
        console.error("Error loading school", schoolError);
        setError(
          schoolError
            ? toFriendlyError(schoolError, "errors.load")
            : "We couldn't find this school. It may have been removed.",
        );
        setLoading(false);
        return;
      }
      setSchool(schoolData as SchoolRecord);

      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("id, name, nickname, grade_level, scholarship, responsible_teacher_id")
        .eq("school_id", schoolId)
        .order("name");

      if (studentError) console.error("Error loading school students", studentError);
      const studentRows = (studentData ?? []) as any[];
      const studentIds = studentRows.map((student) => student.id as string);
      const teacherIds = Array.from(
        new Set(studentRows.map((student) => student.responsible_teacher_id).filter(Boolean)),
      ) as string[];

      const [{ data: profileData }, { data: reportData }] = await Promise.all([
        teacherIds.length
          ? supabase.from("profiles").select("id, full_name, email, phone").in("id", teacherIds)
          : Promise.resolve({ data: [], error: null }),
        studentIds.length
          ? supabase
              .from("term_updates")
              .select("student_id, report_date")
              .in("student_id", studentIds)
              .order("report_date", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      const profilesById = new Map<string, any>();
      (profileData ?? []).forEach((profile: any) => profilesById.set(profile.id, profile));

      // Teachers reach a school two ways: by supervising one of its students,
      // and by representing it on their own profile. The second needs the
      // school_id column from the teacher-profile migration, so a missing
      // column simply means nobody is linked that way yet.
      const schoolTeacherResult = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .eq("school_id", schoolId);

      if (schoolTeacherResult.error && !isMissingColumnError(schoolTeacherResult.error)) {
        console.error("Error loading school teachers", schoolTeacherResult.error);
      }

      setTeacherLinkSupported(!isMissingColumnError(schoolTeacherResult.error));

      const schoolTeachers = (schoolTeacherResult.data ?? []) as any[];
      schoolTeachers.forEach((profile) => {
        if (!profilesById.has(profile.id)) profilesById.set(profile.id, profile);
      });

      const allTeacherIds = Array.from(
        new Set([...teacherIds, ...schoolTeachers.map((profile) => profile.id as string)]),
      );

      // Latest report per student, and the set of students reporting in each period.
      const latestByStudent = new Map<string, string>();
      const byPeriod = new Map<string, Set<string>>();
      (reportData ?? []).forEach((report: any) => {
        if (!report.report_date) return;
        if (!latestByStudent.has(report.student_id)) {
          latestByStudent.set(report.student_id, report.report_date);
        }
        const period = periodOf(report.report_date);
        if (!byPeriod.has(period)) byPeriod.set(period, new Set());
        byPeriod.get(period)!.add(report.student_id);
      });

      const mappedStudents: StudentRow[] = studentRows.map((student) => ({
        id: student.id,
        name: student.name ?? "(no name)",
        displayId: shortId("ST", student.id),
        grade: student.grade_level || emptyValue(),
        teacherId: student.responsible_teacher_id ?? null,
        teacherName: student.responsible_teacher_id
          ? profilesById.get(student.responsible_teacher_id)?.full_name ?? "Teacher"
          : "Unassigned",
        scholarship: student.scholarship || "No scholarship recorded",
        lastReport: latestByStudent.get(student.id) ?? null,
      }));

      const mappedTeachers: TeacherRow[] = allTeacherIds.map((id) => {
        const profile = profilesById.get(id);
        const mine = mappedStudents.filter((student) => student.teacherId === id);
        const latest = mine
          .map((student) => student.lastReport)
          .filter(Boolean)
          .sort()
          .at(-1) as string | undefined;
        return {
          id,
          displayId: shortId("TC", id),
          name: profile?.full_name ?? "(no name)",
          email: profile?.email ?? emptyValue(),
          phone: profile?.phone ?? emptyValue(),
          studentCount: mine.length,
          lastActive: latest ?? null,
        };
      });

      const mappedFolders: ReportFolder[] = Array.from(byPeriod.entries())
        .map(([period, ids]) => ({
          key: period,
          period,
          submitted: ids.size,
          total: mappedStudents.length,
          latest:
            (reportData ?? [])
              .filter((report: any) => report.report_date && periodOf(report.report_date) === period)
              .map((report: any) => report.report_date)
              .sort()
              .at(-1) ?? null,
        }))
        .sort((a, b) => b.period.localeCompare(a.period));

      setStudents(mappedStudents);
      setTeachers(mappedTeachers);
      setFolders(mappedFolders);
      setLoading(false);
    };

    void load();
  }, [schoolId, reloadKey]);

  const profile: SchoolProfile | null = useMemo(
    () => (school ? deriveSchoolProfile(school) : null),
    [school],
  );

  const removeSchool = async () => {
    if (!schoolId) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from("schools").delete().eq("id", schoolId);
    if (deleteError) {
      console.error("Error removing school", deleteError);
      setError(
        students.length > 0
          ? "This school still has linked students. Reassign or remove them first."
          : toFriendlyError(deleteError, "errors.delete"),
      );
      setDeleting(false);
      return;
    }
    navigate("/admin/schools");
  };

  const studentColumns: DataColumn<StudentRow>[] = [
    { key: "displayId", label: "Reference", width: 120, muted: true },
    { key: "name", label: "Name", width: 200 },
    { key: "grade", label: "Grade", width: 90 },
    { key: "teacherName", label: "Teacher", width: 180 },
    { key: "scholarship", label: "Scholarship", width: 140 },
    {
      key: "lastReport",
      label: "Last report",
      width: 130,
      muted: true,
      render: (student) => asDate(student.lastReport),
    },
  ];

  const teacherColumns: DataColumn<TeacherRow>[] = [
    { key: "displayId", label: "Reference", width: 130, muted: true },
    { key: "name", label: "Name", width: 200 },
    { key: "email", label: "Email", width: 220 },
    { key: "phone", label: "Phone", width: 140 },
    { key: "studentCount", label: "Students", width: 100, numeric: true, align: "right" },
    {
      key: "lastActive",
      label: "Last report",
      width: 130,
      muted: true,
      render: (teacher) => asDate(teacher.lastActive),
    },
  ];

  if (loading) return <LoadingState />;

  if (error && !school) {
    return (
      <Stack className={styles.page}>
        <Text c="red">{error}</Text>
        <Group>
          <Button variant="secondary" onClick={() => navigate("/admin/schools")}>
            Back to schools
          </Button>
        </Group>
      </Stack>
    );
  }

  if (!school || !profile) return null;

  const unassigned = students.filter((student) => !student.teacherId).length;
  const reported = students.filter((student) => student.lastReport).length;

  const kpis: KpiItem[] = [
    { label: "Students recorded", value: String(students.length), mark: "students" },
    { label: "Teachers recorded", value: String(teachers.length), mark: "teachers" },
    { label: "Grade range", value: `${profile.gradeFrom} to ${profile.gradeTo}`, mark: "grade" },
    { label: "Dormitory", value: profile.dormitory, mark: "dormitory" },
    { label: "Reporting", value: `${reported}/${students.length || 0}`, mark: "reports" },
  ];

  const overviewSections: Array<{ title: string; fields: Array<[string, string, number]> }> = [
    {
      title: "Programme",
      fields: [
        ["School system", profile.system, 4],
        ["Grade range", `${profile.gradeFrom} to ${profile.gradeTo}`, 4],
        ["Dormitory status", profile.dormitory, 4],
        // A real, stored fact: every student here reports on this rhythm.
        ["Reporting period", reportingPeriodLabel(school.reporting_period_months), 4],
        ["Students recorded", String(students.length), 4],
        ["Teachers recorded", String(teachers.length), 4],
        ["Date joined iCare", profile.joined, 4],
      ],
    },
    {
      title: "School names",
      fields: [
        ["School name", school.name, 6],
        ["School code", profile.code, 6],
      ],
    },
    {
      title: "Address",
      fields: [
        ["Province", profile.province, 6],
        ["District", profile.district, 6],
        ["Address on record", school.address || "No address recorded", 12],
      ],
    },
    {
      title: "Principal",
      fields: [
        ["Principal", profile.principal, 4],
        ["Principal phone", profile.principalPhone, 4],
        ["Principal email", profile.principalEmail, 4],
      ],
    },
    {
      title: "Contact person",
      fields: [
        ["Contact person", profile.contact, 4],
        ["Contact phone", profile.contactPhone, 4],
        ["Contact email", profile.contactEmail, 4],
      ],
    },
  ];

  const activity = [
    students.length
      ? {
          title: "Roster on record",
          body: `${students.length} students and ${teachers.length} teachers linked to this school.`,
          when: "Current",
        }
      : null,
    unassigned
      ? {
          title: "Students without a teacher",
          body: `${unassigned} students have no responsible teacher assigned.`,
          when: "Needs action",
        }
      : null,
    folders.length
      ? {
          title: "Latest reporting cycle",
          body: `${folders[0].submitted} of ${folders[0].total} students submitted for ${folders[0].period}.`,
          when: asDate(folders[0].latest),
        }
      : null,
    { title: "School registered", body: `Joined the programme on ${profile.joined}.`, when: profile.joined },
  ].filter(Boolean) as Array<{ title: string; body: string; when: string }>;

  return (
    <Stack className={`${styles.page} ${styles.detailPage}`}>
      <Modal
        opened={confirmDelete}
        onClose={() => {
          if (deleting) return;
          setConfirmDelete(false);
          setError(null);
        }}
        title="Remove school?"
        centered
      >
        <Stack>
          <Text size="sm">
            Remove {school.name} from the programme? This can't be undone.
          </Text>
          {error && <Text size="sm" c="red">{error}</Text>}
          <Group justify="flex-end">
            <Button
              variant="ghost"
              disabled={deleting}
              onClick={() => {
                setConfirmDelete(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" disabled={deleting} onClick={removeSchool}>
              {deleting ? "Removing…" : "Remove school"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <header className={styles.detailHeader}>
        <div className={styles.detailIdentity}>
          <div className={styles.detailTitleRow}>
            <h1 className={styles.detailTitle}>{school.name}</h1>
            <span title="This status is an estimate. We don't record a status for each school yet.">
              <Badge tone={statusTone(profile.status)}>{profile.status}</Badge>
            </span>
          </div>
          <p className={styles.detailMeta}>
            <span>{profile.displayId}</span>
            <span className={styles.detailDot}>·</span>
            <span>code {profile.code}</span>
            <span className={styles.detailDot}>·</span>
            <span>{profile.system}</span>
          </p>
        </div>
        <div className={styles.detailActions}>
          <Menu position="bottom-end" withinPortal shadow="md" width={200}>
            <Menu.Target>
              <span>
                <Button variant="secondary" icon="plus" iconAfter="chevron-down">
                  Add
                </Button>
              </span>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => setStudentDrawerOpen(true)}>Add student</Menu.Item>
              <Menu.Item onClick={() => setTeacherDrawerOpen(true)}>Add teacher</Menu.Item>
              <Menu.Item onClick={() => navigate("/admin/reports/new")}>Add report</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Menu position="bottom-end" withinPortal shadow="md" width={200}>
            <Menu.Target>
              <span>
                <Button variant="ghost" icon="ellipsis" aria-label="More actions" />
              </span>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => navigate(`/admin/schools/${school.id}/edit`)}>
                Edit school
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" onClick={() => setConfirmDelete(true)}>
                Remove school
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </header>

      {justCreated && (
        <Banner
          tone="success"
          title="School created"
          action={
            <Button
              variant="ghost"
              onClick={() => {
                searchParams.delete("created");
                setSearchParams(searchParams, { replace: true });
              }}
            >
              Dismiss
            </Button>
          }
        >
          {school.name} is on the programme. Add the teachers who represent it and the students who
          attend it. Both forms open here with the school already filled in.
        </Banner>
      )}

      {notice && (
        <Banner
          tone={notice.tone}
          action={
            <Button variant="ghost" onClick={() => setNotice(null)}>
              Dismiss
            </Button>
          }
        >
          {notice.text}
        </Banner>
      )}

      <KpiRow items={kpis} />

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as TabValue)}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "teachers", label: "Teachers", count: teachers.length },
          { value: "students", label: "Students", count: students.length },
          { value: "reports", label: "Reports", count: folders.length },
        ]}
      />

      {tab === "overview" && (
        <>
          <Banner
            tone={students.length === 0 || teachers.length === 0 ? "warning" : "info"}
            title={
              students.length === 0 || teachers.length === 0
                ? "This school has no roster yet"
                : "Roster"
            }
            action={
              <Group gap="xs" wrap="nowrap">
                <Button variant="secondary" icon="plus" onClick={() => setTeacherDrawerOpen(true)}>
                  Add teacher
                </Button>
                <Button variant="primary" icon="plus" onClick={() => setStudentDrawerOpen(true)}>
                  Add student
                </Button>
              </Group>
            }
          >
            {teachers.length} teacher{teachers.length === 1 ? "" : "s"} and {students.length} student
            {students.length === 1 ? "" : "s"} are linked to {school.name}. Both forms open here with
            the school already selected.
            {!teacherLinkSupported &&
              " A teacher invited from here gets their invitation, but can't be linked to this school yet. They'll appear above once they look after one of its students."}
          </Banner>

          <div className={styles.detailOverview}>
          <div className={styles.detailFields}>
            {overviewSections.map((section) => (
              <section key={section.title}>
                <h2 className={styles.detailSectionTitle}>{section.title}</h2>
                <div className={styles.detailFieldGrid}>
                  {section.fields.map(([label, value, span]) => (
                    <div key={label} style={{ gridColumn: `span ${span}` }}>
                      <span className={styles.detailFieldLabel}>{label}</span>
                      <span className={styles.detailFieldValue}>{value}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className={styles.detailRail}>
            <div className={styles.detailPanel}>
              <h2 className={styles.detailPanelTitle}>Recent activity</h2>
              {activity.map((item) => (
                <div key={item.title} className={styles.detailActivity}>
                  <span className={styles.detailActivityTitle}>{item.title}</span>
                  <span className={styles.detailActivityBody}>{item.body}</span>
                  <span className={styles.detailActivityWhen}>{item.when}</span>
                </div>
              ))}
            </div>

            <div className={styles.detailPanel}>
              <h2 className={styles.detailPanelTitle}>Reports submitted</h2>
              {folders.length === 0 && (
                <p className={styles.detailEmpty}>No reports submitted for this school yet.</p>
              )}
              {folders.slice(0, 3).map((folder) => (
                <div key={folder.key} className={styles.detailReportRow}>
                  <div>
                    <span className={styles.detailActivityTitle}>{folder.period}</span>
                    <span className={styles.detailActivityWhen}>
                      {folder.submitted} of {folder.total} students
                    </span>
                  </div>
                  <Badge tone={folder.submitted >= folder.total ? "success" : "warning"}>
                    {folder.total ? Math.round((folder.submitted / folder.total) * 100) : 0}%
                  </Badge>
                </div>
              ))}
            </div>
            </aside>
          </div>
        </>
      )}

      {tab === "teachers" && (
        <TableSection
          columns={teacherColumns}
          rows={teachers}
          density="compact"
          pageSize={14}
          onRowClick={(teacher) => navigate(`/admin/teachers/${teacher.id}`)}
          emptyTitle="No teachers recorded for this school"
          emptyDescription={
            teacherLinkSupported
              ? "Teachers appear here once they represent this school or supervise one of its students."
              : "Teachers appear here once they look after a student at this school. Linking a teacher to a school directly isn't available yet."
          }
          emptyIcon="users"
        />
      )}

      {tab === "students" && (
        <TableSection
          columns={studentColumns}
          rows={students}
          density="compact"
          pageSize={14}
          onRowClick={(student) => navigate(`/admin/students/${student.id}`)}
          emptyTitle="No students recorded for this school"
          emptyDescription="Add a student and link them to this school."
          emptyIcon="graduation-cap"
        />
      )}

      {tab === "reports" && (
        <div className={styles.detailFolders}>
          {folders.length === 0 && (
            <p className={styles.detailEmpty}>
              No reporting cycles yet. Reports appear here once teachers submit term updates.
            </p>
          )}
          {folders.map((folder) => {
            const pct = folder.total ? Math.round((folder.submitted / folder.total) * 100) : 0;
            return (
              <button
                key={folder.key}
                type="button"
                className={styles.detailFolder}
                onClick={() => navigate("/admin/reports")}
              >
                <span className={styles.detailFolderHead}>
                  <Icon name="clipboard-list" size={18} />
                  <span className={styles.detailFolderTitle}>{folder.period}</span>
                </span>
                <span className={styles.detailActivityWhen}>
                  {folder.submitted} of {folder.total} students · latest {asDate(folder.latest)}
                </span>
                <span className={styles.detailProgressTrack}>
                  <span className={styles.detailProgressFill} style={{ width: `${pct}%` }} />
                </span>
                <span className={styles.detailActivityWhen}>{pct}% submitted</span>
              </button>
            );
          })}
        </div>
      )}

      <TeacherFormDrawer
        opened={teacherDrawerOpen}
        onClose={() => setTeacherDrawerOpen(false)}
        defaultSchoolId={school.id}
        lockSchool
        contextLabel={school.name}
        onCreated={(teacher) => {
          setTeacherDrawerOpen(false);
          setNotice(
            teacher.warning || !teacher.extended
              ? {
                  tone: "warning",
                  text:
                    teacher.warning ??
                    `The invitation for ${teacher.email} was sent, but we couldn't save the Thai name, LINE ID, school and notes yet. You can add them from the teacher's page later.`,
                }
              : {
                  tone: "success",
                  text: `An invitation email was requested for ${teacher.email}. They represent ${school.name}.`,
                },
          );
          setReloadKey((key) => key + 1);
        }}
      />

      <StudentFormDrawer
        opened={studentDrawerOpen}
        onClose={() => setStudentDrawerOpen(false)}
        defaultSchoolId={school.id}
        lockSchool
        contextLabel={school.name}
        onCreated={(student) => {
          setStudentDrawerOpen(false);
          setNotice({ tone: "success", text: `${student.name} was added to ${school.name}.` });
          setReloadKey((key) => key + 1);
        }}
      />
    </Stack>
  );
};

export default AdminSchoolDetailPage;
