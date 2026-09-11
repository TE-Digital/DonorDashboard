// src/modules/admin/AdminStudentsPage.tsx
//
// Every student, as a table you can work from.
//
// The KPIs are counts somebody can act on. "Schools represented" and "average
// age" were true and useless — nobody's morning changes because the average age
// is 12. What changes a morning is: how many reports are late, how many
// children have nobody responsible for them, and how many are still unfunded.
//
// The table is wider than a screen, so it pins the three things you steer by:
// the student's name on the left, and on the right the reporting state and the
// row menu. Everything else — school, village, age, enrolment, amounts, profile
// completion, donation — scrolls between them. Scrolling to see a village
// should never cost you the name of the child whose village it is.
//
// Reports use the shared vocabulary in reportStatus.ts, the same one the
// student's own page reads, so the list and the record cannot disagree about
// whether something is late.

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { CoverageBar } from "../donor/CoverageBar";
import {
  COVERAGE_META,
  coverageRank,
  coverageState,
  loadStudentCoverage,
  type StudentCoverage,
} from "../donor/donorMoney";
import { ActionIcon, Avatar, Group, Menu, Select, Stack, Text } from "@mantine/core";
import { IconDotsVertical, IconPencil, IconArchive, IconArrowBackUp, IconUserCog, IconCoins } from "@tabler/icons-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SponsorChips } from "../sponsorship/SponsorChips";
import {
  activeDonorsByStudent,
  loadSponsorshipsForStudents,
  type Sponsorship,
} from "../sponsorship/sponsorships";
import { InlineMessage, LoadingState, PageHeader, TableSection, type TableKpi } from "../../design-system";
import { Badge, Button, Tag, type DataColumn } from "../../design-system/lumen";
import { profileAvatarStyle, profileInitials } from "../../design-system/profileAvatar";
import { StudentFormDrawer } from "./StudentFormDrawer";
import { ProfileCompletionBar } from "./ProfileCompletionBar";
import {
  CYCLE_MONTHS,
  REPORT_STATE_META,
  REPORT_STATE_RANK,
  loadCycleReports,
  reportCycle,
  type CycleReport,
  type ReportCycle,
} from "../reports";
import {
  STUDENT_LIFECYCLE_PENDING_NOTE,
  loadStudentRecords,
  profileCompletion,
  studentPhotoUrl,
  type ProfileCompletion,
  type StudentRecord,
} from "./studentProfile";
import { reportingPeriodMonths } from "./schoolProfile";
import { setStudentStatus } from "./studentEvents";
import { AssignTeacherModal, type AssignTeacherTarget } from "./AssignTeacherModal";
import { loadTeacherOptions, type TeacherOption } from "./studentProfile";
import styles from "./AdminDirectory.module.scss";

/**
 * School names, plus the reporting period each one keeps. Degrades to the name
 * alone on a database without the reporting-period migration, so the directory
 * still loads and simply falls back to the default cycle.
 */
const loadSchoolCycleRows = async (schoolIds: string[]) => {
  const withPeriod = await supabase
    .from("schools")
    .select("id, name, reporting_period_months")
    .in("id", schoolIds);

  if (!withPeriod.error) return withPeriod;

  return supabase.from("schools").select("id, name").in("id", schoolIds);
};

/** A KPI that the table can be narrowed to. */
type Focus =
  | "all"
  | "overdue"
  | "unassigned"
  | "unfunded"
  | "gap"
  | "need-unknown"
  | "no-donor"
  | "needs-decision"
  | "sponsored";

const FOCUS_MATCH: Record<Exclude<Focus, "all">, (student: StudentRow) => boolean> = {
  overdue: (student) => student.cycle.state === "overdue",
  unassigned: (student) => !student.responsible_teacher_id,
  unfunded: (student) => !student.donated,
  // The two the dashboard links to. Money focuses, so they read the coverage
  // view rather than the older "has any donation been recorded" flag.
  gap: (student) =>
    !!student.coverage && !student.coverage.need_unknown && student.coverage.monthly_gap_thb > 0,
  "need-unknown": (student) => !student.coverage || student.coverage.need_unknown,
  // Who has a donor. A student funded only through an old award still counts as
  // having one until the awards are copied into scholarships.
  "no-donor": (student) => student.status === "enrolled" && !student.hasDonor,
  "needs-decision": (student) => student.needsDecision,
  sponsored: (student) => student.hasDonor,
};

/** Donor focuses read their chip label from the locale files; the older ones are still English here. */
const DONOR_FOCUS_KEY: Partial<Record<Exclude<Focus, "all">, string>> = {
  "no-donor": "sponsorship.directory.focus.noDonor",
  "needs-decision": "sponsorship.directory.focus.needsDecision",
  sponsored: "sponsorship.directory.focus.sponsored",
};

/**
 * The focuses a caller may arrive with in the URL.
 *
 * The dashboard counts these students and then sends the admin here to see
 * them; if the parameter and the filter disagreed, the number on the front page
 * and the rows on this one would be two different populations. So the contract
 * is written once, here, and the dashboard links to these words.
 */
const URL_FOCUS: Focus[] = [
  "overdue",
  "unassigned",
  "unfunded",
  "gap",
  "need-unknown",
  "no-donor",
  "needs-decision",
  "sponsored",
];

const focusFromParam = (value: string | null): Focus =>
  URL_FOCUS.includes((value ?? "") as Focus) ? ((value as Focus) ?? "all") : "all";

/** What a focus arrived at from elsewhere is called, on the chip that clears it. */
const FOCUS_LABEL: Partial<Record<Exclude<Focus, "all">, string>> = {
  overdue: "Reports overdue",
  unassigned: "Without a teacher",
  unfunded: "No donation recorded",
  gap: "Receiving less than their need",
  "need-unknown": "Need not recorded",
};

type StudentRow = {
  id: string;
  name: string | null;
  nickname: string | null;
  photo_url: string | null;
  school_id: string | null;
  school_name: string | null;
  responsible_teacher_id: string | null;
  teacher_name: string | null;
  grade_level: string | null;
  village: string | null;
  scholarship: string | null;
  birthdate: string | null;
  age_years: number | null;
  last_report_date: string | null;
  enrolled_on: string | null;
  monthly_support: number | null;
  status: string;
  /** The current open reporting cycle, from the shared vocabulary. */
  cycle: ReportCycle;
  completion: ProfileCompletion;
  /** True once at least one donation is recorded against this student. */
  donated: boolean;
  /** Need against received. Undefined until the funding migration lands. */
  coverage?: StudentCoverage;
  /** Donors funding this student now, from scholarships. */
  donors: Sponsorship[];
  /** An active donor, or an active old award that has not been copied yet. */
  hasDonor: boolean;
  /** At least one of this student's donors is waiting on an admin's decision. */
  needsDecision: boolean;
};

const asDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(value),
      )
    : "—";

export const AdminStudentsPage: React.FC = () => {
  const { t } = useTranslation();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [studentDrawerOpen, setStudentDrawerOpen] = useState(false);
  /** The student whose teacher is being changed from the row menu. */
  const [assigning, setAssigning] = useState<AssignTeacherTarget | null>(null);
  /** Loaded once, lazily: the picker needs them, the table does not. */
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([]);
  /** Archived students are out of the way by default, never gone. */
  const [statusFilter, setStatusFilter] = useState<string>("enrolled");
  /** A real read failure. Shown, never rendered as an empty table. */
  const [loadError, setLoadError] = useState<string | null>(null);
  /**
   * Which KPI, if any, the table is currently narrowed to. The band above the
   * table names four counts; clicking one shows exactly those rows, and
   * clicking it again puts them back.
   */
  const [focus, setFocusState] = useState<Focus>(() =>
    focusFromParam(new URLSearchParams(window.location.search).get("focus")),
  );

  /**
   * A focus is part of the address, not just component state.
   *
   * The dashboard sends an admin here with ?focus=gap. If that only seeded
   * state, the back button would return them to a dashboard tile they had
   * already followed, and the link would not survive being shared or reloaded.
   */
  const setFocus = (next: Focus | ((current: Focus) => Focus)) => {
    setFocusState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      setSearchParams(
        (params) => {
          if (resolved === "all") params.delete("focus");
          else params.set("focus", resolved);
          return params;
        },
        { replace: true },
      );
      return resolved;
    });
  };

  /** False until the lifecycle migration is applied. */
  const [lifecycle, setLifecycle] = useState(true);

  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const load = async () => {
    setLoading(true);

    // Degrades to the columns that have always existed when the lifecycle
    // migration is not applied, rather than showing an empty directory.
    const read = await loadStudentRecords();
    setLoadError(read.error);
    setLifecycle(read.extended);

    if (read.error) {
      setStudents([]);
      setLoading(false);
      return;
    }

    const records: StudentRecord[] = read.data;

    const schoolIds = Array.from(new Set(records.map((s) => s.school_id).filter(Boolean))) as string[];
    const teacherIds = Array.from(
      new Set(records.map((s) => s.responsible_teacher_id).filter(Boolean)),
    ) as string[];
    const studentIds = records.map((s) => s.id);

    const [schoolRows, profileRows, awardRows, cycleReports, sponsorshipRead] = await Promise.all([
      schoolIds.length ? loadSchoolCycleRows(schoolIds) : Promise.resolve({ data: [] }),
      teacherIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", teacherIds)
        : Promise.resolve({ data: [] }),
      studentIds.length
        ? supabase
            .from("scholarship_awards")
            .select("student_id, is_paid, payment_date, donor_id, status")
            .in("student_id", studentIds)
        : Promise.resolve({ data: [] }),
      loadCycleReports(supabase, studentIds),
      loadSponsorshipsForStudents(studentIds),
    ]);

    const donorsByStudent = activeDonorsByStudent(sponsorshipRead.data);
    const decisionStudents = new Set(
      sponsorshipRead.data.filter((row) => row.status === "needs_decision").map((row) => row.studentId),
    );

    const schoolById = new Map<string, string>();
    // A student reports on their school's rhythm, not on a global six months.
    const periodBySchool = new Map<string, number>();
    ((schoolRows.data ?? []) as any[]).forEach((row) => {
      schoolById.set(row.id, row.name);
      periodBySchool.set(row.id, reportingPeriodMonths(row));
    });

    const teacherById = new Map<string, string>();
    ((profileRows.data ?? []) as any[]).forEach((row) => teacherById.set(row.id, row.full_name));

    // A donation is money that actually arrived — a paid award, or one with a
    // payment date on it. An award that exists but has never been paid is a
    // promise, and a promise is not coverage.
    const donatedStudents = new Set<string>();
    // Until the old awards are copied into scholarships, an active award is the
    // only record that some students have a donor at all.
    const legacyFunded = new Set<string>();
    ((awardRows.data ?? []) as any[]).forEach((award) => {
      if (award.is_paid === true || award.payment_date) donatedStudents.add(award.student_id);
      if ((award.status ?? "").toLowerCase() === "active" && award.donor_id) legacyFunded.add(award.student_id);
    });

    const reportsByStudent = cycleReports.byStudent;

    const mapped: StudentRow[] = records.map((record) => {
      const reports = reportsByStudent.get(record.id) ?? [];
      const enrolledOn = record.enrolled_on ?? record.created_at ?? null;

      let ageYears: number | null = null;
      if (record.birthdate) {
        const born = new Date(record.birthdate);
        if (!Number.isNaN(born.getTime())) {
          ageYears = Math.floor((Date.now() - born.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
        }
      }

      const approved = reports
        .filter((report) => report.status === "approved" || !report.status)
        .map((report) => report.report_date)
        .filter(Boolean) as string[];

      return {
        id: record.id,
        name: record.name ?? null,
        nickname: record.nickname ?? null,
        photo_url: studentPhotoUrl(record.profile_photo_path),
        school_id: record.school_id ?? null,
        school_name: record.school_id ? schoolById.get(record.school_id) ?? null : null,
        responsible_teacher_id: record.responsible_teacher_id ?? null,
        teacher_name: record.responsible_teacher_id
          ? teacherById.get(record.responsible_teacher_id) ?? null
          : null,
        grade_level: record.grade_level ?? null,
        village: record.village ?? null,
        scholarship: record.scholarship ?? null,
        birthdate: record.birthdate ?? null,
        age_years: ageYears,
        last_report_date: approved.sort().reverse()[0] ?? null,
        enrolled_on: enrolledOn,
        monthly_support:
          record.monthly_support_expected != null ? Number(record.monthly_support_expected) : null,
        status: record.status ?? "enrolled",
        cycle: reportCycle(
          reports,
          enrolledOn,
          new Date(),
          (record.school_id && periodBySchool.get(record.school_id)) || CYCLE_MONTHS,
        ),
        completion: profileCompletion(record),
        donated: donatedStudents.has(record.id),
        donors: donorsByStudent.get(record.id) ?? [],
        hasDonor: (donorsByStudent.get(record.id)?.length ?? 0) > 0 || legacyFunded.has(record.id),
        needsDecision: decisionStudents.has(record.id),
      };
    });

    // Coverage comes from the student_coverage view rather than being summed
    // here, so this table and the allocation panel cannot rank the same student
    // differently. A missing view leaves every row's coverage undefined, which
    // the bar renders as "Need not recorded" rather than as zero.
    const { data: coverageByStudent } = await loadStudentCoverage(mapped.map((row) => row.id));

    setStudents(
      mapped.map((row) => ({ ...row, coverage: coverageByStudent.get(row.id) })),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  /**
   * What is in the table, and in what order.
   *
   * Overdue first, then everything else by how much it needs somebody, then by
   * name. Database order tells you when a row was typed in, which is never the
   * thing anybody opened this page to find out.
   */
  // What the KPIs count: everything the status filter admits, before any KPI
  // narrows it. Counting the narrowed set instead would make every tile read
  // "0" the moment you clicked another one.
  const inScope = useMemo(
    () =>
      students
        .filter(
          (student) => !lifecycle || statusFilter === "all" || student.status === statusFilter,
        )
        .sort(
          (a, b) =>
            REPORT_STATE_RANK[a.cycle.state] - REPORT_STATE_RANK[b.cycle.state] ||
            (a.name ?? "").localeCompare(b.name ?? ""),
        ),
    [students, statusFilter, lifecycle],
  );

  /** What the table shows: the scope, narrowed to the KPI in focus. */
  const visible = useMemo(
    () => (focus === "all" ? inScope : inScope.filter(FOCUS_MATCH[focus])),
    [inScope, focus],
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const header = [
        "Name",
        "Nickname",
        "Student ID",
        "School",
        "Teacher",
        "Grade level",
        "Village",
        "Scholarship",
        "Age (years)",
        "Enrolled",
        "Monthly support (THB)",
        "Last report",
        "Report status",
        "Profile completion (%)",
        "Donation",
        "Donors",
      ];

      const rows = visible.map((s) => [
        s.name ?? "",
        s.nickname ?? "",
        `ST-${s.id.slice(0, 6).toUpperCase()}`,
        s.school_name ?? "",
        s.teacher_name ?? "",
        s.grade_level ?? "",
        s.village ?? "",
        s.scholarship ?? "",
        s.age_years != null ? String(s.age_years) : "",
        s.enrolled_on ?? "",
        s.monthly_support != null ? String(s.monthly_support) : "",
        s.last_report_date ?? "",
        s.cycle.label,
        String(s.completion.percent),
        s.donated ? "Donation received" : "No donation yet",
        s.donors.map((row) => row.donorName ?? "").filter(Boolean).join("; "),
      ]);

      const csv = [header, ...rows]
        .map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "students_export.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed", error);
    }
    setExporting(false);
  };

  /**
   * Counts somebody can act on, derived from the rows already loaded.
   *
   * Every one of these answers "what should I do next?". A number that only
   * describes the data — how many schools, what the average age is — takes up a
   * card and gives nothing back.
   */
  const kpis: TableKpi[] = useMemo(() => {
    const overdue = inScope.filter(FOCUS_MATCH.overdue).length;
    const withoutTeacher = inScope.filter(FOCUS_MATCH.unassigned).length;
    const waiting = inScope.filter(FOCUS_MATCH["no-donor"]).length;

    // Each tile is also the filter for the thing it counts, so the number and
    // the rows behind it are never two separate journeys.
    const toggle = (next: Exclude<Focus, "all">) => () =>
      setFocus((current) => (current === next ? "all" : next));

    return [
      {
        label: "Total students",
        value: inScope.length,
        footnote: statusFilter === "enrolled" ? "enrolled" : "in this view",
        mark: "students",
        active: focus === "all",
        onClick: () => setFocus("all"),
      },
      {
        label: "Reports overdue",
        value: overdue,
        footnote: overdue ? "past their date" : "nothing is late",
        mark: overdue ? "overdue" : "ontrack",
        active: focus === "overdue",
        onClick: toggle("overdue"),
      },
      {
        label: "Without a teacher",
        value: withoutTeacher,
        footnote: withoutTeacher ? "nobody is responsible" : "everyone is covered",
        mark: withoutTeacher ? "overdue" : "teachers",
        active: focus === "unassigned",
        onClick: toggle("unassigned"),
      },
      {
        // Every student is in the programme to be funded, so the number worth
        // acting on is who is still waiting, and clicking it shows them.
        label: t("sponsorship.directory.kpiLabel"),
        value: waiting,
        footnote: waiting ? t("sponsorship.directory.kpiSome") : t("sponsorship.directory.kpiNone"),
        mark: waiting ? "overdue" : "money",
        active: focus === "no-donor",
        onClick: toggle("no-donor"),
      },
    ];
  }, [inScope, statusFilter, focus, t]);

  // Archive/restore from the row menu. Nothing cascades — only the word on the
  // record changes — so the list just reloads afterwards.
  const changeStatus = async (student: StudentRow) => {
    const next = student.status === "archived" ? "enrolled" : "archived";
    const failure = await setStudentStatus(student.id, next, student.name ?? "This student");
    if (failure) {
      setLoadError(failure);
      return;
    }
    setStudents((rows) => rows.map((row) => (row.id === student.id ? { ...row, status: next } : row)));
  };

  const columns: DataColumn<StudentRow>[] = [
    {
      // Identity, pinned. The old separate ID column is folded in underneath
      // the name: it was 120px spent on a string nobody reads across.
      key: "name",
      label: "Student",
      width: 260,
      pin: "left",
      render: (s) => (
        <div className={styles.studentCell}>
          <Avatar size={24} radius="xl" src={s.photo_url ?? undefined} style={profileAvatarStyle(s.id)}>
            {profileInitials(s.name)}
          </Avatar>
          <span className={styles.studentCellText}>
            <Link className={styles.recordLink} to={`/admin/students/${s.id}`}>
              {s.name || "(no name)"}
            </Link>
            <span className={styles.studentCellMeta}>
              ST-{s.id.slice(0, 6).toUpperCase()}
              {s.nickname ? ` · ${s.nickname}` : ""}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "school_name",
      label: "School",
      width: 190,
      render: (s) =>
        s.school_id ? (
          <Link className={styles.recordLink} to={`/admin/schools/${s.school_id}`}>
            {s.school_name || "School"}
          </Link>
        ) : (
          <Text size="sm" c="dimmed">
            Not assigned
          </Text>
        ),
    },

    {
      // Who funds this student now. A student with nobody is the one row on
      // this page that asks for somebody's action, so it says so in words.
      key: "donors",
      label: t("sponsorship.directory.column"),
      width: 220,
      sortValue: (s) => (s.needsDecision ? -1 : s.hasDonor ? s.donors.length : 0),
      filterValue: (s) =>
        s.needsDecision
          ? t("sponsorship.directory.focus.needsDecision")
          : s.hasDonor
            ? t("sponsorship.directory.focus.sponsored")
            : t("sponsorship.directory.focus.noDonor"),
      render: (s) =>
        s.donors.length ? (
          <span className={styles.donorCell}>
            <SponsorChips sponsorships={s.donors} />
            {s.needsDecision && (
              <Badge tone="warning" dot>
                {t("sponsorship.status.needs_decision")}
              </Badge>
            )}
          </span>
        ) : s.hasDonor ? (
          <Text size="sm" c="dimmed">
            {t("sponsorship.directory.oldAward")}
          </Text>
        ) : (
          <Badge tone="warning" dot>
            {t("sponsorship.chips.none")}
          </Badge>
        ),
    },

    // ── Scrollable middle: reference data ──────────────────────────────────
    { key: "village", label: "Village", width: 140 },
    { key: "scholarship", label: "Scholarship", width: 160 },
    { key: "age_years", label: "Age", align: "right", numeric: true, width: 80 },
    {
      key: "enrolled_on",
      label: "Enrolled",
      width: 130,
      muted: true,
      render: (s) => asDate(s.enrolled_on),
    },
    {
      // `monthly_support_expected` has been on the student form since the
      // beginning and nothing ever compared it to the scholarships attached to
      // the student. The number alone answered nothing; need against received,
      // sorted by the gap, is the question a supervisor actually has.
      key: "coverage",
      label: "Funding",
      width: 190,
      sortValue: (s) => -coverageRank(s.coverage),
      // The cell is a bar, so without this the filter menu offered one option
      // reading "[object Object]". Filtering funding means filtering the state
      // it is in.
      filterValue: (s) => COVERAGE_META[coverageState(s.coverage)].label,
      render: (s) => <CoverageBar coverage={s.coverage} compact />,
    },
    {
      key: "last_report_date",
      label: "Last report",
      width: 130,
      muted: true,
      render: (s) => asDate(s.last_report_date),
    },

    {
      key: "completion",
      label: "Profile",
      width: 130,
      filterValue: (s) => s.completion.percent,
      render: (s) => <ProfileCompletionBar completion={s.completion} size="compact" />,
    },
    {
      key: "donated",
      label: "Donation",
      width: 160,
      filterValue: (s) => (s.donated ? "Donation received" : "No donation yet"),
      render: (s) => (
        <Badge tone={s.donated ? "success" : "neutral"} dot>
          {s.donated ? "Donation received" : "No donation yet"}
        </Badge>
      ),
    },

    // ── Fixed right: what to do about this row ─────────────────────────────
    // Reporting state and the row menu stay on screen; everything between them
    // and the name scrolls.
    {
      key: "cycle",
      label: "Reports",
      // No declared width: a fixed 150px column left a band of empty white
      // between the pill and the menu on every row whose status was short. The
      // pinned offsets are measured, not declared, so the column can size to
      // its widest pill and hug it. The menu column supplies the 12px gap.
      pin: "right",
      pad: "0 0 0 var(--sp-2)",
      // Sorted and filtered by what the pill says, so "Overdue" groups together
      // in the header menu the way it reads on screen.
      filterValue: (s) => REPORT_STATE_META[s.cycle.state].label,
      render: (s) => (
        <span title={s.cycle.hint}>
          <Badge tone={s.cycle.tone} dot>
            {s.cycle.label}
          </Badge>
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      // 12px of left padding + a 28px icon + 8px trailing. Declared honestly, so
      // the first paint lands where the measured layout will keep it.
      width: 48,
      pin: "right",
      pad: "0 var(--sp-2) 0 var(--sp-3)",
      sortable: false,
      filterable: false,
      render: (s) => (
        <div className={styles.rowActions} onClick={(event) => event.stopPropagation()}>
          <Menu position="bottom-end" withinPortal shadow="md" width={230}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${s.name ?? "student"}`}>
                <IconDotsVertical size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconPencil size={16} />}
                onClick={() => navigate(`/admin/students/${s.id}/edit`)}
              >
                Edit student details
              </Menu.Item>

              {/* The two things that actually happen to a student between
                  reports: who looks after them, and who pays for them. Both
                  used to mean opening the edit form and scrolling past nine
                  fields that were not changing. */}
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconUserCog size={16} />}
                onClick={() => setAssigning(s)}
              >
                {s.responsible_teacher_id ? "Change teacher" : "Assign teacher"}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconCoins size={16} />}
                onClick={() => navigate(`/admin/students/${s.id}?tab=donors`)}
              >
                {s.donors.length ? t("sponsorship.directory.menuManage") : t("sponsorship.directory.menuAssign")}
              </Menu.Item>
              {lifecycle && (
                <>
                  <Menu.Divider />
                  <Menu.Item
                    color={s.status === "archived" ? undefined : "red"}
                    leftSection={
                      s.status === "archived" ? <IconArrowBackUp size={16} /> : <IconArchive size={16} />
                    }
                    onClick={() => void changeStatus(s)}
                  >
                    {s.status === "archived" ? "Restore student" : "Archive student"}
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </div>
      ),
    },
  ];

  // The teacher list is only needed by the assign picker, so it is fetched the
  // first time somebody opens it rather than on every load of the directory.
  useEffect(() => {
    if (!assigning || teacherOptions.length) return;
    void loadTeacherOptions().then(setTeacherOptions);
  }, [assigning, teacherOptions.length]);

  return (
    <>
      {loading && (
        <Group justify="center" mb="md">
          <LoadingState variant="inline" />
        </Group>
      )}

      <Stack gap="md" className={styles.page}>
        <AssignTeacherModal
          student={assigning}
          teachers={teacherOptions}
          onClose={() => setAssigning(null)}
          onAssigned={() => void load()}
        />

        <StudentFormDrawer
          opened={studentDrawerOpen}
          onClose={() => setStudentDrawerOpen(false)}
          onCreated={(student) => {
            setStudentDrawerOpen(false);
            navigate(`/admin/students/${student.id}`);
          }}
        />

        <PageHeader
          title="Students"
          actions={
            <>
              <Button variant="secondary" icon="download" onClick={handleExport} disabled={exporting}>
                {exporting ? "Exporting…" : "Export CSV"}
              </Button>
              <Button variant="primary" icon="plus" onClick={() => setStudentDrawerOpen(true)}>
                Add student
              </Button>
            </>
          }
        />

        {loadError && <InlineMessage tone="error">{loadError}</InlineMessage>}
        {!loadError && !lifecycle && (
          <InlineMessage tone="warning">{STUDENT_LIFECYCLE_PENDING_NOTE}</InlineMessage>
        )}

        {!loading && (
          <TableSection
            kpis={kpis}
            columns={columns}
            rows={visible}
            density="compact"
            pageSize={25}
            controls={
              <>
              {/*
                Where the admin came from, and the way back out.

                A dashboard tile that silently narrows this table would leave an
                admin looking at a subset with nothing on screen explaining why.
                The chip names the filter and removes it.
              */}
              {focus !== "all" && (
                <Tag onRemove={() => setFocus("all")}>
                  {DONOR_FOCUS_KEY[focus] ? t(DONOR_FOCUS_KEY[focus] as string) : FOCUS_LABEL[focus]}
                </Tag>
              )}
              <Select
                aria-label={t("sponsorship.directory.filterLabel")}
                allowDeselect={false}
                w={200}
                data={[
                  { value: "any", label: t("sponsorship.directory.filterAny") },
                  { value: "no-donor", label: t("sponsorship.directory.focus.noDonor") },
                  { value: "needs-decision", label: t("sponsorship.directory.focus.needsDecision") },
                  { value: "sponsored", label: t("sponsorship.directory.focus.sponsored") },
                ]}
                value={DONOR_FOCUS_KEY[focus as Exclude<Focus, "all">] ? focus : "any"}
                onChange={(value) => value && setFocus(value === "any" ? "all" : (value as Focus))}
              />
              {lifecycle && (
              <Select
                label={undefined}
                aria-label="Which students to show"
                allowDeselect={false}
                w={180}
                data={[
                  { value: "enrolled", label: "Enrolled" },
                  { value: "archived", label: "Archived" },
                  { value: "all", label: "Everyone" },
                ]}
                value={statusFilter}
                onChange={(value) => value && setStatusFilter(value)}
              />
              )}
              </>
            }
            onRowClick={(s) => navigate(`/admin/students/${s.id}`)}
            emptyTitle={statusFilter === "archived" ? "No archived students" : "No students yet"}
            emptyDescription={
              statusFilter === "archived"
                ? "Students you archive are kept here, with all of their records."
                : "Add a student to start tracking their school, teacher and reports."
            }
            emptyIcon="users"
            emptyAction={
              statusFilter === "archived" ? undefined : (
                <Button variant="secondary" icon="plus" onClick={() => setStudentDrawerOpen(true)}>
                  Add student
                </Button>
              )
            }
          />
        )}
      </Stack>
    </>
  );
};

export default AdminStudentsPage;
