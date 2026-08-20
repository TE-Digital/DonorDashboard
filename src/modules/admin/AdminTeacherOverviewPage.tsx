// src/modules/admin/AdminTeacherOverviewPage.tsx
//
// One teacher: their record, their roster, their reports.
//
// The Overview tab is also the edit screen. An admin presses Edit details and
// the same fields turn into the inputs from the add-teacher form — same order,
// same grouping, same validation — so there is one mental model of what a
// teacher record is, not a read view and an unrelated form.
//
// Reads and writes go through teacherProfile.ts, which falls back to the base
// columns when the teacher-profile migration has not been applied and tells the
// page so it can say what was dropped.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Group,
  MultiSelect,
  Select as MantineSelect,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useNavigate, useParams } from "react-router-dom";
import { ContactCell, InlineMessage, KpiRow, LoadingState } from "../../design-system";
import { AccessBadge, AccessMenu } from "./AccessActions";
import {
  ACCESS_META,
  EVENT_LABEL,
  accessStateOf,
  loadAccessEvents,
  loadAccessMap,
  type AccessEvent,
  type AccessRow,
} from "./userAccess";
import { Badge, Button, Tabs } from "../../design-system/lumen";
import { profileAvatarStyle, profileInitials } from "../../design-system/profileAvatar";
import { supabase } from "../../lib/supabaseClient";
import { SchoolFormDrawer } from "./SchoolFormDrawer";
import { StudentFormDrawer } from "./StudentFormDrawer";
import type { CreatedSchool } from "./SchoolForm";
import type { CreatedStudent } from "./StudentForm";
import {
  TEACHER_FIELDS_PENDING_NOTE,
  loadTeacherProfile,
  saveTeacherProfile,
  syncTeacherStudents,
  validateTeacherDetails,
  type TeacherDetailsInput,
  type TeacherProfile,
} from "./teacherProfile";
import styles from "./AdminDirectory.module.scss";

type TabValue = "overview" | "students" | "reports";
type Student = { id: string; name: string | null; grade_level: string | null; school_id: string | null };
type Report = { id: string; student_id: string; report_date: string | null; grade_text: string | null; info: string | null };
type School = { id: string; name: string | null };
/** Every student in the system — only loaded when the roster is being edited. */
type AssignableStudent = Student & { responsible_teacher_id: string | null };

const asDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "—";
const teacherId = (id: string) => `TC-${id.slice(0, 6).toUpperCase()}`;

/** The stored row, as the edit form holds it. */
const toDetails = (profile: TeacherProfile): TeacherDetailsInput => ({
  fullName: profile.full_name ?? "",
  fullNameTh: profile.full_name_th ?? "",
  email: profile.email ?? "",
  phone: profile.phone ?? "",
  lineId: profile.line_id ?? "",
  schoolId: profile.school_id ?? null,
  notes: profile.notes ?? "",
});

export const AdminTeacherOverviewPage: React.FC = () => {
  const { teacherId: routeTeacherId } = useParams<{ teacherId: string }>();
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [tab, setTab] = useState<TabValue>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** False when the profile columns the form writes are not in the database. */
  const [extended, setExtended] = useState(true);

  // ── Account access ──────────────────────────────────────────────────────
  // Sign-in state and what has already been sent. Read separately from the
  // profile because it lives in auth.users, not in the teacher's record.
  const [accessRow, setAccessRow] = useState<AccessRow | null>(null);
  const [accessAvailable, setAccessAvailable] = useState(false);
  const [accessEvents, setAccessEvents] = useState<AccessEvent[]>([]);

  // ── Edit state ──────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TeacherDetailsInput | null>(null);
  const [draftStudentIds, setDraftStudentIds] = useState<string[]>([]);
  const [assignable, setAssignable] = useState<AssignableStudent[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [schoolDrawerOpen, setSchoolDrawerOpen] = useState(false);
  const [studentDrawerOpen, setStudentDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!routeTeacherId) {
      setError("Missing teacher ID.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const { profile, extended: extendedAvailable, error: profileError } =
      await loadTeacherProfile(routeTeacherId);
    setExtended(extendedAvailable);

    if (profileError || !profile) {
      setError(profileError ?? "Teacher not found.");
      setLoading(false);
      return;
    }
    setTeacher(profile);

    const { data: studentRows, error: studentError } = await supabase
      .from("students")
      .select("id, name, grade_level, school_id")
      .eq("responsible_teacher_id", routeTeacherId)
      .order("name");
    if (studentError) console.error("Error loading teacher students", studentError);
    const nextStudents = (studentRows ?? []) as Student[];
    setStudents(nextStudents);
    const studentIds = nextStudents.map((student) => student.id);

    // The teacher's own school is shown alongside the schools their students
    // attend, so the header school never disappears from the lookup.
    const schoolIds = Array.from(
      new Set([...nextStudents.map((student) => student.school_id), profile.school_id].filter(Boolean)),
    ) as string[];

    const [reportResult, schoolResult] = await Promise.all([
      studentIds.length
        ? supabase.from("term_updates").select("id, student_id, report_date, grade_text, info").in("student_id", studentIds).order("report_date", { ascending: false })
        : Promise.resolve({ data: [] }),
      schoolIds.length
        ? supabase.from("schools").select("id, name").in("id", schoolIds)
        : Promise.resolve({ data: [] }),
    ]);
    setReports((reportResult.data ?? []) as Report[]);
    setSchools((schoolResult.data ?? []) as School[]);

    const [accessMap, events] = await Promise.all([
      loadAccessMap(),
      loadAccessEvents(routeTeacherId),
    ]);
    setAccessAvailable(accessMap.available);
    setAccessRow(accessMap.byUser[routeTeacherId] ?? null);
    setAccessEvents(events);

    setLoading(false);
  }, [routeTeacherId]);

  useEffect(() => {
    void load();
  }, [load]);

  const schoolById = useMemo(
    () => new Map([...schools, ...allSchools].map((school) => [school.id, school.name || "—"])),
    [schools, allSchools],
  );

  const latestByStudent = useMemo(() => {
    const result = new Map<string, Report>();
    reports.forEach((report) => {
      if (!result.has(report.student_id)) result.set(report.student_id, report);
    });
    return result;
  }, [reports]);

  /**
   * Enters edit mode. The full school and student lists are only fetched here —
   * a read-only visit to this page has no use for either.
   */
  const startEditing = async () => {
    if (!teacher) return;
    setSaveError(null);
    setSaveNote(null);
    setDraft(toDetails(teacher));
    setDraftStudentIds(students.map((student) => student.id));
    setTab("overview");
    setEditing(true);

    // Seed both pickers with what this page already knows, so the school and
    // the assigned students render as themselves rather than as blanks and raw
    // ids while the full lists are still in flight.
    setAllSchools((current) => (current.length ? current : schools));
    setAssignable((current) =>
      current.length
        ? current
        : students.map((student) => ({ ...student, responsible_teacher_id: teacher.id })),
    );

    const [schoolResult, studentResult] = await Promise.all([
      supabase.from("schools").select("id, name").order("name"),
      supabase.from("students").select("id, name, grade_level, school_id, responsible_teacher_id").order("name"),
    ]);
    if (schoolResult.error) console.error("Error loading schools", schoolResult.error);
    if (studentResult.error) console.error("Error loading students", studentResult.error);
    setAllSchools((schoolResult.data ?? []) as School[]);
    setAssignable((studentResult.data ?? []) as AssignableStudent[]);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraft(null);
    setSaveError(null);
  };

  const setField = <K extends keyof TeacherDetailsInput>(key: K, value: TeacherDetailsInput[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  const handleSchoolCreated = (school: CreatedSchool) => {
    setAllSchools((current) =>
      [...current, school].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    );
    setField("schoolId", school.id);
    setSchoolDrawerOpen(false);
  };

  const handleStudentCreated = (student: CreatedStudent) => {
    setAssignable((current) =>
      [...current, { ...student, responsible_teacher_id: null }].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? ""),
      ),
    );
    setDraftStudentIds((current) => [...current, student.id]);
    setStudentDrawerOpen(false);
  };

  const save = async () => {
    if (!teacher || !draft) return;

    const validationError = validateTeacherDetails(draft);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveNote(null);

    const result = await saveTeacherProfile(teacher.id, draft);
    if (result.error) {
      setSaveError(result.error);
      setSaving(false);
      return;
    }

    const assignError = await syncTeacherStudents(
      teacher.id,
      draftStudentIds,
      students.map((student) => student.id),
    );
    setSaving(false);

    if (assignError) {
      setSaveError(`The details were saved, but the student roster could not be updated: ${assignError}`);
      return;
    }

    setEditing(false);
    setDraft(null);
    setSaveNote(result.extended ? "Teacher details saved." : TEACHER_FIELDS_PENDING_NOTE);
    await load();
  };

  if (loading) return <LoadingState />;
  if (error || !teacher) {
    return (
      <Stack className={styles.page}>
        <Text c="red">{error ?? "Teacher not found."}</Text>
        <Group>
          <Button variant="secondary" onClick={() => navigate("/admin/teachers")}>
            Back to teachers
          </Button>
        </Group>
      </Stack>
    );
  }

  const reportedStudents = latestByStudent.size;
  const latestReport = reports[0] ?? null;
  const teacherSchoolName = teacher.school_id ? schoolById.get(teacher.school_id) ?? "—" : "—";

  const overviewSections: Array<{ title: string; fields: Array<[string, string, number]> }> = [
    {
      title: "Account details",
      fields: [
        ["Teacher ID", teacherId(teacher.id), 4],
        ["Full name (English)", teacher.full_name || "—", 4],
        ["Full name (Thai)", teacher.full_name_th || "—", 4],
        ["Joined", asDate(teacher.created_at), 4],
        ["Role", "Teacher", 4],
        ["Email confirmation", "Backend status tracking pending", 4],
      ],
    },
    {
      title: "Contact details",
      fields: [
        ["Email address", teacher.email || "—", 4],
        ["Phone number", teacher.phone || "—", 4],
        ["LINE ID", teacher.line_id || "—", 4],
      ],
    },
    {
      title: "Teaching assignment",
      fields: [
        ["School represented", teacherSchoolName, 4],
        ["Assigned students", String(students.length), 4],
        ["Students with a report", `${reportedStudents}/${students.length || 0}`, 4],
        ["Schools of assigned students", String(schools.length), 4],
      ],
    },
    {
      title: "Notes",
      fields: [["Admin notes", teacher.notes || "No notes recorded.", 12]],
    },
  ];

  const activity = [
    latestReport ? { title: "Latest report submitted", body: latestReport.grade_text || latestReport.info || "Term update recorded.", when: asDate(latestReport.report_date) } : null,
    students.length ? { title: "Current roster", body: `${students.length} student${students.length === 1 ? "" : "s"} assigned across ${schools.length} school${schools.length === 1 ? "" : "s"}.`, when: "Current" } : null,
    { title: "Teacher record created", body: "The teacher was added to the directory.", when: asDate(teacher.created_at) },
  ].filter(Boolean) as Array<{ title: string; body: string; when: string }>;

  const accessState = accessAvailable ? accessStateOf(accessRow) : "unknown";
  const lastSent = accessRow?.last_invite_at ?? accessRow?.invited_at ?? null;

  /** Selected students who currently answer to somebody else. */
  const reassigned = assignable.filter(
    (student) =>
      draftStudentIds.includes(student.id) &&
      student.responsible_teacher_id &&
      student.responsible_teacher_id !== teacher.id,
  );

  const studentOptions = assignable.map((student) => {
    const parts = [student.name || "(no name)"];
    if (student.grade_level) parts.push(`Class ${student.grade_level}`);
    if (student.school_id) parts.push(schoolById.get(student.school_id) ?? "School");
    return { value: student.id, label: parts.join(" · ") };
  });

  return (
    <Stack className={`${styles.page} ${styles.detailPage}`}>
      <header className={`${styles.detailHeader} ${editing ? styles.detailHeaderSticky : ""}`}>
        <div className={styles.studentIdentity}>
          <Avatar size={56} style={profileAvatarStyle(teacher.id)} className={styles.profileAvatar}>{profileInitials(teacher.full_name)}</Avatar>
          <div className={styles.detailIdentity}>
            <div className={styles.detailTitleRow}>
              <h1 className={styles.detailTitle}>{teacher.full_name || "(no name)"}</h1>
              <Badge tone="info">Teacher</Badge>
            </div>
            <p className={styles.detailMeta}>
              <span>{teacherId(teacher.id)}</span>
              <span className={styles.detailDot}>·</span>
              <span>{teacher.email || "No email recorded"}</span>
              <ContactCell
                email={teacher.email}
                phone={teacher.phone}
                line={teacher.line_id}
                owner={teacher.full_name || "This teacher"}
                channels={["email", "phone", "line"]}
              />
              {teacher.full_name_th && (
                <>
                  <span className={styles.detailDot}>·</span>
                  <span>{teacher.full_name_th}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className={styles.detailActions}>
          {editing ? (
            <>
              <Button variant="ghost" onClick={cancelEditing} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" icon="pencil" onClick={() => void startEditing()}>
                Edit details
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/admin/teachers/${teacher.id}/students`)}>
                Manage students
              </Button>
              <Button variant="primary" icon="plus" onClick={() => navigate(`/admin/students/new?teacherUserId=${teacher.id}`)}>
                Add student
              </Button>
            </>
          )}
        </div>
      </header>

      {!extended && <InlineMessage tone="warning">{TEACHER_FIELDS_PENDING_NOTE}</InlineMessage>}
      {saveNote && !editing && <InlineMessage tone="success">{saveNote}</InlineMessage>}

      <KpiRow items={[
        { label: "Assigned students", value: String(students.length), mark: "students" },
        { label: "Schools", value: String(schools.length), mark: "schools" },
        { label: "Reports submitted", value: String(reports.length), mark: "reports" },
        { label: "Students reporting", value: `${reportedStudents}/${students.length || 0}`, mark: "ontrack" },
      ]} />

      <Tabs value={tab} onChange={(value) => setTab(value as TabValue)} tabs={[
        { value: "overview", label: "Overview" },
        { value: "students", label: "Students", count: students.length, disabled: editing },
        { value: "reports", label: "Reports", count: reports.length, disabled: editing },
      ]} />

      {tab === "overview" && !editing && <div className={styles.detailOverview}>
        <div className={styles.detailFields}>{overviewSections.map((section) => <section key={section.title}><h2 className={styles.detailSectionTitle}>{section.title}</h2><div className={styles.detailFieldGrid}>{section.fields.map(([label, value, span]) => <div key={label} style={{ gridColumn: `span ${span}` }}><span className={styles.detailFieldLabel}>{label}</span><span className={styles.detailFieldValue}>{value}</span></div>)}</div></section>)}</div>
        <aside className={styles.detailRail}>
          <div className={styles.detailPanel}>
            <h2 className={styles.detailPanelTitle}>Account access</h2>
            <div className={styles.accessPanel}>
              <AccessBadge state={accessState} inviteCount={accessRow?.invite_count} />
              <p className={styles.detailActivityBody}>{ACCESS_META[accessState].hint}</p>
              {lastSent && (
                <span className={styles.detailActivityWhen}>Last link sent {asDate(lastSent)}</span>
              )}
              <AccessMenu
                userId={teacher.id}
                name={teacher.full_name || "this teacher"}
                email={teacher.email}
                access={accessRow}
                available={accessAvailable}
                variant="buttons"
                onChanged={() => void load()}
              />
              {accessEvents.length > 0 && (
                <div className={styles.accessHistory}>
                  {accessEvents.map((event) => (
                    <div key={event.id} className={styles.detailActivity}>
                      <span className={styles.detailActivityTitle}>
                        {EVENT_LABEL[event.action] ?? event.action}
                      </span>
                      <span className={styles.detailActivityBody}>
                        {event.channel === "clipboard"
                          ? "Copied to send another way"
                          : "Sent by email"}
                        {event.actor_name ? ` · ${event.actor_name}` : ""}
                      </span>
                      <span className={styles.detailActivityWhen}>{asDate(event.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={styles.detailPanel}><h2 className={styles.detailPanelTitle}>Recent activity</h2>{activity.map((item) => <div key={item.title} className={styles.detailActivity}><span className={styles.detailActivityTitle}>{item.title}</span><span className={styles.detailActivityBody}>{item.body}</span><span className={styles.detailActivityWhen}>{item.when}</span></div>)}</div>
        </aside>
      </div>}

      {tab === "overview" && editing && draft && (
        <div className={styles.detailFields}>
          <LoadingState variant="overlay" visible={saving} />

          {saveError && <InlineMessage tone="error">{saveError}</InlineMessage>}

          <section>
            <h2 className={styles.detailSectionTitle}>Teacher name</h2>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <TextInput
                label="Full name (English)"
                required
                value={draft.fullName}
                onChange={(event) => setField("fullName", event.currentTarget.value)}
              />
              <TextInput
                label="Full name (Thai)"
                required
                placeholder="เช่น อารยา สุขใจ"
                value={draft.fullNameTh}
                onChange={(event) => setField("fullNameTh", event.currentTarget.value)}
              />
            </SimpleGrid>
          </section>

          <section>
            <h2 className={styles.detailSectionTitle}>Contact details</h2>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
              <TextInput
                label="Email address"
                required
                type="email"
                description="Updates the directory record. The sign-in address is changed from Users & roles."
                value={draft.email}
                onChange={(event) => setField("email", event.currentTarget.value)}
              />
              <TextInput
                label="Phone number"
                required
                placeholder="08x xxx xxxx"
                value={draft.phone}
                onChange={(event) => setField("phone", event.currentTarget.value)}
              />
              <TextInput
                label="LINE ID"
                required
                placeholder="@teacher-line-id"
                value={draft.lineId}
                onChange={(event) => setField("lineId", event.currentTarget.value)}
              />
            </SimpleGrid>
          </section>

          <section>
            <h2 className={styles.detailSectionTitle}>School</h2>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <MantineSelect
                label="School represented"
                placeholder="Select school"
                required
                searchable
                clearable
                nothingFoundMessage="No school matches — create it instead"
                data={allSchools.map((school) => ({ value: school.id, label: school.name ?? "(no name)" }))}
                value={draft.schoolId}
                onChange={(value) => setField("schoolId", value)}
              />
              <div className={styles.fieldAction}>
                <Button variant="secondary" icon="plus" onClick={() => setSchoolDrawerOpen(true)}>
                  Create school
                </Button>
              </div>
            </SimpleGrid>
          </section>

          <section>
            <h2 className={styles.detailSectionTitle}>Students</h2>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <MultiSelect
                label="Assigned students"
                placeholder={draftStudentIds.length ? undefined : "Search students by name"}
                searchable
                clearable
                hidePickedOptions
                nothingFoundMessage="No student matches — create them instead"
                description="Unticking a student leaves them without a responsible teacher."
                data={studentOptions}
                value={draftStudentIds}
                onChange={setDraftStudentIds}
              />
              <div className={styles.fieldAction}>
                <Button variant="secondary" icon="plus" onClick={() => setStudentDrawerOpen(true)}>
                  Create student
                </Button>
              </div>
            </SimpleGrid>

            {reassigned.length > 0 && (
              <div className={styles.sectionNote}>
                <InlineMessage tone="warning">
                  {reassigned.length} selected student{reassigned.length === 1 ? " is" : "s are"}{" "}
                  currently assigned to another teacher and will be moved:{" "}
                  {reassigned.map((student) => student.name || "(no name)").join(", ")}.
                </InlineMessage>
              </div>
            )}
          </section>

          <section>
            <h2 className={styles.detailSectionTitle}>Notes</h2>
            <Textarea
              label="Admin notes"
              minRows={4}
              placeholder="Languages spoken, travel constraints, preferred contact time…"
              value={draft.notes}
              onChange={(event) => setField("notes", event.currentTarget.value)}
            />
          </section>

        </div>
      )}

      {tab === "students" && <div className={styles.detailSimpleList}>
        {students.length === 0 ? <p className={styles.detailEmpty}>No students assigned to this teacher yet.</p> : students.map((student) => <button key={student.id} type="button" className={`${styles.detailListRow} ${styles.detailListRowButton}`} onClick={() => navigate(`/admin/students/${student.id}`)}><div><span className={styles.detailActivityTitle}>{student.name || "(no name)"}</span><span className={styles.detailActivityBody}>Class {student.grade_level || "not assigned"} · {student.school_id ? schoolById.get(student.school_id) || "School" : "No school"}</span></div><span className={styles.detailActivityWhen}>{asDate(latestByStudent.get(student.id)?.report_date ?? null)}</span></button>)}</div>}

      {tab === "reports" && <div className={styles.detailSimpleList}>
        {reports.length === 0 ? <p className={styles.detailEmpty}>No reports submitted by this teacher yet.</p> : reports.map((report) => <div key={report.id} className={styles.detailListRow}><div><span className={styles.detailActivityTitle}>{students.find((student) => student.id === report.student_id)?.name || "Student"}</span><span className={styles.detailActivityBody}>{report.grade_text || report.info || "Term update"}</span></div><span className={styles.detailActivityWhen}>{asDate(report.report_date)}</span></div>)}</div>}

      <SchoolFormDrawer
        opened={schoolDrawerOpen}
        onClose={() => setSchoolDrawerOpen(false)}
        onCreated={handleSchoolCreated}
      />

      <StudentFormDrawer
        opened={studentDrawerOpen}
        onClose={() => setStudentDrawerOpen(false)}
        defaultSchoolId={draft?.schoolId ?? null}
        defaultTeacherId={teacher.id}
        onCreated={handleStudentCreated}
      />
    </Stack>
  );
};

export default AdminTeacherOverviewPage;
