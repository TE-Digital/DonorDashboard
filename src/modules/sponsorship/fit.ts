// src/modules/sponsorship/fit.ts
//
// How far a donor's money reaches for one student.
//
// "Fully covered" is measured in months, not against a fixed year: money that
// pays a student's monthly gap all the way to the end of this school year fully
// covers them; money that runs out in October covers them to October. The
// school year comes from the programme calendar, so this changes when the
// calendar does, not when somebody edits code.
//
// Only money that has arrived counts. Nothing here reserves or promises.

import { addDays, currentSchoolYear, type ProgrammeCalendar } from "../calendar/schoolCalendar";

const DAYS_PER_MONTH = 30.4375;

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Months in a window, counted from days rather than calendar arithmetic, so 1 Jan
 * to 30 Jun is six months, not five. The same rule the award copy plan uses.
 */
export const monthsInWindow = (start: string, end: string): number => {
  const days = (toDate(end).getTime() - toDate(start).getTime()) / 86_400_000 + 1;
  return Math.max(1, Math.round(days / DAYS_PER_MONTH));
};

/** The last day of a window of `months` months starting on `start`. */
export const windowEnd = (start: string, months: number): string => {
  const d = toDate(start);
  d.setUTCMonth(d.getUTCMonth() + months);
  return addDays(toIso(d), -1);
};

export type FitKind = "full" | "partial" | "none" | "unknown";

export interface Fit {
  kind: FitKind;
  /** Whole months the money pays the gap for. */
  coveredMonths: number;
  /** Months from the start to the end of the school year. */
  totalMonths: number;
  /** End of the school year. */
  yearEndsOn: string;
  /** The last day the money fully pays for, when it is short of the year. */
  paidUntil: string | null;
}

/**
 * How far `available` baht goes for a student short by `monthlyGap` a month,
 * from `start` to the end of that school year.
 */
export const fitFor = (
  monthlyGap: number,
  available: number,
  start: string,
  cal: ProgrammeCalendar,
): Fit => {
  const year = currentSchoolYear(cal);
  const yearEndsOn = year.endsOn;
  const totalMonths = start <= yearEndsOn ? monthsInWindow(start, yearEndsOn) : 1;

  if (monthlyGap <= 0) {
    return { kind: "unknown", coveredMonths: 0, totalMonths, yearEndsOn, paidUntil: null };
  }

  const affordable = Math.floor(Math.max(0, available) / monthlyGap);
  if (affordable >= totalMonths) {
    return { kind: "full", coveredMonths: totalMonths, totalMonths, yearEndsOn, paidUntil: yearEndsOn };
  }
  if (affordable <= 0) {
    return { kind: "none", coveredMonths: 0, totalMonths, yearEndsOn, paidUntil: null };
  }
  return {
    kind: "partial",
    coveredMonths: affordable,
    totalMonths,
    yearEndsOn,
    paidUntil: windowEnd(start, affordable),
  };
};

export const FIT_TONE: Record<FitKind, "success" | "warning" | "danger" | "neutral"> = {
  full: "success",
  partial: "warning",
  none: "danger",
  unknown: "neutral",
};

/** What one sponsorship commits in total: the number written to amount_thb. */
export const pledgeFor = (input: {
  supportType: "full" | "partial" | "specific_item";
  monthly: string;
  oneOff: string;
  start: string;
  end: string;
}): number => {
  if (input.supportType === "specific_item") {
    const value = Number(input.oneOff);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  const monthly = Number(input.monthly);
  if (!Number.isFinite(monthly) || monthly <= 0 || !input.start || !input.end) return 0;
  return monthly * monthsInWindow(input.start, input.end);
};
