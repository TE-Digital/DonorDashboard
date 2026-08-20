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
import { supabase } from "../../lib/supabaseClient";
import { KpiRow, LoadingState, PageHeader } from "../../design-system";
import { Badge, Banner, Button, Card } from "../../design-system/lumen";
import { useEffectiveTeacherId } from "../viewAs/ViewAsContext";
import {
  cycleOf,
  duePhrase,
  formatDueDate,
  reportStatusFor,
  type ReportState,
} from "./reportingCycle";
import styles from "./TeacherHome.module.scss";

interface RosterStudent {
  id: string;
  name: string;
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

const STATE_LABEL: Record<ReportState, string> = {
  submitted: "Sent this cycle",
  due: "Not sent yet",
  overdue: "Overdue",
};

const asDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(value),
      )
    : "No report yet";

export const TeacherDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const teacherId = useEffectiveTeacherId();

  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(true);

  // One "now" for the whole render, so a student cannot be measured against a
  // different cycle from the one named in the heading.
  const today = useMemo(() => new Date(), []);
  const cycle = useMemo(() => cycleOf(today), [today]);

  useEffect(() => {
    const load = async () => {
      if (!teacherId) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("students")
        .select("id, name, grade_level, schools ( name ), term_updates ( report_date )")
        .eq("responsible_teacher_id", teacherId)
        .order("name");

      if (error) {
        console.error("Error loading teacher roster", error);
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
          name: row.name ?? "(no name)",
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

  if (loading) return <LoadingState />;

  return (
    <Stack>
      <PageHeader
        title="Teaching overview"
        subtitle={`Reporting cycle ${cycle.label} · closes ${formatDueDate(cycle.end)}`}
      />

      {/* The one notification the product owes a teacher. */}
      {outstanding.length > 0 ? (
        <Banner
          tone={overdue.length ? "danger" : "warning"}
          title={
            overdue.length
              ? `${overdue.length} report${overdue.length === 1 ? " is" : "s are"} overdue`
              : `${outstanding.length} report${
                  outstanding.length === 1 ? "" : "s"
                } due ${duePhrase(deadline)}`
          }
          action={
            <Button variant="primary" onClick={() => navigate("/teacher/students")}>
              Open my students
            </Button>
          }
        >
          The {cycle.label} cycle closes on {formatDueDate(cycle.end)}.{" "}
          {overdue.length > 0
            ? "The overdue students went without a report last cycle as well."
            : "Every student needs one term update inside the cycle."}
        </Banner>
      ) : (
        <Banner tone="success" title="Nothing outstanding">
          Every student on this roster has a report for {cycle.label}.
        </Banner>
      )}

      <KpiRow
        items={[
          { label: "My students", value: String(students.length), mark: "students" },
          {
            label: "Reports sent this cycle",
            value: `${submitted}/${students.length}`,
            mark: "reports",
          },
          {
            label: "Still to send",
            value: String(outstanding.length),
            mark: outstanding.length ? "overdue" : "ontrack",
          },
        ]}
      />

      <Card title={`Next reports due · ${cycle.label}`} flush>
        {outstanding.length === 0 ? (
          <p className={styles.empty}>
            Nothing to send. Reports already filed appear on each student's page.
          </p>
        ) : (
          <ul className={styles.dueList}>
            {outstanding.map((student) => (
              <li key={student.id} className={styles.dueRow}>
                <button
                  type="button"
                  className={styles.dueIdentity}
                  onClick={() => navigate(`/teacher/students/${student.id}`)}
                >
                  <span className={styles.dueName}>{student.name}</span>
                  <span className={styles.dueMeta}>
                    {student.grade ? `Class ${student.grade}` : "Class not set"}
                    {student.school ? ` · ${student.school}` : ""} · last report{" "}
                    {asDate(student.lastReport)}
                  </span>
                </button>
                <span className={styles.dueActions}>
                  <Badge tone={TONE[student.state]}>{STATE_LABEL[student.state]}</Badge>
                  <Button
                    variant="secondary"
                    icon="plus"
                    onClick={() => navigate(`/teacher/reports/new?studentId=${student.id}`)}
                  >
                    Submit report
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Stack>
  );
};

export default TeacherDashboardPage;
