// src/modules/admin/AdminStudentOverviewPage.tsx
//
// One student's record.
//
// The four KPIs answer the four things somebody opens this page to find out:
// how complete is the record, where is the reporting, who is paying, who is
// responsible. School and grade are not among them — they are in the meta line
// under the name, where they identify the student rather than measure them.
//
// The body is grouped exactly like the add-student form. An admin who filled
// that form in recognises this page, and a field is never in a group here that
// it is not in there.
//
// Two things are deliberately separate. **Notes** is where somebody writes a
// sentence on purpose and reads what colleagues wrote; the **activity log** is
// everything that happened, in order, including every one of those notes. And
// the **donor profile** is its own tab with its own three fields, because a
// card assembled by hiding parts of this page is one edit away from leaking an
// address.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, Menu, Modal, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ContactCell, KpiRow, LoadingState } from "../../design-system";
import { Badge, Button, Icon, IconButton, Tabs } from "../../design-system/lumen";
import { profileAvatarStyle, profileInitials } from "../../design-system/profileAvatar";
import { supabase } from "../../lib/supabaseClient";
import { ReportList, loadCycleReports, reportCycle, type CycleReport } from "../reports";
import { DonorProfileTab } from "./DonorProfileTab";
import { ProfileCompletionBar } from "./ProfileCompletionBar";
import {
  EVENT_ICON,
  addNote,
  deleteNote,
  editNote,
  loadEvents,
  loadNotes,
  setStudentStatus,
  type StudentEvent,
  type StudentNote,
} from "./studentEvents";
import {
  STUDENT_LIFECYCLE_PENDING_NOTE,
  STUDENT_STATUS_META,
  loadStudentRecord,
  profileCompletion,
  studentPhotoUrl,
  uploadStudentPhoto,
  type StudentRecord,
  type StudentStatus,
} from "./studentProfile";
import { reportingPeriodMonths } from "./schoolProfile";
import styles from "./AdminDirectory.module.scss";

/** The student's school, with the reporting period it sets for them. */
const loadSchoolWithPeriod = async (schoolId: string) => {
  const withPeriod = await supabase
    .from("schools")
    .select("id, name, reporting_period_months")
    .eq("id", schoolId)
    .maybeSingle();

  if (!withPeriod.error) return withPeriod;

  return supabase.from("schools").select("id, name").eq("id", schoolId).maybeSingle();
};

type TabValue = "overview" | "scholarships" | "reports" | "donor";

const TAB_VALUES: TabValue[] = ["overview", "scholarships", "reports", "donor"];

/** A ?tab= that names a real tab, so a link can point at one. Anything else opens the record as normal. */
const tabFromUrl = (value: string | null): TabValue =>
  TAB_VALUES.includes(value as TabValue) ? (value as TabValue) : "overview";

type School = { id: string; name: string; reporting_period_months?: number | null };
type Teacher = { id: string; full_name: string | null };
type Award = {
  id: string;
  period_start: string | null;
  period_end: string | null;
  amount_for_period: number | null;
  currency: string | null;
  status: string | null;
  is_paid: boolean | null;
  payment_date: string | null;
  grant_types?: { name: string | null } | null;
};

const date = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(value),
      )
    : "—";

const dateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const shortId = (id: string) => `ST-${id.slice(0, 6).toUpperCase()}`;

const amount = (value: number | null, currency: string | null) =>
  value == null ? "—" : `${value.toLocaleString()} ${currency ?? "THB"}`.trim();

/** How many timeline entries the rail shows before "View all activity". */
const TIMELINE_PREVIEW = 8;

export const AdminStudentOverviewPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [awards, setAwards] = useState<Award[]>([]);
  const [reports, setReports] = useState<CycleReport[]>([]);
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [events, setEvents] = useState<StudentEvent[]>([]);

  // A row menu elsewhere ("Change funding") links straight to a tab on this
  // record, so the tab is addressable rather than always opening on Overview.
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTabState] = useState<TabValue>(() => tabFromUrl(searchParams.get("tab")));

  /** Keeps the URL and the open tab saying the same thing, without a history entry per click. */
  const setTab = React.useCallback(
    (next: TabValue) => {
      setTabState(next);
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (next === "overview") params.delete("tab");
          else params.set("tab", next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** The field the completion KPI has jumped to, highlighted until it is left. */
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [allActivity, setAllActivity] = useState(false);
  /** False until the lifecycle migration is applied. */
  const [lifecycle, setLifecycle] = useState(true);

  const [noteDraft, setNoteDraft] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const photoInput = React.useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const load = useCallback(async () => {
    if (!studentId) {
      setError("Missing student ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const read = await loadStudentRecord(studentId);
    setLifecycle(read.extended);

    if (read.error || !read.data) {
      setError(read.error ?? "This student could not be opened. The record may have been deleted.");
      setLoading(false);
      return;
    }

    const record = read.data;
    setStudent(record);

    const [schoolResult, teacherResult, awardResult, reportResult, noteRows, eventRows] =
      await Promise.all([
        record.school_id
          ? loadSchoolWithPeriod(record.school_id)
          : Promise.resolve({ data: null }),
        record.responsible_teacher_id
          ? supabase
              .from("profiles")
              .select("id, full_name")
              .eq("id", record.responsible_teacher_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("scholarship_awards")
          .select(
            "id, period_start, period_end, amount_for_period, currency, status, is_paid, payment_date, grant_types(name)",
          )
          .eq("student_id", studentId)
          .order("period_start", { ascending: false }),
        loadCycleReports(supabase, [studentId]),
        loadNotes(studentId),
        loadEvents(studentId),
      ]);

    setSchool((schoolResult.data as School | null) ?? null);
    setTeacher((teacherResult.data as Teacher | null) ?? null);
    // The generated relationship type calls this to-one join an array; the
    // screen consumes the to-one shape the rest of the app already uses.
    setAwards((awardResult.data ?? []) as unknown as Award[]);
    setReports(reportResult.byStudent.get(studentId) ?? []);
    setNotes(noteRows);
    setEvents(eventRows);

    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const completion = useMemo(
    () => (student ? profileCompletion(student) : null),
    [student],
  );

  const cycle = useMemo(
    () =>
      reportCycle(
        reports,
        student?.enrolled_on ?? student?.created_at ?? null,
        new Date(),
        // The school owns the rhythm; the student follows it.
        reportingPeriodMonths(school),
      ),
    [reports, student, school],
  );

  /** One scholarship per student: the active award, or the most recent one. */
  const scholarship = useMemo(
    () => awards.find((award) => award.status?.toLowerCase() === "active") ?? awards[0] ?? null,
    [awards],
  );

  /**
   * Scrolls to the first field that is not filled in, and marks it.
   *
   * The KPI says a record is 73% complete; the useful next step is being taken
   * to the missing 27%, not being told to go and find it.
   */
  const jumpToFirstMissing = () => {
    if (!completion?.missing.length) return;
    const target = completion.missing[0];
    setTab("overview");
    setHighlighted(target.key);
    requestAnimationFrame(() => {
      document
        .getElementById(`field-${target.key}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    window.setTimeout(() => setHighlighted(null), 4000);
  };

  const submitNote = async () => {
    if (!studentId) return;
    setNoteBusy(true);
    setNoteError(null);
    const problem = await addNote(studentId, noteDraft);
    setNoteBusy(false);

    if (problem) {
      setNoteError(problem);
      return;
    }

    setNoteDraft("");
    setNotes(await loadNotes(studentId));
    setEvents(await loadEvents(studentId));
  };

  const saveEditedNote = async (noteId: string) => {
    if (!studentId) return;
    setNoteBusy(true);
    const problem = await editNote(noteId, studentId, editDraft);
    setNoteBusy(false);

    if (problem) {
      setNoteError(problem);
      return;
    }

    setEditingNote(null);
    setNotes(await loadNotes(studentId));
    setEvents(await loadEvents(studentId));
  };

  const removeNote = async (noteId: string) => {
    if (!studentId) return;
    const problem = await deleteNote(noteId, studentId);
    if (problem) {
      setNoteError(problem);
      return;
    }
    setNotes(await loadNotes(studentId));
    setEvents(await loadEvents(studentId));
  };

  const changeStatus = async (next: StudentStatus) => {
    if (!student) return;
    setArchiving(true);
    const problem = await setStudentStatus(student.id, next, student.name);
    setArchiving(false);
    setConfirmingArchive(false);

    if (problem) {
      notifications.show({
        title: "Nothing changed",
        message: problem,
        color: "red",
        icon: <Icon name="circle-alert" size={16} />,
        withBorder: true,
      });
      return;
    }

    notifications.show({
      title: next === "archived" ? "Student archived" : "Student restored",
      message:
        next === "archived"
          ? `${student.name} is out of the working lists. Every record about them is kept.`
          : `${student.name} is back in the programme.`,
      color: "green",
      icon: <Icon name="check" size={16} />,
      withBorder: true,
    });

    await load();
  };

  const replacePhoto = async (file: File) => {
    if (!student) return;
    setUploadingPhoto(true);
    const result = await uploadStudentPhoto(student.id, file);
    setUploadingPhoto(false);

    if (result.error) {
      notifications.show({
        title: "The photo did not save",
        message: result.error,
        color: "red",
        icon: <Icon name="circle-alert" size={16} />,
        withBorder: true,
      });
      return;
    }

    await load();
  };

  if (loading) return <LoadingState />;

  if (error || !student || !completion) {
    return (
      <Stack className={styles.page}>
        <Text c="red">{error ?? "Student not found."}</Text>
        <Button variant="secondary" onClick={() => navigate("/admin/students")}>
          Back to students
        </Button>
      </Stack>
    );
  }

  const status = (student.status as StudentStatus) ?? "enrolled";
  const contact = student.contact ?? {};
  const photoUrl = studentPhotoUrl(student.profile_photo_path);

  /** A field on the record, with its anchor and its missing state. */
  const field = (
    key: string,
    label: string,
    value: React.ReactNode,
    span: number,
    missing = false,
  ) => ({ key, label, value, span, missing });

  const missingKeys = new Set(completion.missing.map((entry) => entry.key));
  const gap = (key: string) => missingKeys.has(key);

  const sections: Array<{
    title: string;
    fields: Array<{ key: string; label: string; value: React.ReactNode; span: number; missing: boolean }>;
  }> = [
    {
      title: "Personal details",
      fields: [
        field("nickname", "Nickname", student.nickname || null, 4, gap("nickname")),
        field("birthdate", "Birthdate", student.birthdate ? date(student.birthdate) : null, 4, gap("birthdate")),
        field("village", "Village", student.village || null, 4, gap("village")),
        field("guardian", "Guardian name", contact.guardian || null, 4, gap("guardian")),
        field("relationship", "Relationship to student", contact.relationship || null, 4, gap("relationship")),
        field(
          "phone",
          "Phone",
          contact.phone ? (
            <span className={styles.profileName}>
              {contact.phone}
              <ContactCell
                phone={contact.phone}
                owner={contact.guardian ? `${contact.guardian} · ${student.name}` : student.name}
                channels={["phone"]}
                labels={{ phone: "Copy guardian's phone number" }}
              />
            </span>
          ) : null,
          4,
          gap("phone"),
        ),
        field("address", "Address", contact.address || null, 6, gap("address")),
        field("line", "LINE / WhatsApp", contact.line_or_whatsapp || null, 6, gap("line")),
        field("bio", "Short bio", student.bio || null, 12, gap("bio")),
      ],
    },
    {
      title: "School",
      fields: [
        field(
          "school",
          "School",
          school ? (
            <Link className={styles.recordLink} to={`/admin/schools/${school.id}`}>
              {school.name}
            </Link>
          ) : null,
          6,
          gap("school"),
        ),
        field("grade", "Grade level", student.grade_level || null, 6, gap("grade")),
      ],
    },
    {
      title: "Teacher and support",
      fields: [
        field(
          "teacher",
          "Responsible teacher",
          teacher ? (
            <Link className={styles.profileName} to={`/admin/teachers/${teacher.id}`}>
              <Avatar size={24} style={profileAvatarStyle(teacher.id)}>
                {profileInitials(teacher.full_name)}
              </Avatar>
              {teacher.full_name || "(no name)"}
            </Link>
          ) : null,
          6,
          gap("teacher"),
        ),
        field(
          "support",
          "Monthly support expected",
          student.monthly_support_expected != null
            ? `${student.monthly_support_expected.toLocaleString()} THB`
            : null,
          6,
          gap("support"),
        ),
      ],
    },
  ];

  const timeline = allActivity ? events : events.slice(0, TIMELINE_PREVIEW);

  return (
    <Stack className={`${styles.page} ${styles.detailPage}`}>
      <header className={styles.detailHeader}>
        <div className={styles.studentIdentity}>
          {/* The photo is optional at creation, so it is addable here — hovering
              the portrait is where somebody looks for that. */}
          <button
            type="button"
            className={styles.photoEditable}
            onClick={() => photoInput.current?.click()}
            aria-label={photoUrl ? "Replace the student's photo" : "Add a photo for this student"}
            title={photoUrl ? "Replace photo" : "Add photo"}
          >
            <Avatar
              size={56}
              radius="xl"
              src={photoUrl ?? undefined}
              style={profileAvatarStyle(student.id)}
              className={styles.profileAvatar}
            >
              {profileInitials(student.name)}
            </Avatar>
            <span className={styles.photoOverlay}>
              <Icon name={uploadingPhoto ? "clock" : "pencil"} size={15} />
            </span>
          </button>
          <input
            ref={photoInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className={styles.photoInput}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void replacePhoto(file);
            }}
          />

          <div className={styles.detailIdentity}>
            <div className={styles.detailTitleRow}>
              <h1 className={styles.detailTitle}>{student.name}</h1>
              {student.nickname && <span className={styles.detailNickname}>“{student.nickname}”</span>}
              <Badge tone={STUDENT_STATUS_META[status].tone} dot>
                {STUDENT_STATUS_META[status].label}
              </Badge>
              {scholarship && <Badge tone="info">Scholarship</Badge>}
            </div>
            <p className={styles.detailMeta}>
              <span>{shortId(student.id)}</span>
              <span className={styles.detailDot}>·</span>
              <span>Grade {student.grade_level || "not assigned"}</span>
              <span className={styles.detailDot}>·</span>
              {school ? (
                <Link className={styles.recordLink} to={`/admin/schools/${school.id}`}>
                  {school.name}
                </Link>
              ) : (
                <span>No school assigned</span>
              )}
            </p>
          </div>
        </div>

        <div className={styles.detailActions}>
          {/* Editing is the common action, not the loud one: the page is for
              reading, and a filled button here would out-shout the record. */}
          <Button
            variant="secondary"
            icon="pencil"
            onClick={() => navigate(`/admin/students/${student.id}/edit`)}
          >
            Edit student
          </Button>

          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <span>
                <IconButton icon="ellipsis" label="More actions" tone="bordered" />
              </span>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<Icon name="clipboard-list" size={15} />}
                onClick={() => setTab("reports")}
              >
                Add a report
              </Menu.Item>
              <Menu.Item
                leftSection={<Icon name="send" size={15} />}
                onClick={() => setTab("donor")}
              >
                Donor profile
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                disabled={!lifecycle}
                title={lifecycle ? undefined : STUDENT_LIFECYCLE_PENDING_NOTE}
                leftSection={<Icon name={status === "archived" ? "refresh-cw" : "inbox"} size={15} />}
                onClick={() =>
                  status === "archived" ? void changeStatus("enrolled") : setConfirmingArchive(true)
                }
              >
                {status === "archived" ? "Restore student" : "Archive student"}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </header>

      {!lifecycle && (
        <div className={styles.archivedBanner}>
          <Icon name="triangle-alert" size={15} />
          <span>{STUDENT_LIFECYCLE_PENDING_NOTE}</span>
        </div>
      )}

      {status === "archived" && (
        <div className={styles.archivedBanner}>
          <Icon name="inbox" size={15} />
          <span>
            This student is archived. Their reports, scholarships and history are kept, and they are
            hidden from the working lists. Restore them from the ⋯ menu.
          </span>
        </div>
      )}

      {/* Four, and only four: how complete, where the reporting is, who pays,
          who is responsible. School and grade are in the meta line above. */}
      <KpiRow
        items={[
          {
            label: "Profile completion",
            mark: "accounts",
            // Compact, not full: the full bar carries a 120px minimum track,
            // which inside a KPI strip pushes the tile's own label out of the
            // card ("60% Profile comple…").
            value: <ProfileCompletionBar completion={completion} size="compact" />,
            footnote:
              completion.missing.length === 0
                ? "Nothing missing"
                : `${completion.missing.length} fields missing — go to ${completion.missing[0].label}`,
            onClick: completion.missing.length ? jumpToFirstMissing : undefined,
          },
          {
            label: "Reports",
            mark: "reports",
            value: String(reports.length),
            footnote: (
              <span className={styles.kpiPillRow} title={cycle.hint}>
                <Badge tone={cycle.tone} dot>
                  {cycle.label}
                </Badge>
                {cycle.dueOn && <span>due {date(cycle.dueOn)}</span>}
              </span>
            ),
            onClick: () => setTab("reports"),
          },
          {
            label: "Scholarship",
            mark: "money",
            value: scholarship
              ? scholarship.grant_types?.name || student.scholarship || "Scholarship"
              : "None",
            footnote: scholarship ? (
              <span className={styles.kpiPillRow}>
                <span>{amount(scholarship.amount_for_period, scholarship.currency)}</span>
                <Badge tone={scholarship.status?.toLowerCase() === "active" ? "success" : "neutral"}>
                  {scholarship.status || "Recorded"}
                </Badge>
                <span>active since {date(scholarship.period_start)}</span>
              </span>
            ) : (
              "No scholarship on record"
            ),
            onClick: () => setTab("scholarships"),
          },
          {
            label: "Teacher assigned",
            mark: "teachers",
            value: teacher ? (
              <Link className={styles.kpiTeacher} to={`/admin/teachers/${teacher.id}`}>
                <Avatar size={26} style={profileAvatarStyle(teacher.id)}>
                  {profileInitials(teacher.full_name)}
                </Avatar>
                <span>{teacher.full_name || "(no name)"}</span>
              </Link>
            ) : (
              "Unassigned"
            ),
            footnote: teacher ? "Open the teacher's profile" : "Nobody is responsible for this student",
          },
        ]}
      />

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as TabValue)}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "scholarships", label: "Scholarships", count: awards.length },
          { value: "reports", label: "Reports", count: reports.length },
          ...(lifecycle ? [{ value: "donor", label: "Donor profile" }] : []),
        ]}
      />

      {tab === "overview" && (
        <div className={styles.detailOverview}>
          <div className={styles.detailFields}>
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className={styles.detailSectionTitle}>{section.title}</h2>
                <div className={styles.detailFieldGrid}>
                  {section.fields.map((entry) => (
                    <div
                      key={entry.key}
                      id={`field-${entry.key}`}
                      style={{ gridColumn: `span ${entry.span}` }}
                      className={highlighted === entry.key ? styles.fieldHighlighted : undefined}
                    >
                      <span className={styles.detailFieldLabel}>{entry.label}</span>
                      {entry.value ? (
                        <span className={styles.detailFieldValue}>{entry.value}</span>
                      ) : (
                        // Named, not blank. A dash says "nothing here"; this says
                        // "somebody still has to find this out", and it is the
                        // same set of fields the completion KPI counts.
                        <span className={styles.fieldMissing}>— missing</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {/* Notes: the quick place to write and read commentary. Everything
                written here also lands on the timeline. */}
            <section>
              <h2 className={styles.detailSectionTitle}>Notes</h2>
              <p className={styles.subsectionHint}>
                Internal only. Every note also appears in the activity log.
              </p>

              <Textarea
                aria-label="Write a note about this student"
                placeholder="Write a note about this student…"
                minRows={3}
                autosize
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.currentTarget.value)}
              />
              <div className={styles.noteActions}>
                {noteError && <span className={styles.fieldMissing}>{noteError}</span>}
                <Button
                  variant="primary"
                  disabled={!noteDraft.trim() || noteBusy}
                  onClick={() => void submitNote()}
                >
                  {noteBusy ? "Saving…" : "Add note"}
                </Button>
              </div>

              {notes.length === 0 ? (
                <p className={styles.detailEmpty}>No notes yet.</p>
              ) : (
                <div className={styles.noteList}>
                  {notes.map((note) => (
                    <article key={note.id} className={styles.note}>
                      <div className={styles.noteHead}>
                        <span className={styles.noteAuthor}>{note.author_name ?? "An admin"}</span>
                        <span className={styles.noteWhen}>
                          {dateTime(note.created_at)}
                          {note.edited && " · edited"}
                        </span>
                        <span className={styles.noteControls}>
                          <IconButton
                            icon="pencil"
                            size="sm"
                            label="Edit this note"
                            onClick={() => {
                              setEditingNote(note.id);
                              setEditDraft(note.body);
                            }}
                          />
                          <IconButton
                            icon="trash-2"
                            size="sm"
                            label="Delete this note"
                            onClick={() => void removeNote(note.id)}
                          />
                        </span>
                      </div>

                      {editingNote === note.id ? (
                        <>
                          <Textarea
                            aria-label="Edit this note"
                            minRows={3}
                            autosize
                            value={editDraft}
                            onChange={(event) => setEditDraft(event.currentTarget.value)}
                          />
                          <div className={styles.noteActions}>
                            <Button variant="ghost" onClick={() => setEditingNote(null)}>
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              disabled={noteBusy}
                              onClick={() => void saveEditedNote(note.id)}
                            >
                              Save note
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className={styles.noteBody}>{note.body}</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className={styles.detailRail}>
            <div className={styles.detailPanel}>
              <h2 className={styles.detailPanelTitle}>Activity</h2>
              {/* The full history, scrollable — not the single most recent line.
                  "What happened to this record" is a question with more than one
                  answer. */}
              {events.length === 0 ? (
                <p className={styles.detailEmpty}>Nothing has been recorded yet.</p>
              ) : (
                <>
                  <div className={allActivity ? styles.timelineAll : styles.timeline}>
                    {timeline.map((event) => (
                      <div key={event.id} className={styles.timelineItem}>
                        <span className={styles.timelineMark}>
                          <Icon name={EVENT_ICON[event.kind] ?? "circle"} size={13} />
                        </span>
                        <span className={styles.timelineBody}>
                          <span className={styles.detailActivityTitle}>{event.summary}</span>
                          <span className={styles.detailActivityWhen}>
                            {event.actor_name ?? "System"} · {dateTime(event.created_at)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                  {events.length > TIMELINE_PREVIEW && (
                    <div className={styles.timelineFooter}>
                      <Button variant="ghost" onClick={() => setAllActivity((current) => !current)}>
                        {allActivity ? "Show recent only" : `View all activity (${events.length})`}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {tab === "scholarships" && (
        <div className={styles.detailSimpleList}>
          {awards.length === 0 ? (
            <p className={styles.detailEmpty}>No scholarships recorded for this student.</p>
          ) : (
            awards.map((award) => (
              <div key={award.id} className={styles.detailListRow}>
                <div>
                  <span className={styles.detailActivityTitle}>
                    {award.grant_types?.name || student.scholarship || "Scholarship"}
                  </span>
                  <span className={styles.detailActivityWhen}>
                    {date(award.period_start)} – {date(award.period_end)}
                  </span>
                </div>
                <div className={styles.detailListMeta}>
                  <span>{amount(award.amount_for_period, award.currency)}</span>
                  <Badge tone={award.status?.toLowerCase() === "active" ? "success" : "neutral"}>
                    {award.status || "Recorded"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "reports" && (
        <ReportList studentId={student.id} studentName={student.name} />
      )}

      {tab === "donor" && <DonorProfileTab student={student} onChanged={() => void load()} />}

      <Modal
        opened={confirmingArchive}
        onClose={() => setConfirmingArchive(false)}
        title="Archive this student?"
        size="sm"
      >
        <Text size="sm" style={{ textWrap: "pretty" }}>
          {student.name} is hidden from the working lists. Nothing is deleted — their reports,
          scholarships, notes and history stay exactly as they are, and you can restore them from
          the same menu.
        </Text>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <Button variant="ghost" onClick={() => setConfirmingArchive(false)} disabled={archiving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void changeStatus("archived")} disabled={archiving}>
            {archiving ? "Archiving…" : "Archive student"}
          </Button>
        </div>
      </Modal>
    </Stack>
  );
};

export default AdminStudentOverviewPage;
