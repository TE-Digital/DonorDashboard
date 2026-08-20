// src/modules/teacher/reportingCycle.ts
//
// When a teacher's next report is due.
//
// iCare collects term updates in two cycles a year — the same split the admin
// reports screen groups by: January–June is mid-year, July–December is
// year-end. A student needs one report inside the current cycle. That is the
// whole rule, and it lives here so the dashboard, the roster and any future
// reminder all answer the question the same way.
//
// Nothing about the cycle is stored. If the programme ever gets a real reporting
// calendar table, this module is the one place that has to change.

export type ReportState = "submitted" | "due" | "overdue";

export interface ReportingCycle {
  /** Stable identity for the cycle: "2026 mid-year". */
  key: string;
  label: string;
  /** First day of the cycle. */
  start: Date;
  /** Last day of the cycle — the deadline. */
  end: Date;
}

const MID_YEAR_END_MONTH = 5; // June, zero-based

export const cycleOf = (date: Date): ReportingCycle => {
  const year = date.getFullYear();
  const midYear = date.getMonth() <= MID_YEAR_END_MONTH;

  return midYear
    ? {
        key: `${year} mid-year`,
        label: `${year} mid-year`,
        start: new Date(year, 0, 1),
        end: new Date(year, 5, 30),
      }
    : {
        key: `${year} year-end`,
        label: `${year} year-end`,
        start: new Date(year, 6, 1),
        end: new Date(year, 11, 31),
      };
};

/** The cycle before the one the given date falls in. */
export const previousCycle = (cycle: ReportingCycle): ReportingCycle => {
  const dayBefore = new Date(cycle.start);
  dayBefore.setDate(dayBefore.getDate() - 1);
  return cycleOf(dayBefore);
};

const withinCycle = (date: Date, cycle: ReportingCycle) =>
  date >= cycle.start && date <= new Date(cycle.end.getFullYear(), cycle.end.getMonth(), cycle.end.getDate(), 23, 59, 59);

export interface ReportStatus {
  state: ReportState;
  /** The cycle the teacher is being asked about. */
  cycle: ReportingCycle;
  /** Deadline for this cycle. */
  dueDate: Date;
  /** Whole days until the deadline. Negative never happens — the deadline is
   *  inside the current cycle by construction. */
  daysLeft: number;
  /** True when the previous cycle was also missed. */
  missedPrevious: boolean;
}

/**
 * Where one student stands for the current cycle.
 *
 * `submitted` — a report already exists inside the current cycle.
 * `due`       — nothing yet this cycle, but the previous one was covered.
 * `overdue`   — nothing this cycle and nothing last cycle either.
 */
export const reportStatusFor = (
  reportDates: Array<string | null | undefined>,
  today: Date,
): ReportStatus => {
  const cycle = cycleOf(today);
  const earlier = previousCycle(cycle);

  const dates = reportDates
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));

  const submitted = dates.some((date) => withinCycle(date, cycle));
  const coveredPrevious = dates.some((date) => withinCycle(date, earlier));

  const dueDate = cycle.end;
  const daysLeft = Math.max(
    0,
    Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return {
    state: submitted ? "submitted" : coveredPrevious ? "due" : "overdue",
    cycle,
    dueDate,
    daysLeft,
    missedPrevious: !coveredPrevious,
  };
};

/** "in 34 days", "today" — the phrase a reminder line ends with. */
export const duePhrase = (status: ReportStatus): string => {
  if (status.daysLeft === 0) return "today";
  if (status.daysLeft === 1) return "tomorrow";
  return `in ${status.daysLeft} days`;
};

export const formatDueDate = (date: Date): string =>
  new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" }).format(date);
