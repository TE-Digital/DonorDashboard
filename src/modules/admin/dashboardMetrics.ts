// src/modules/admin/dashboardMetrics.ts
//
// Every number the admin dashboard shows, derived in one place.
//
// The dashboard aggregates what six directories each compute their own way.
// If it did that arithmetic inline, the front page and the students page would
// eventually disagree about how many students are uncovered, and the first
// time an admin noticed they would stop believing both. So the queries and the
// derivations live here, the page renders what this returns, and a directory
// that changes its mind about a definition changes it once.
//
// Two rules run through the whole file:
//
//   Nothing is claimed that the database cannot support. scholarship_payments
//   exists and nothing writes it, so there is no "spent" figure here -- only
//   `committedThisYear`, which is what active scholarships have pledged across
//   the current year, prorated by month.
//
//   Nothing is quietly excluded. Students whose need nobody has recorded are
//   counted in `needUnknown` and reported beside the gap, because a gap that
//   drops them looks smaller than the real one. Schools with no province land
//   in their own row rather than being folded into a neighbour.

import { supabase } from "../../lib/supabaseClient";
import {
  loadDonorBalances,
  loadStudentCoverage,
  type StudentCoverage,
} from "../donor/donorMoney";
import { isMissingRelation } from "../donor/donorMoney";
import { loadCycleReports, reportCycle } from "../reports";

const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Schools with no province recorded, grouped under a name that says so. */
export const PROVINCE_UNRECORDED = "Province not recorded";

export interface FundingSummary {
  /** Pledged across this calendar year by active scholarships, prorated. */
  committedThisYearThb: number;
  /** Contributions received this calendar year. */
  receivedThisYearThb: number;
  /** Given minus committed, summed across donors. Can be negative. */
  freeBalanceThb: number;
  /** Monthly shortfall summed across students with a recorded need. */
  monthlyGapThb: number;
  /** The same shortfall over a year. The headline figure. */
  annualGapThb: number;
  /** Students carrying a shortfall above zero. */
  uncoveredStudents: number;
  /** Students nobody has recorded a need for. Said out loud, never hidden. */
  needUnknown: number;
  /** Donors sitting on unallocated money, and how much of it there is. */
  donorsWithIdleFunds: number;
  idleFundsThb: number;
}

export interface OperationCounts {
  students: number;
  teachers: number;
  schools: number;
  donors: number;
  activeScholarships: number;
  overdueReports: number;
  submittedReports: number;
  openRequests: number;
}

export interface ProvinceRow {
  province: string;
  schools: number;
  students: number;
  monthlyNeedThb: number;
  monthlyCoveredThb: number;
  monthlyGapThb: number;
  needUnknown: number;
}

export interface TrendPoint {
  /** `2026-03`. Sorts lexically, which is why it is not a Date. */
  month: string;
  label: string;
  receivedThb: number;
  allocatedThb: number;
}

export interface DashboardMetrics {
  funding: FundingSummary;
  operation: OperationCounts;
  provinces: ProvinceRow[];
  trend: TrendPoint[];
  /** False when the funding migration has not been applied. */
  moneyAvailable: boolean;
  /** False when schools.province does not exist yet. */
  geographyAvailable: boolean;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (key: string) => {
  const [year, month] = key.split("-");
  return `${MONTH_LABELS[Number(month) - 1]} ${year.slice(2)}`;
};

const parseDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * How many months of a scholarship's coverage window fall inside this year.
 *
 * A scholarship running March 2026 to February 2027 has not committed its whole
 * pledge to 2026, and counting it as though it had would overstate the year by
 * however much spills into the next one. An open-ended scholarship is treated
 * as running to the end of the year, because that is as far as this figure
 * claims to see.
 */
export const monthsInYear = (
  start: string | null,
  end: string | null,
  year: number,
): number => {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const from = parseDate(start) ?? yearStart;
  const to = parseDate(end) ?? yearEnd;

  const effectiveFrom = from > yearStart ? from : yearStart;
  const effectiveTo = to < yearEnd ? to : yearEnd;

  if (effectiveTo < effectiveFrom) return 0;

  const months =
    (effectiveTo.getFullYear() - effectiveFrom.getFullYear()) * 12 +
    (effectiveTo.getMonth() - effectiveFrom.getMonth()) +
    1;

  return Math.max(0, Math.min(12, months));
};

const EMPTY_FUNDING: FundingSummary = {
  committedThisYearThb: 0,
  receivedThisYearThb: 0,
  freeBalanceThb: 0,
  monthlyGapThb: 0,
  annualGapThb: 0,
  uncoveredStudents: 0,
  needUnknown: 0,
  donorsWithIdleFunds: 0,
  idleFundsThb: 0,
};

const countRows = async (table: string, apply?: (query: any) => any): Promise<number> => {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count, error } = await query;
  if (error) {
    console.error(`Error counting ${table}`, error);
    return 0;
  }
  return count ?? 0;
};

/**
 * The whole page, in one call.
 *
 * Reads degrade rather than throw, the way donorMoney.ts already does: a deploy
 * where the code has landed and a migration has not is the normal ordering, and
 * a dashboard that renders a red screen on that ordering is worse than one that
 * renders honest zeroes with a notice above them.
 */
export const loadDashboardMetrics = async (): Promise<DashboardMetrics> => {
  const year = new Date().getFullYear();
  const yearStartIso = `${year}-01-01`;
  const todayIso = new Date().toISOString().slice(0, 10);

  // Twelve months back, inclusive of the current one.
  const trendStart = new Date();
  trendStart.setDate(1);
  trendStart.setMonth(trendStart.getMonth() - 11);
  const trendStartIso = trendStart.toISOString().slice(0, 10);

  const [
    studentsRes,
    schoolsRes,
    donorsRes,
    teachersCount,
    activeScholarshipsCount,
    requestsCount,
    submittedCount,
    coverageRead,
    balancesRead,
    scholarshipsRes,
    contributionsRes,
  ] = await Promise.all([
    supabase.from("students").select("id, school_id, status"),
    supabase.from("schools").select("id, name, province"),
    supabase.from("donors").select("id"),
    countRows("person_roles", (q) => q.eq("role", "teacher")),
    countRows("scholarships", (q) => q.eq("status", "active")),
    countRows("contact_requests", (q) => q.eq("handled", false)),
    countRows("term_updates", (q) => q.in("status", ["submitted", "under_review"])),
    loadStudentCoverage(),
    loadDonorBalances(),
    supabase
      .from("scholarships")
      .select("id, donor_id, student_id, amount_thb, monthly_amount_thb, status, coverage_start, coverage_end, created_at")
      .eq("status", "active"),
    supabase
      .from("donor_contributions")
      .select("amount_thb, received_on, voided_at")
      .gte("received_on", trendStartIso),
  ]);

  // ---- Students in scope -------------------------------------------------
  //
  // The directories treat "enrolled" as the default view and archived students
  // as out of the way but not gone. The dashboard counts the same population,
  // so its student figure and the students page agree.
  const allStudents = (studentsRes.data ?? []) as Array<{
    id: string;
    school_id: string | null;
    status: string | null;
  }>;
  const enrolled = allStudents.filter(
    (student) => (student.status ?? "enrolled") === "enrolled",
  );
  const enrolledIds = new Set(enrolled.map((student) => student.id));

  // ---- Money -------------------------------------------------------------
  const moneyAvailable = coverageRead.available && balancesRead.available;

  const coverageByStudent = coverageRead.data;
  const balances = Array.from(balancesRead.data.values());

  let monthlyGapThb = 0;
  let uncoveredStudents = 0;
  let needUnknown = 0;

  coverageByStudent.forEach((coverage, studentId) => {
    if (!enrolledIds.has(studentId)) return;
    if (coverage.need_unknown) {
      needUnknown += 1;
      return;
    }
    if (coverage.monthly_gap_thb > 0) {
      monthlyGapThb += coverage.monthly_gap_thb;
      uncoveredStudents += 1;
    }
  });

  // A student with no coverage row at all is a student nobody has said anything
  // about. Same category as need_unknown, and counted with it rather than
  // vanishing between the two data sources.
  enrolled.forEach((student) => {
    if (!coverageByStudent.has(student.id)) needUnknown += 1;
  });

  const idleBalances = balances.filter((balance) => balance.free_balance_thb > 0);
  const freeBalanceThb = balances.reduce(
    (total, balance) => total + balance.free_balance_thb,
    0,
  );

  const scholarships = (scholarshipsRes.error ? [] : scholarshipsRes.data ?? []) as Array<{
    amount_thb: unknown;
    monthly_amount_thb: unknown;
    coverage_start: string | null;
    coverage_end: string | null;
    created_at: string | null;
  }>;

  const committedThisYearThb = scholarships.reduce((total, row) => {
    const monthly = num(row.monthly_amount_thb) || num(row.amount_thb);
    return total + monthly * monthsInYear(row.coverage_start, row.coverage_end, year);
  }, 0);

  const contributions = (
    contributionsRes.error && isMissingRelation(contributionsRes.error)
      ? []
      : contributionsRes.data ?? []
  ) as Array<{ amount_thb: unknown; received_on: string; voided_at: string | null }>;

  const liveContributions = contributions.filter((row) => !row.voided_at);

  const receivedThisYearThb = liveContributions
    .filter((row) => row.received_on >= yearStartIso && row.received_on <= todayIso)
    .reduce((total, row) => total + num(row.amount_thb), 0);

  const funding: FundingSummary = moneyAvailable
    ? {
        committedThisYearThb,
        receivedThisYearThb,
        freeBalanceThb,
        monthlyGapThb,
        annualGapThb: monthlyGapThb * 12,
        uncoveredStudents,
        needUnknown,
        donorsWithIdleFunds: idleBalances.length,
        idleFundsThb: idleBalances.reduce(
          (total, balance) => total + balance.free_balance_thb,
          0,
        ),
      }
    : EMPTY_FUNDING;

  // ---- Reports -----------------------------------------------------------
  //
  // Overdue is not recomputed here. reportStatus.ts owns the reporting cycle --
  // an open flag outranks a date, a report in review is not late, the period
  // comes from the school -- and a second implementation on the dashboard would
  // be a second set of rules that drifts from the first.
  const { byStudent } = await loadCycleReports(supabase, Array.from(enrolledIds));

  const overdueReports = enrolled.filter((student) => {
    const cycle = reportCycle(byStudent.get(student.id) ?? []);
    return cycle.state === "overdue";
  }).length;

  // ---- Geography ---------------------------------------------------------
  const geographyAvailable = !(
    schoolsRes.error && isMissingRelation(schoolsRes.error)
  );

  const schools = (schoolsRes.data ?? []) as Array<{
    id: string;
    name: string | null;
    province?: string | null;
  }>;

  const provinceOf = new Map<string, string>();
  schools.forEach((school) => {
    const province = (school.province ?? "").trim();
    provinceOf.set(school.id, province || PROVINCE_UNRECORDED);
  });

  const provinceRows = new Map<string, ProvinceRow>();
  const provinceRow = (province: string): ProvinceRow => {
    const existing = provinceRows.get(province);
    if (existing) return existing;
    const created: ProvinceRow = {
      province,
      schools: 0,
      students: 0,
      monthlyNeedThb: 0,
      monthlyCoveredThb: 0,
      monthlyGapThb: 0,
      needUnknown: 0,
    };
    provinceRows.set(province, created);
    return created;
  };

  schools.forEach((school) => {
    provinceRow(provinceOf.get(school.id) ?? PROVINCE_UNRECORDED).schools += 1;
  });

  enrolled.forEach((student) => {
    const province = student.school_id
      ? provinceOf.get(student.school_id) ?? PROVINCE_UNRECORDED
      : PROVINCE_UNRECORDED;
    const row = provinceRow(province);
    row.students += 1;

    const coverage: StudentCoverage | undefined = coverageByStudent.get(student.id);
    if (!coverage || coverage.need_unknown) {
      row.needUnknown += 1;
      return;
    }
    row.monthlyNeedThb += coverage.monthly_need_thb;
    row.monthlyCoveredThb += coverage.monthly_covered_thb;
    row.monthlyGapThb += coverage.monthly_gap_thb;
  });

  // Ranked by what is missing. A province where everyone is funded is quiet;
  // the one with the largest shortfall is the first thing read.
  const provinces = Array.from(provinceRows.values()).sort(
    (a, b) =>
      b.monthlyGapThb - a.monthlyGapThb ||
      b.students - a.students ||
      a.province.localeCompare(b.province),
  );

  // ---- Trend -------------------------------------------------------------
  //
  // Received against allocated, by month. Allocation is dated by when the
  // scholarship was written, not when its coverage starts: the question the
  // chart answers is whether money is being placed as fast as it arrives, and
  // that is a question about the act of allocating.
  const months: string[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() - 11);
  for (let index = 0; index < 12; index += 1) {
    months.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const received = new Map<string, number>();
  liveContributions.forEach((row) => {
    const key = (row.received_on ?? "").slice(0, 7);
    received.set(key, (received.get(key) ?? 0) + num(row.amount_thb));
  });

  const allocated = new Map<string, number>();
  scholarships.forEach((row) => {
    const dated = row.created_at ?? row.coverage_start;
    if (!dated) return;
    const key = dated.slice(0, 7);
    allocated.set(key, (allocated.get(key) ?? 0) + num(row.amount_thb));
  });

  const trend: TrendPoint[] = months.map((month) => ({
    month,
    label: monthLabel(month),
    receivedThb: received.get(month) ?? 0,
    allocatedThb: allocated.get(month) ?? 0,
  }));

  return {
    funding,
    operation: {
      students: enrolled.length,
      teachers: teachersCount,
      schools: (schoolsRes.data ?? []).length,
      donors: (donorsRes.data ?? []).length,
      activeScholarships: activeScholarshipsCount,
      overdueReports,
      submittedReports: submittedCount,
      openRequests: requestsCount,
    },
    provinces,
    trend,
    moneyAvailable,
    geographyAvailable,
  };
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const csvRow = (cells: unknown[]) => cells.map(csvCell).join(",");

/**
 * The rows behind the page, as one CSV.
 *
 * Sectioned rather than split across files, because the thing an admin is
 * asked for is "the dashboard", and four downloads to reassemble in a meeting
 * is not that. Each section carries its own header row, so a spreadsheet opens
 * it without anyone having to know the shape in advance.
 */
export const dashboardCsv = (metrics: DashboardMetrics): string => {
  const year = new Date().getFullYear();
  const lines: string[] = [];

  lines.push(csvRow(["iCare dashboard export"]));
  lines.push(csvRow(["Generated", new Date().toISOString()]));
  lines.push("");

  lines.push(csvRow(["Funding"]));
  lines.push(csvRow(["Measure", "Value (THB)", "Note"]));
  lines.push(
    csvRow([
      `Committed ${year}`,
      metrics.funding.committedThisYearThb,
      "Active scholarships, prorated across the year. Pledged, not disbursed.",
    ]),
  );
  lines.push(csvRow([`Received ${year}`, metrics.funding.receivedThisYearThb, "Contributions recorded this year"]));
  lines.push(csvRow(["Unallocated balance", metrics.funding.freeBalanceThb, `Held by ${metrics.funding.donorsWithIdleFunds} donors`]));
  lines.push(csvRow(["Monthly gap", metrics.funding.monthlyGapThb, `${metrics.funding.uncoveredStudents} students short`]));
  lines.push(csvRow(["Annual gap", metrics.funding.annualGapThb, "Monthly gap over twelve months"]));
  lines.push(csvRow(["Students with no recorded need", metrics.funding.needUnknown, "Excluded from the gap above"]));
  lines.push("");

  lines.push(csvRow(["Operation"]));
  lines.push(csvRow(["Measure", "Count"]));
  lines.push(csvRow(["Students enrolled", metrics.operation.students]));
  lines.push(csvRow(["Schools", metrics.operation.schools]));
  lines.push(csvRow(["Teachers", metrics.operation.teachers]));
  lines.push(csvRow(["Donors", metrics.operation.donors]));
  lines.push(csvRow(["Active scholarships", metrics.operation.activeScholarships]));
  lines.push(csvRow(["Reports overdue", metrics.operation.overdueReports]));
  lines.push(csvRow(["Reports awaiting verification", metrics.operation.submittedReports]));
  lines.push(csvRow(["Open contact requests", metrics.operation.openRequests]));
  lines.push("");

  lines.push(csvRow(["Provinces"]));
  lines.push(
    csvRow([
      "Province",
      "Schools",
      "Students",
      "Monthly need (THB)",
      "Monthly covered (THB)",
      "Monthly gap (THB)",
      "Need not recorded",
    ]),
  );
  metrics.provinces.forEach((row) => {
    lines.push(
      csvRow([
        row.province,
        row.schools,
        row.students,
        row.monthlyNeedThb,
        row.monthlyCoveredThb,
        row.monthlyGapThb,
        row.needUnknown,
      ]),
    );
  });
  lines.push("");

  lines.push(csvRow(["Received against allocated, by month"]));
  lines.push(csvRow(["Month", "Received (THB)", "Allocated (THB)"]));
  metrics.trend.forEach((point) => {
    lines.push(csvRow([point.month, point.receivedThb, point.allocatedThb]));
  });

  return lines.join("\n");
};

export const downloadDashboardCsv = (metrics: DashboardMetrics): void => {
  const blob = new Blob([dashboardCsv(metrics)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dashboard_export_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

// ---------------------------------------------------------------------------
// Today
// ---------------------------------------------------------------------------

/**
 * The work waiting, as items rather than counts.
 *
 * The dashboard's action band used to be three tiles holding three numbers, and
 * a number is not a piece of work: "4 reports to verify" is something you have
 * to open another screen to act on. These are the individual things -- this
 * report, from this teacher, about this child, waiting this long -- so the rail
 * can be worked from rather than merely read.
 *
 * Ordered by how long each has waited, longest first. Deliberately NOT "things
 * that arrived today": a report submitted nine days ago and still unread is
 * more today's problem than one that came in this morning, and a rail that
 * showed only today's arrivals would quietly drop it.
 */
export type TodayKind = "flagged" | "verify" | "allocate" | "request";

export interface TodayItem {
  id: string;
  kind: TodayKind;
  title: string;
  detail: string;
  /** Days since the thing started waiting. Null when it has no clock. */
  waitingDays: number | null;
  /** Where acting on it happens. The rail links out; it never acts in place. */
  href: string;
}

const RANK: Record<TodayKind, number> = {
  flagged: 0,
  verify: 1,
  allocate: 2,
  request: 3,
};

const daysSince = (value: string | null | undefined): number | null => {
  const date = parseDate(value);
  if (!date) return null;
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  return days < 0 ? 0 : days;
};

const waitLabel = (days: number | null): string => {
  if (days === null) return "waiting";
  if (days === 0) return "today";
  if (days === 1) return "1 day waiting";
  return `${days} days waiting`;
};

export const loadTodayItems = async (
  funding: FundingSummary,
  openRequests: number,
): Promise<TodayItem[]> => {
  const items: TodayItem[] = [];

  // Reports first: they are the only work with a person on each end -- a
  // teacher who wrote one, and a donor who cannot see it until somebody reads
  // it.
  const reportRead = await supabase
    .from("term_updates")
    .select("id, student_id, status, created_at, report_date")
    .in("status", ["submitted", "under_review"])
    .order("created_at", { ascending: true })
    .limit(50);

  const reports = (reportRead.error ? [] : reportRead.data ?? []) as Array<{
    id: string;
    student_id: string | null;
    status: string | null;
    created_at: string | null;
    report_date: string | null;
  }>;

  // Flags are read separately for the reason AdminReportsBetaPage documents:
  // naming a column the database does not have fails the whole select, and a
  // deploy can land ahead of its migration.
  const flagRead = reports.length
    ? await supabase
        .from("term_updates")
        .select("id, flagged_at, flag_resolved_at")
        .in("id", reports.map((report) => report.id))
    : { data: [] as any[], error: null };

  const flagged = new Set<string>(
    flagRead.error
      ? []
      : ((flagRead.data ?? []) as any[])
          .filter((row) => row.flagged_at && !row.flag_resolved_at)
          .map((row) => row.id),
  );

  const studentIds = Array.from(
    new Set(reports.map((report) => report.student_id).filter(Boolean)),
  ) as string[];

  const studentRead = studentIds.length
    ? await supabase
        .from("students")
        .select("id, name, school_id, responsible_teacher_id")
        .in("id", studentIds)
    : { data: [] as any[] };

  const students = (studentRead.data ?? []) as Array<{
    id: string;
    name: string | null;
    school_id: string | null;
    responsible_teacher_id: string | null;
  }>;

  const teacherIds = Array.from(
    new Set(students.map((student) => student.responsible_teacher_id).filter(Boolean)),
  ) as string[];
  const schoolIds = Array.from(
    new Set(students.map((student) => student.school_id).filter(Boolean)),
  ) as string[];

  const [teacherRead, schoolRead] = await Promise.all([
    teacherIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", teacherIds)
      : Promise.resolve({ data: [] as any[] }),
    schoolIds.length
      ? supabase.from("schools").select("id, name").in("id", schoolIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const studentById = new Map(students.map((student) => [student.id, student]));
  const teacherById = new Map(
    ((teacherRead.data ?? []) as any[]).map((row) => [row.id, row.full_name as string | null]),
  );
  const schoolById = new Map(
    ((schoolRead.data ?? []) as any[]).map((row) => [row.id, row.name as string | null]),
  );

  reports.forEach((report) => {
    const student = report.student_id ? studentById.get(report.student_id) : undefined;
    const teacher = student?.responsible_teacher_id
      ? teacherById.get(student.responsible_teacher_id)
      : null;
    const school = student?.school_id ? schoolById.get(student.school_id) : null;
    const isFlagged = flagged.has(report.id);

    items.push({
      id: report.id,
      kind: isFlagged ? "flagged" : "verify",
      title: isFlagged
        ? `Answer a question about ${student?.name ?? "a student"}`
        : `Verify · ${student?.name ?? "Unnamed student"}`,
      detail: [teacher, school].filter(Boolean).join(" · ") || "No teacher recorded",
      waitingDays: daysSince(report.created_at ?? report.report_date),
      href: `/admin/reports/${report.id}/verify`,
    });
  });

  if (funding.donorsWithIdleFunds > 0) {
    items.push({
      id: "allocate",
      kind: "allocate",
      title: `Allocate ${formatCurrencyForRail(funding.idleFundsThb)}`,
      detail: `Unallocated across ${funding.donorsWithIdleFunds} donors`,
      waitingDays: null,
      href: "/admin/donors?balance=idle",
    });
  }

  if (openRequests > 0) {
    items.push({
      id: "requests",
      kind: "request",
      title: `Answer ${openRequests} contact ${openRequests === 1 ? "request" : "requests"}`,
      detail: "Nobody has handled these yet",
      waitingDays: null,
      href: "/admin/contact-requests",
    });
  }

  // A flag outranks everything -- a donor asked a question and is waiting on a
  // person. Within a kind, longest wait first.
  return items.sort(
    (a, b) =>
      RANK[a.kind] - RANK[b.kind] ||
      (b.waitingDays ?? -1) - (a.waitingDays ?? -1) ||
      a.title.localeCompare(b.title),
  );
};

export const todayWaitLabel = waitLabel;

/** Baht, whole, for the rail. Kept local so this module owns its own strings. */
function formatCurrencyForRail(value: number): string {
  return `฿${Math.round(value).toLocaleString("en-US")}`;
}
