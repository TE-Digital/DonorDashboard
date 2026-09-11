// src/modules/reports/reportStatus.ts
//
// One vocabulary for "where is this student's reporting up to?", used by the
// students table and by the student's own page.
//
// Before this, the directory could say exactly one thing — "Overdue" — so a
// report sitting in review looked identical to one nobody had opened, and the
// two screens each decided for themselves what counted as late. A shared
// vocabulary means the list and the record cannot disagree.
//
// Every student has exactly one *open cycle*, and this file answers what state
// it is in. Reports that are already approved are history; they change the next
// due date and nothing else.

import type { BadgeTone } from "../../design-system/lumen";

export type ReportCycleState =
  | "not_started"
  | "draft"
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "due_soon"
  | "overdue"
  | "approved"
  | "flagged";

/** The stored state of one report row. */
export type ReportStatus = "draft" | "submitted" | "under_review" | "changes_requested" | "approved";

export interface ReportStateMeta {
  label: string;
  tone: BadgeTone;
  /** One sentence for a tooltip, and for the detail line under the KPI. */
  hint: string;
}

/**
 * Colour carries meaning here, so it is fixed:
 *   gray  — nothing is happening yet, and nothing is late
 *   blue  — in motion, with somebody else
 *   amber — needs attention soon, or from us
 *   red   — late
 *   green — done and sent
 */
export const REPORT_STATE_META: Record<ReportCycleState, ReportStateMeta> = {
  not_started: {
    label: "Not started",
    tone: "neutral",
    hint: "Nobody has begun this term's report yet.",
  },
  draft: {
    label: "Draft",
    tone: "neutral",
    hint: "A report is started but hasn't been sent in.",
  },
  submitted: {
    label: "Submitted",
    tone: "info",
    hint: "The teacher has sent the report in. It is waiting to be reviewed.",
  },
  under_review: {
    label: "Under review",
    tone: "info",
    hint: "Somebody is reading this report now.",
  },
  changes_requested: {
    label: "Changes requested",
    tone: "warning",
    hint: "The report has gone back to the teacher with something to fix.",
  },
  due_soon: {
    label: "Due soon",
    tone: "warning",
    hint: "This term's report is due shortly and has not been started.",
  },
  overdue: {
    label: "Overdue",
    tone: "danger",
    hint: "This term's report is past its date. The donor is waiting.",
  },
  approved: {
    label: "Approved",
    tone: "success",
    hint: "The report is approved and has gone to the donor.",
  },
  // A flag is not a complaint. It is a donor asking something about a report
  // that has already been sent, and it stays amber until somebody answers.
  flagged: {
    label: "Flagged",
    tone: "warning",
    hint: "The donor has raised a question on this report and is waiting for an answer.",
  },
};

/** Sort order for a status column: what needs somebody first. */
export const REPORT_STATE_RANK: Record<ReportCycleState, number> = {
  // Above overdue: a late report is somebody's task, a flagged one is somebody
  // already waiting on an answer they asked for.
  flagged: -1,
  overdue: 0,
  changes_requested: 1,
  due_soon: 2,
  not_started: 3,
  draft: 4,
  submitted: 5,
  under_review: 6,
  approved: 7,
};

/**
 * A report is expected twice a school year, unless the student's school says
 * otherwise — schools carry their own reporting period, and this is only the
 * fallback for a student with no school, or before that column exists.
 */
export const CYCLE_MONTHS = 6;
/** Inside this many days of the due date, "not started" becomes "due soon". */
export const DUE_SOON_DAYS = 30;

/** The minimum a cycle calculation needs from a report row. */
export interface CycleReport {
  report_date: string | null;
  status?: string | null;
  due_date?: string | null;
  /** Set while a donor's question on this report is unanswered. */
  flagged_at?: string | null;
  flag_resolved_at?: string | null;
}

export interface ReportCycle {
  state: ReportCycleState;
  /** "Due in 12 days" rather than the flat label, where a number helps. */
  label: string;
  tone: BadgeTone;
  hint: string;
  /** When this cycle is due. Null when there is an open report to finish instead. */
  dueOn: string | null;
  /** Negative once the date has passed. */
  daysUntilDue: number | null;
}

const DAY = 86_400_000;

const startOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

const parse = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
  return next;
};

const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const OPEN_STATES: ReportStatus[] = ["draft", "submitted", "under_review", "changes_requested"];

/**
 * The state of a student's current open reporting cycle.
 *
 * In order:
 *   1. An unfinished report is the cycle. Its own status is the answer, and no
 *      date arithmetic can override it — a report in review is not "overdue"
 *      because a calendar says so; it is with us, not with the teacher.
 *   2. Otherwise the cycle is the next one due, counted from the last approved
 *      report, or from the day the student enrolled if there has never been one.
 *   3. A student with no enrolment date and no reports has nothing to be late
 *      for yet, and reads "Not started".
 */
export const reportCycle = (
  reports: CycleReport[],
  enrolledOn?: string | null,
  now: Date = new Date(),
  /** Months between reports, from the student's school. */
  cycleMonths: number = CYCLE_MONTHS,
): ReportCycle => {
  const today = startOfDay(now);

  // An open flag outranks every other state, including overdue. The report has
  // already been sent; what is outstanding is a person waiting for a reply.
  const flagged = reports.find((report) => report.flagged_at && !report.flag_resolved_at);
  if (flagged) {
    return {
      ...REPORT_STATE_META.flagged,
      state: "flagged",
      dueOn: null,
      daysUntilDue: null,
    };
  }

  const open = reports
    .filter((report) => OPEN_STATES.includes((report.status ?? "") as ReportStatus))
    .sort((a, b) => (b.report_date ?? "").localeCompare(a.report_date ?? ""))[0];

  if (open) {
    const state = (open.status as ReportStatus) as ReportCycleState;
    const meta = REPORT_STATE_META[state];
    const due = parse(open.due_date);

    // An open report that is also past its date is late, and late wins: a draft
    // three weeks past the deadline is not a neutral grey fact.
    if (due && startOfDay(due) < today && state !== "under_review") {
      return {
        ...REPORT_STATE_META.overdue,
        state: "overdue",
        dueOn: toIso(due),
        daysUntilDue: Math.round((startOfDay(due) - today) / DAY),
      };
    }

    return {
      state,
      label: meta.label,
      tone: meta.tone,
      hint: meta.hint,
      dueOn: due ? toIso(due) : null,
      daysUntilDue: due ? Math.round((startOfDay(due) - today) / DAY) : null,
    };
  }

  const approved = reports
    .filter((report) => report.status === "approved" || !report.status)
    .map((report) => parse(report.report_date))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const anchor = approved ?? parse(enrolledOn ?? null);

  if (!anchor) {
    return { ...REPORT_STATE_META.not_started, state: "not_started", dueOn: null, daysUntilDue: null };
  }

  const due = addMonths(anchor, cycleMonths);
  const days = Math.round((startOfDay(due) - today) / DAY);

  if (days < 0) {
    return { ...REPORT_STATE_META.overdue, state: "overdue", dueOn: toIso(due), daysUntilDue: days };
  }

  if (days <= DUE_SOON_DAYS) {
    return {
      ...REPORT_STATE_META.due_soon,
      state: "due_soon",
      label: days === 0 ? "Due today" : days === 1 ? "Due in 1 day" : `Due in ${days} days`,
      dueOn: toIso(due),
      daysUntilDue: days,
    };
  }

  // Nothing open, nothing near: the last thing that happened is what shows.
  if (approved) {
    return {
      ...REPORT_STATE_META.approved,
      state: "approved",
      dueOn: toIso(due),
      daysUntilDue: days,
    };
  }

  return {
    ...REPORT_STATE_META.not_started,
    state: "not_started",
    dueOn: toIso(due),
    daysUntilDue: days,
  };
};

/** The stored per-report status, for a form or a row that shows one report. */
export const REPORT_STATUS_OPTIONS: Array<{ value: ReportStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "approved", label: "Approved" },
];

/**
 * Reads the cycle columns for a set of students, degrading when they are absent.
 *
 * `status` and `due_date` arrive with the lifecycle migration. PostgREST
 * refuses a select that names a column it does not have, so without this every
 * student would silently read as "Not started" — a wrong answer delivered
 * confidently, which is worse than a missing column.
 */
export const loadCycleReports = async (
  client: {
    from: (table: string) => any;
  },
  studentIds: string[],
): Promise<{ byStudent: Map<string, CycleReport[]>; extended: boolean }> => {
  const byStudent = new Map<string, CycleReport[]>();
  if (!studentIds.length) return { byStudent, extended: true };

  const push = (rows: any[], extended: boolean) => {
    rows.forEach((row) => {
      const list = byStudent.get(row.student_id) ?? [];
      list.push({
        report_date: row.report_date ?? null,
        // Without the column, a report that exists is a report that was accepted.
        status: extended ? row.status ?? null : "approved",
        due_date: extended ? row.due_date ?? null : null,
        // Absent on the older shapes, and absent reads as "no flag", which is
        // the right answer for a database that cannot hold one yet.
        flagged_at: row.flagged_at ?? null,
        flag_resolved_at: row.flag_resolved_at ?? null,
      });
      byStudent.set(row.student_id, list);
    });
  };

  const read = (columns: string) =>
    client
      .from("term_updates")
      .select(columns)
      .in("student_id", studentIds)
      .order("report_date", { ascending: false });

  // Widest shape first, narrowing once per migration that has not run. The
  // flag columns are their own step: falling straight back to the base shape
  // when they are missing would drop status and due_date with them, and every
  // student would read as "Not started".
  const flagRead = await read(
    "student_id, report_date, status, due_date, flagged_at, flag_resolved_at",
  );

  if (!flagRead.error) {
    push(flagRead.data ?? [], true);
    return { byStudent, extended: true };
  }

  const extendedRead = await read("student_id, report_date, status, due_date");

  if (!extendedRead.error) {
    push(extendedRead.data ?? [], true);
    return { byStudent, extended: true };
  }

  const baseRead = await read("student_id, report_date");

  if (baseRead.error) {
    console.error("Error loading reports", baseRead.error);
    return { byStudent, extended: false };
  }

  push(baseRead.data ?? [], false);
  return { byStudent, extended: false };
};
