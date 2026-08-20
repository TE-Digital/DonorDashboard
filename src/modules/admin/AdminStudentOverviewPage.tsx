import React, { useEffect, useState } from "react";
import { Avatar, Group, Stack, Text } from "@mantine/core";
import { useNavigate, useParams } from "react-router-dom";
import { KpiRow, LoadingState } from "../../design-system";
import { Badge, Button, Tabs } from "../../design-system/lumen";
import { profileAvatarStyle, profileInitials } from "../../design-system/profileAvatar";
import { supabase } from "../../lib/supabaseClient";
import styles from "./AdminDirectory.module.scss";

type TabValue = "overview" | "scholarships" | "reports";

type Student = {
  id: string;
  name: string;
  nickname: string | null;
  school_id: string | null;
  grade_level: string | null;
  village: string | null;
  scholarship: string | null;
  contact: Record<string, string | null> | null;
  birthdate: string | null;
  monthly_support_expected: number | null;
  responsible_teacher_id: string | null;
  bio: string | null;
  profile_photo_path: string | null;
};

type School = { id: string; name: string };
type Teacher = { id: string; full_name: string | null };
type Award = {
  id: string;
  period_start: string | null;
  period_end: string | null;
  amount_for_period: number | null;
  currency: string | null;
  status: string | null;
  is_paid: boolean | null;
  grant_types?: { name: string | null } | null;
};
type Report = { id: string; report_date: string | null; grade_text: string | null; info: string | null };

const date = (value: string | null) =>
  value ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "—";
const shortId = (id: string) => `ST-${id.slice(0, 6).toUpperCase()}`;
const amount = (value: number | null, currency: string | null) =>
  value == null ? "—" : `${value.toLocaleString()} ${currency ?? ""}`.trim();

export const AdminStudentOverviewPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [awards, setAwards] = useState<Award[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<TabValue>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!studentId) {
        setError("Missing student ID.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      const { data, error: studentError } = await supabase
        .from("students")
        .select("id, name, nickname, school_id, grade_level, village, scholarship, contact, birthdate, monthly_support_expected, responsible_teacher_id, bio, profile_photo_path")
        .eq("id", studentId)
        .maybeSingle();

      if (studentError || !data) {
        console.error("Error loading student overview", studentError);
        setError(studentError?.message ?? "Student not found.");
        setLoading(false);
        return;
      }

      const currentStudent = data as Student;
      setStudent(currentStudent);
      setPhotoUrl(null);
      if (currentStudent.profile_photo_path) {
        const { data: image } = supabase.storage.from("student-profiles").getPublicUrl(currentStudent.profile_photo_path);
        setPhotoUrl(image.publicUrl);
      }

      const [schoolResult, teacherResult, awardResult, reportResult] = await Promise.all([
        currentStudent.school_id
          ? supabase.from("schools").select("id, name").eq("id", currentStudent.school_id).maybeSingle()
          : Promise.resolve({ data: null }),
        currentStudent.responsible_teacher_id
          ? supabase.from("profiles").select("id, full_name").eq("id", currentStudent.responsible_teacher_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("scholarship_awards")
          .select("id, period_start, period_end, amount_for_period, currency, status, is_paid, grant_types(name)")
          .eq("student_id", studentId)
          .order("period_start", { ascending: false }),
        supabase
          .from("term_updates")
          .select("id, report_date, grade_text, info")
          .eq("student_id", studentId)
          .order("report_date", { ascending: false }),
      ]);

      setSchool((schoolResult.data as School | null) ?? null);
      setTeacher((teacherResult.data as Teacher | null) ?? null);
      // Supabase's generated relationship type represents this to-one join as
      // an array, while this screen intentionally consumes the existing
      // to-one application shape.
      setAwards((awardResult.data ?? []) as unknown as Award[]);
      setReports((reportResult.data ?? []) as Report[]);
      setLoading(false);
    };

    load();
  }, [studentId]);

  if (loading) return <LoadingState />;

  if (error || !student) {
    return (
      <Stack className={styles.page}>
        <Text c="red">{error ?? "Student not found."}</Text>
        <Group>
          <Button variant="secondary" onClick={() => navigate("/admin/students")}>Back to students</Button>
        </Group>
      </Stack>
    );
  }

  const contact = student.contact ?? {};
  const latestReport = reports[0] ?? null;
  const activeAward = awards.find((award) => award.status?.toLowerCase() === "active") ?? awards[0] ?? null;
  const overviewSections: Array<{ title: string; fields: Array<[string, React.ReactNode, number]> }> = [
    {
      title: "Student information",
      fields: [
        ["Student ID", shortId(student.id), 4],
        ["Preferred name", student.nickname || "—", 4],
        ["Birthdate", date(student.birthdate), 4],
        ["Current class", student.grade_level || "Not assigned", 4],
        ["Village", student.village || "—", 4],
        ["School", school?.name || "Not assigned", 4],
      ],
    },
    {
      title: "Programme support",
      fields: [
        [
          "Responsible teacher",
          teacher ? (
            <span className={styles.profileName}>
              <Avatar size={24} style={profileAvatarStyle(teacher.id)}>{profileInitials(teacher.full_name)}</Avatar>
              {teacher.full_name || "(no name)"}
            </span>
          ) : "Not assigned",
          4,
        ],
        ["Scholarship / grant", student.scholarship || activeAward?.grant_types?.name || "None recorded", 4],
        ["Expected monthly support", amount(student.monthly_support_expected, null), 4],
      ],
    },
    {
      title: "Contact — internal only",
      fields: [
        ["Guardian", contact.guardian || "—", 4],
        ["Phone", contact.phone || "—", 4],
        ["Line / WhatsApp", contact.line_or_whatsapp || "—", 4],
        ["Address", contact.address || "—", 12],
      ],
    },
    {
      title: "Background",
      fields: [["Notes", student.bio || "No background notes recorded.", 12]],
    },
  ];

  const activity = [
    latestReport
      ? { title: "Latest report submitted", body: latestReport.grade_text || latestReport.info || "Term update recorded.", when: date(latestReport.report_date) }
      : null,
    activeAward
      ? { title: "Scholarship on record", body: `${activeAward.grant_types?.name || student.scholarship || "Scholarship"} · ${amount(activeAward.amount_for_period, activeAward.currency)}`, when: activeAward.status || "Recorded" }
      : null,
    { title: "Student record", body: `Currently placed in ${student.grade_level || "an unassigned class"}.`, when: "Current" },
  ].filter(Boolean) as Array<{ title: string; body: string; when: string }>;

  return (
    <Stack className={`${styles.page} ${styles.detailPage}`}>
      <header className={styles.detailHeader}>
        <div className={styles.studentIdentity}>
          <Avatar
            size={56}
            radius="xl"
            src={photoUrl ?? undefined}
            style={profileAvatarStyle(student.id)}
            className={styles.profileAvatar}
          >
            {profileInitials(student.name)}
          </Avatar>
          <div className={styles.detailIdentity}>
            <div className={styles.detailTitleRow}>
              <h1 className={styles.detailTitle}>{student.name}</h1>
              <Badge tone="success">Enrolled</Badge>
              {student.scholarship && <Badge tone="info">Scholarship</Badge>}
            </div>
            <p className={styles.detailMeta}>
              <span>{shortId(student.id)}</span><span className={styles.detailDot}>·</span>
              <span>Class {student.grade_level || "not assigned"}</span><span className={styles.detailDot}>·</span>
              <span>{school?.name || "No school assigned"}</span>
            </p>
          </div>
        </div>
        <div className={styles.detailActions}>
          <Button variant="primary" icon="pencil" onClick={() => navigate(`/admin/students/${student.id}/edit`)}>
            Edit student
          </Button>
        </div>
      </header>

      <KpiRow
        items={[
          { label: "Current class", value: student.grade_level || "Not assigned", mark: "grade" },
          { label: "School", value: school?.name || "Not assigned", mark: "schools" },
          { label: "Responsible teacher", value: teacher?.full_name || "Unassigned", mark: "teachers" },
          { label: "Reports submitted", value: String(reports.length), mark: "reports" },
          { label: "Scholarships", value: String(awards.length), mark: "scholarships" },
        ]}
      />

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as TabValue)}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "scholarships", label: "Scholarships", count: awards.length },
          { value: "reports", label: "Reports", count: reports.length },
        ]}
      />

      {tab === "overview" && (
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
              <h2 className={styles.detailPanelTitle}>At a glance</h2>
              <div className={styles.detailReportRow}><span className={styles.detailActivityTitle}>Latest report</span><span className={styles.detailActivityWhen}>{date(latestReport?.report_date ?? null)}</span></div>
              <div className={styles.detailReportRow}><span className={styles.detailActivityTitle}>Scholarship status</span><Badge tone={activeAward ? "success" : "neutral"}>{activeAward?.status || "None"}</Badge></div>
              <div className={styles.detailReportRow}><span className={styles.detailActivityTitle}>Teacher assigned</span><Badge tone={teacher ? "success" : "warning"}>{teacher ? "Yes" : "No"}</Badge></div>
            </div>
          </aside>
        </div>
      )}

      {tab === "scholarships" && (
        <div className={styles.detailSimpleList}>
          {awards.length === 0 ? <p className={styles.detailEmpty}>No scholarships recorded for this student.</p> : awards.map((award) => (
            <div key={award.id} className={styles.detailListRow}>
              <div><span className={styles.detailActivityTitle}>{award.grant_types?.name || student.scholarship || "Scholarship"}</span><span className={styles.detailActivityWhen}>{date(award.period_start)} – {date(award.period_end)}</span></div>
              <div className={styles.detailListMeta}><span>{amount(award.amount_for_period, award.currency)}</span><Badge tone={award.status?.toLowerCase() === "active" ? "success" : "neutral"}>{award.status || "Recorded"}</Badge></div>
            </div>
          ))}
        </div>
      )}

      {tab === "reports" && (
        <div className={styles.detailSimpleList}>
          {reports.length === 0 ? <p className={styles.detailEmpty}>No reports submitted for this student yet.</p> : reports.map((report) => (
            <div key={report.id} className={styles.detailListRow}>
              <div><span className={styles.detailActivityTitle}>{report.grade_text || "Term update"}</span><span className={styles.detailActivityBody}>{report.info || "No summary recorded."}</span></div>
              <span className={styles.detailActivityWhen}>{date(report.report_date)}</span>
            </div>
          ))}
        </div>
      )}
    </Stack>
  );
};

export default AdminStudentOverviewPage;
