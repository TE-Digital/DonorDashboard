// src/modules/calendar/schoolCalendar.ts
//
// The Thai school calendar, as the product understands it.
//
// The rules live in one database row (`programme_settings`) and are month-day
// strings, because a school year is a rule that repeats: "16 May", not
// "16 May 2026". This file turns those rules into real dates for a given school
// year, so the settings preview, the sponsorship drawer and the renewal job all
// agree on when a year starts and ends.
//
// Years are Western everywhere. Buddhist Era display is out of scope for now,
// and when it arrives it belongs in `formatDate`, not here.

import { supabase } from "../../lib/supabaseClient";
import { isMissingRelation } from "../donor/donorMoney";

export interface ProgrammeCalendar {
  schoolYearStart: string;
  schoolYearEnd: string;
  semester1Start: string;
  semester1End: string;
  semester2Start: string;
  semester2End: string;
  reportDueAfterDays: number;
}

/** The Thai academic year. Also what the migration seeds. */
export const DEFAULT_CALENDAR: ProgrammeCalendar = {
  schoolYearStart: "05-16",
  schoolYearEnd: "03-31",
  semester1Start: "05-16",
  semester1End: "10-10",
  semester2Start: "11-01",
  semester2End: "03-31",
  reportDueAfterDays: 21,
};

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n: number) => String(n).padStart(2, "0");

export const monthDay = (month: number, day: number): string => `${pad(month)}-${pad(day)}`;

export const splitMonthDay = (md: string): { month: number; day: number } => {
  const [m, d] = md.split("-").map(Number);
  return { month: m || 1, day: d || 1 };
};

/** Days in a month, ignoring leap years: 29 February is not an allowed rule. */
export const daysInMonth = (month: number): number => [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31;

/**
 * The ISO date a month-day rule falls on inside the school year starting in
 * `year`. Rules earlier than the school year's own start belong to the next
 * calendar year: 03-31 in the 2026 school year is 2027-03-31. Mirrors
 * `public.school_year_date` in the migration.
 */
export const schoolYearDate = (year: number, md: string, anchorMd: string): string =>
  `${md >= anchorMd ? year : year + 1}-${md}`;

export const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** "2026–27". The dash is produced here, never typed into copy. */
export const formatSchoolYear = (startYear: number): string =>
  `${startYear}–${pad((startYear + 1) % 100)}`;

export interface SchoolYear {
  startYear: number;
  label: string;
  startsOn: string;
  endsOn: string;
  semesters: Array<{ number: 1 | 2; startsOn: string; endsOn: string; reportDueOn: string }>;
}

export const schoolYear = (startYear: number, cal: ProgrammeCalendar): SchoolYear => {
  const anchor = cal.schoolYearStart;
  const s1End = schoolYearDate(startYear, cal.semester1End, anchor);
  const s2End = schoolYearDate(startYear, cal.semester2End, anchor);
  return {
    startYear,
    label: formatSchoolYear(startYear),
    startsOn: schoolYearDate(startYear, cal.schoolYearStart, anchor),
    endsOn: schoolYearDate(startYear, cal.schoolYearEnd, anchor),
    semesters: [
      {
        number: 1,
        startsOn: schoolYearDate(startYear, cal.semester1Start, anchor),
        endsOn: s1End,
        reportDueOn: addDays(s1End, cal.reportDueAfterDays),
      },
      {
        number: 2,
        startsOn: schoolYearDate(startYear, cal.semester2Start, anchor),
        endsOn: s2End,
        reportDueOn: addDays(s2End, cal.reportDueAfterDays),
      },
    ],
  };
};

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * The school year a date belongs to, or the next one when the date falls in
 * the break between years (April to mid-May). Planning from the break always
 * means planning for the year about to start.
 */
export const schoolYearFor = (iso: string, cal: ProgrammeCalendar): SchoolYear => {
  const year = Number(iso.slice(0, 4));
  for (const start of [year - 1, year]) {
    const sy = schoolYear(start, cal);
    if (iso >= sy.startsOn && iso <= sy.endsOn) return sy;
  }
  const thisYear = schoolYear(year, cal);
  return iso < thisYear.startsOn ? thisYear : schoolYear(year + 1, cal);
};

export const currentSchoolYear = (cal: ProgrammeCalendar): SchoolYear => schoolYearFor(todayIso(), cal);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Field → i18n key under `calendar.errors`. Screens translate; this file never holds copy. */
export type CalendarErrors = Partial<Record<keyof ProgrammeCalendar, string>>;

/**
 * Checks one real school year built from the rules, so every comparison is
 * between dates rather than between month-day strings that wrap around the new
 * year.
 */
export const validateCalendar = (cal: ProgrammeCalendar): CalendarErrors => {
  const errors: CalendarErrors = {};
  const sy = schoolYear(2026, cal);
  const [s1, s2] = sy.semesters;

  if (sy.endsOn <= sy.startsOn) errors.schoolYearEnd = "calendar.errors.yearEndBeforeStart";
  if (s1.startsOn < sy.startsOn) errors.semester1Start = "calendar.errors.semester1BeforeYear";
  if (s1.endsOn <= s1.startsOn) errors.semester1End = "calendar.errors.semester1EndBeforeStart";
  if (s2.startsOn <= s1.endsOn) errors.semester2Start = "calendar.errors.semester2BeforeSemester1Ends";
  if (s2.endsOn <= s2.startsOn) errors.semester2End = "calendar.errors.semester2EndBeforeStart";
  else if (s2.endsOn > sy.endsOn) errors.semester2End = "calendar.errors.semester2AfterYear";

  if (!Number.isInteger(cal.reportDueAfterDays) || cal.reportDueAfterDays < 0 || cal.reportDueAfterDays > 120) {
    errors.reportDueAfterDays = "calendar.errors.dueDays";
  }
  return errors;
};

// ---------------------------------------------------------------------------
// Reading and saving
// ---------------------------------------------------------------------------

const fromRow = (row: any): ProgrammeCalendar => ({
  schoolYearStart: row.school_year_start ?? DEFAULT_CALENDAR.schoolYearStart,
  schoolYearEnd: row.school_year_end ?? DEFAULT_CALENDAR.schoolYearEnd,
  semester1Start: row.semester1_start ?? DEFAULT_CALENDAR.semester1Start,
  semester1End: row.semester1_end ?? DEFAULT_CALENDAR.semester1End,
  semester2Start: row.semester2_start ?? DEFAULT_CALENDAR.semester2Start,
  semester2End: row.semester2_end ?? DEFAULT_CALENDAR.semester2End,
  reportDueAfterDays: Number(row.report_due_after_days ?? DEFAULT_CALENDAR.reportDueAfterDays),
});

export interface CalendarRead {
  data: ProgrammeCalendar;
  /** False before the calendar migration is applied; the defaults are used. */
  available: boolean;
}

export const loadProgrammeCalendar = async (): Promise<CalendarRead> => {
  const { data, error } = await supabase
    .from("programme_settings")
    .select("*")
    .eq("id", "global")
    .maybeSingle();

  if (error) {
    if (!isMissingRelation(error)) console.error("Error loading the school calendar", error);
    return { data: DEFAULT_CALENDAR, available: !isMissingRelation(error) };
  }
  return { data: data ? fromRow(data) : DEFAULT_CALENDAR, available: true };
};

export interface CalendarSaveResult {
  ok: boolean;
  /** Why it failed. The screen owns the sentence, in the reader's language. */
  reason?: "not_set_up" | "not_allowed" | "failed";
}

export const saveProgrammeCalendar = async (cal: ProgrammeCalendar): Promise<CalendarSaveResult> => {
  const { error } = await supabase
    .from("programme_settings")
    .update({
      school_year_start: cal.schoolYearStart,
      school_year_end: cal.schoolYearEnd,
      semester1_start: cal.semester1Start,
      semester1_end: cal.semester1End,
      semester2_start: cal.semester2Start,
      semester2_end: cal.semester2End,
      report_due_after_days: cal.reportDueAfterDays,
    })
    .eq("id", "global");

  if (!error) return { ok: true };
  if (isMissingRelation(error)) return { ok: false, reason: "not_set_up" };
  if (error.code === "42501") return { ok: false, reason: "not_allowed" };
  console.error("Error saving the school calendar", error);
  return { ok: false, reason: "failed" };
};
