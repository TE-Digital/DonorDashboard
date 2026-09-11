// src/modules/teacher/TeacherDashboardPage.tsx
//
// What a teacher opens the product for: what is owed, and to whom.
//
// The screen leads with the reporting deadline rather than with counts, because
// the only thing a teacher has to do here is send term updates. Everything else
// on the page is context for that one job.
//
// Whose roster this is comes from the view layer, not the session, so an admin
// previewing a teacher sees exactly what that teacher would — see
// modules/viewAs/ViewAsContext.

import React, { useEffect, useMemo, useState } from "react";
import { Stack } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabaseClient";
import { InlineMessage, KpiRow, LoadingState, PageHeader, formatDate } from "../../design-system";
import { Badge, Banner, Button, Card } from "../../design-system/lumen";
import { toFriendlyError } from "../../i18n/errors";
import { useEffectiveTeacherId } from "../viewAs/ViewAsContext";
import { cycleOf, reportStatusFor, type ReportState } from "./reportingCycle";
import styles from "./TeacherHome.module.scss";

interface RosterStudent {
  id: string;
  name: string | null;
  grade: string | null;
  school: string | null;
  state: ReportState;
  lastReport: string | null;
}

const TONE: Record<ReportState, "success" | "warning" | "danger"> = {
  submitted: "success",
  due: "warning",
  overdue: "danger",
};

const STATE_LABEL_KEY: Record<ReportState, string> = {
  submitted: "teacherPages.dashboard.sentThisCycle",
  due: "report.notSent",
  overdue: "report.overdue",
};

export const TeacherDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const teacherId = useEffectiveTeacherId();

  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // One "now" for the whole render, so a student cannot be measured against a
  // different cycle from the one named in the heading.
  const today = useMemo(() => new Date(), []);
  const cycle = useMemo(() => cycleOf(today), [today]);

  useEffect(() => {
    const load = async () => {
      if (!teacherId) return;
      setLoading(true);
      setLoadError(null);

      const { data, error } = await supabase
        .from("students")
        .select("id, name, grade_level, schools ( name ), term_updates ( report_date )")
        .eq("responsible_teacher_id", teacherId)
        .order("name");

      if (error) {
        setLoadError(toFriendlyError(error, "errors.load", "Error loading teacher roster"));
        setStudents([]);
        setLoading(false);
        return;
      }

      const rows: RosterStudent[] = ((data ?? []) as any[]).map((row) => {
        const reportDates = ((row.term_updates ?? []) as Array<{ report_date: string | null }>)
          .map((update) => update.report_date)
          .filter(Boolean) as string[];

        return {
          id: row.id,
          name: row.name ?? null,
          grade: row.grade_level ?? null,
          // supabase-js widens a to-one embed to an array; both shapes appear.
          school: row.schools?.name ?? row.schools?.[0]?.name ?? null,
          state: reportStatusFor(reportDates, today).state,
          lastReport: [...reportDates].sort().at(-1) ?? null,
        };
      });

      setStudents(rows);
      setLoading(false);
    };

    void load();
  }, [teacherId, today]);

  const outstanding = students.filter((student) => student.state !== "submitted");
  const overdue = students.filter((student) => student.state === "overdue");
  const submitted = students.length - outstanding.length;
  const deadline = reportStatusFor([], today);

  // Built here rather than taken from cycle.label, which is English only.
  const cycleLabel = t(
    cycle.start.getMonth() === 0 ? "teacherPages.cycle.midYear" : "teacherPages.cycle.yearEnd",
    { year: cycle.start.getFullYear() },
  );
  const closes = formatDate(cycle.end);
  const when =
    deadline.daysLeft === 0
      ? t("teacherPages.dashboard.dueToday")
      : deadline.daysLeft === 1
        ? t("teacherPages.dashboard.dueTomorrow")
        : t("teacherPages.dashboard.dueInDays", { count: deadline.daysLeft });

  if (loading) return <LoadingState />;

  return (
    <Stack>
      <PageHeader
        title={t("teacherPages.dashboard.title")}
        subtitle={t("teacherPages.dashboard.subtitle", { cycle: cycleLabel, date: closes })}
      />

      {/* The one notification the product owes a teacher. */}
      {loadError ? (
        <InlineMessage tone="error">{loadError}</InlineMessage>
      ) : outstanding.length > 0 ? (
        <Banner
          tone={overdue.length ? "danger" : "warning"}
          title={
            overdue.length
              ? t("teacherPages.dashboard.overdueTitle", { count: overdue.length })
              : t("teacherPages.dashboard.dueTitle", { count: outstanding.length, when })
          }
          action={
            <Button variant="primary" onClick={() => navigate("/teacher/students")}>
              {t("teacherPages.dashboard.openStudents")}
            </Button>
          }
        >
          {t("teacherPages.dashboard.closesOn", { cycle: cycleLabel, date: closes })}{" "}
          {overdue.length > 0
            ? t("teacherPages.dashboard.overdueBody")
            : t("teacher.everyStudentNeedsUpdate")}
        </Banner>
      ) : (
        <Banner tone="success" title={t("teacher.nothingOutstanding")}>
          {t("teacherPages.dashboard.allSentBody", { cycle: cycleLabel })}
        </Banner>
      )}

      <KpiRow
        items={[
          { label: t("nav.myStudents"), value: String(students.length), mark: "students" },
          {
            label: t("teacher.reportsThisCycle"),
            value: `${submitted}/${students.length}`,
            mark: "reports",
          },
          {
            label: t("teacherPages.dashboard.stillToSend"),
            value: String(outstanding.length),
            mark: outstanding.length ? "overdue" : "ontrack",
          },
        ]}
      />

      <Card title={t("teacherPages.dashboard.nextDue", { cycle: cycleLabel })} flush>
        {outstanding.length === 0 ? (
          <p className={styles.empty}>{t("teacherPages.dashboard.nothingToSend")}</p>
        ) : (
          <ul className={styles.dueList}>
            {outstanding.map((student) => {
              const name = student.name || t("teacherPages.common.unnamed");
              const meta = [
                student.grade
                  ? t("teacherPages.common.classLabel", { grade: student.grade })
                  : t("student.classNotSet"),
                student.school,
                student.lastReport
                  ? t("teacherPages.dashboard.lastReportOn", { date: formatDate(student.lastReport) })
                  : t("report.none"),
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <li key={student.id} className={styles.dueRow}>
                  <button
                    type="button"
                    className={styles.dueIdentity}
                    onClick={() => navigate(`/teacher/students/${student.id}`)}
                  >
                    <span className={styles.dueName}>{name}</span>
                    <span className={styles.dueMeta}>{meta}</span>
                  </button>
                  <span className={styles.dueActions}>
                    <Badge tone={TONE[student.state]}>{t(STATE_LABEL_KEY[student.state])}</Badge>
                    <Button
                      variant="secondary"
                      icon="plus"
                      aria-label={t("teacherPages.dashboard.sendReportFor", { name })}
                      onClick={() => navigate(`/teacher/reports/new?studentId=${student.id}`)}
                    >
                      {t("teacherPages.dashboard.sendReport")}
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </Stack>
  );
};

export default TeacherDashboardPage;
