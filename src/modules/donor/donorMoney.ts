// src/modules/donor/donorMoney.ts
//
// One definition of what money means in this product.
//
// Before this file, "how much has this donor given?" had no answer anywhere:
// every amount in the database was already attached to a student, so a gift
// that had arrived but not been assigned did not exist. Three screens each
// counted scholarship_awards rows their own way and called the total something
// different.
//
// So there are exactly two nouns here, and every screen reads them from this
// file:
//
//   a contribution — money in, from a donor, with no student attached
//   a coverage     — what a student needs against what they actually receive
//
// A balance is neither of those; it is arithmetic over both, and it is computed
// in the database (the `donor_balance` view) rather than stored, because a
// balance held in two places drifts and somebody acts on the stale one.

import { supabase } from "../../lib/supabaseClient";
import { isMissingColumnError } from "../admin/teacherProfile";

/** Money in. One row per gift, dated, referenced, never silently adjusted. */
export interface Contribution {
  id: string;
  donor_id: string;
  amount_thb: number;
  received_on: string;
  method: string | null;
  reference: string | null;
  note: string | null;
  voided_at: string | null;
  voided_reason: string | null;
  created_at: string | null;
}

export const CONTRIBUTION_COLUMNS =
  "id, donor_id, amount_thb, received_on, method, reference, note, voided_at, voided_reason, created_at";

/**
 * How money arrived. Free text in the database, a fixed list in the UI, because
 * a ledger where the same bank transfer is spelled four ways cannot be filtered.
 */
export const CONTRIBUTION_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "promptpay", label: "PromptPay" },
  { value: "other", label: "Other" },
] as const;

export const contributionMethodLabel = (value: string | null | undefined): string =>
  CONTRIBUTION_METHODS.find((m) => m.value === value)?.label ?? value ?? "—";

/** Given, committed, and what is left to allocate. Straight from the view. */
export interface DonorBalance {
  donor_id: string;
  donor_name: string | null;
  total_given_thb: number;
  total_committed_thb: number;
  free_balance_thb: number;
  monthly_committed_thb: number;
  /**
   * Whether the free balance covers one more month of this donor's
   * commitments.
   *
   * Computed in the view rather than here, so the donors table, the dashboard
   * count and the sentence on the balance card cannot each do the arithmetic
   * and disagree. A donor with nothing committed is always covered — they have
   * nothing to be short for.
   */
  covers_next_month: boolean;
  shortfall_next_month_thb: number;
  preferred_language: "en" | "th";
}

/** Need against received, for one student. */
export interface StudentCoverage {
  student_id: string;
  student_name: string | null;
  school_id: string | null;
  monthly_need_thb: number;
  monthly_covered_thb: number;
  monthly_gap_thb: number;
  donor_count: number;
  /**
   * Nobody has said what this student needs. Distinct from needing zero, and
   * the difference matters: a student with an unknown need must not sort to the
   * bottom of the allocation list as though they were fully funded.
   */
  need_unknown: boolean;
}

/** A donor's commitment to one student. */
export interface StudentDonorLink {
  student_id: string;
  donor_id: string;
  donor_name: string | null;
  scholarship_id: string;
  monthly_amount_thb: number;
  coverage_start: string | null;
  coverage_end: string | null;
}

const EMPTY_BALANCE = (donorId: string): DonorBalance => ({
  donor_id: donorId,
  donor_name: null,
  total_given_thb: 0,
  total_committed_thb: 0,
  free_balance_thb: 0,
  monthly_committed_thb: 0,
  covers_next_month: true,
  shortfall_next_month_thb: 0,
  preferred_language: "en",
});

/**
 * True when the funding migration has not been applied yet.
 *
 * Every read below degrades rather than throwing. PostgREST answers a query
 * against a missing view with an error, and a page that treats that as a crash
 * shows a red screen on a deploy where the code has landed and the migration
 * has not — which is the normal ordering, not an exceptional one. A zero
 * balance labelled "not set up" is honest; a blank page is not.
 */
export const isMissingRelation = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  if (isMissingColumnError(error)) return true;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("could not find the table")
  );
};

export interface MoneyRead<T> {
  data: T;
  /** False when the migration is unapplied. Screens show a setup notice. */
  available: boolean;
}

const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Balances for a set of donors, keyed by donor id. */
export const loadDonorBalances = async (
  donorIds?: string[],
): Promise<MoneyRead<Map<string, DonorBalance>>> => {
  const byDonor = new Map<string, DonorBalance>();
  if (donorIds && donorIds.length === 0) return { data: byDonor, available: true };

  let query = supabase.from("donor_balance").select("*");
  if (donorIds) query = query.in("donor_id", donorIds);

  const { data, error } = await query;

  if (error) {
    if (isMissingRelation(error)) return { data: byDonor, available: false };
    console.error("Error loading donor balances", error);
    return { data: byDonor, available: true };
  }

  (data ?? []).forEach((row: any) => {
    byDonor.set(row.donor_id, {
      donor_id: row.donor_id,
      donor_name: row.donor_name ?? null,
      total_given_thb: num(row.total_given_thb),
      total_committed_thb: num(row.total_committed_thb),
      free_balance_thb: num(row.free_balance_thb),
      monthly_committed_thb: num(row.monthly_committed_thb),
      // Absent before the alert migration. Treated as covered rather than as
      // short: inventing an alert from a column that does not exist would put
      // amber on every donor row on the day the code deploys.
      covers_next_month: row.covers_next_month ?? true,
      shortfall_next_month_thb: num(row.shortfall_next_month_thb),
      preferred_language: (row.preferred_language as "en" | "th") ?? "en",
    });
  });

  return { data: byDonor, available: true };
};

export const loadDonorBalance = async (donorId: string): Promise<MoneyRead<DonorBalance>> => {
  const { data, available } = await loadDonorBalances([donorId]);
  return { data: data.get(donorId) ?? EMPTY_BALANCE(donorId), available };
};

/** One donor's ledger, newest gift first. Voided rows stay in the list. */
export const loadContributions = async (
  donorId: string,
): Promise<MoneyRead<Contribution[]>> => {
  const { data, error } = await supabase
    .from("donor_contributions")
    .select(CONTRIBUTION_COLUMNS)
    .eq("donor_id", donorId)
    .order("received_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingRelation(error)) return { data: [], available: false };
    console.error("Error loading contributions", error);
    return { data: [], available: true };
  }

  return {
    data: (data ?? []).map((row: any) => ({ ...row, amount_thb: num(row.amount_thb) })),
    available: true,
  };
};

/** The form's shape — every value a string, as the inputs hold them. */
export interface ContributionInput {
  amount: string;
  receivedOn: string;
  method: string;
  reference: string;
  note: string;
}

export const emptyContribution = (): ContributionInput => ({
  amount: "",
  receivedOn: new Date().toISOString().slice(0, 10),
  method: "bank_transfer",
  reference: "",
  note: "",
});

export const contributionToInput = (row: Contribution): ContributionInput => ({
  amount: String(row.amount_thb ?? ""),
  receivedOn: row.received_on ?? "",
  method: row.method ?? "bank_transfer",
  reference: row.reference ?? "",
  note: row.note ?? "",
});

export type ContributionErrors = Partial<Record<keyof ContributionInput, string>>;

/**
 * Validation lives here rather than in the drawer, so the create path and the
 * edit path cannot disagree about what a valid gift is.
 */
export const validateContribution = (input: ContributionInput): ContributionErrors => {
  const errors: ContributionErrors = {};
  const amount = Number(input.amount);

  if (!input.amount.trim()) errors.amount = "Enter the amount received.";
  else if (!Number.isFinite(amount)) errors.amount = "Amount must be a number.";
  else if (amount <= 0) errors.amount = "Amount must be more than zero.";

  if (!input.receivedOn) errors.receivedOn = "Enter the date the money arrived.";
  else if (input.receivedOn > new Date().toISOString().slice(0, 10)) {
    errors.receivedOn = "This date is in the future.";
  }

  return errors;
};

const toRow = (donorId: string, input: ContributionInput) => ({
  donor_id: donorId,
  amount_thb: Number(input.amount),
  received_on: input.receivedOn,
  method: input.method || null,
  reference: input.reference.trim() || null,
  note: input.note.trim() || null,
});

export interface SaveResult {
  ok: boolean;
  /** A sentence for the form, already written for the person reading it. */
  message?: string;
}

const saveFailure = (error: { code?: string; message?: string }): SaveResult => {
  if (isMissingRelation(error)) {
    return {
      ok: false,
      message: "Contributions are not set up on this database yet. Apply the funding migration and try again.",
    };
  }
  if (error.code === "42501") {
    return { ok: false, message: "You do not have permission to record money for this donor." };
  }
  return { ok: false, message: error.message ?? "Could not save the contribution." };
};

export const createContribution = async (
  donorId: string,
  input: ContributionInput,
): Promise<SaveResult> => {
  const { data: session } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("donor_contributions")
    .insert({ ...toRow(donorId, input), created_by: session?.user?.id ?? null });

  return error ? saveFailure(error) : { ok: true };
};

export const updateContribution = async (
  id: string,
  donorId: string,
  input: ContributionInput,
): Promise<SaveResult> => {
  const { error } = await supabase
    .from("donor_contributions")
    .update({ ...toRow(donorId, input), updated_at: new Date().toISOString() })
    .eq("id", id);

  return error ? saveFailure(error) : { ok: true };
};

/**
 * Voiding, not deleting.
 *
 * A gift that was recorded and then withdrawn is itself a fact about the
 * ledger. Deleting the row would make the balance correct and the history
 * wrong, and the history is the reason anyone trusts the balance.
 */
export const voidContribution = async (id: string, reason: string): Promise<SaveResult> => {
  const { error } = await supabase
    .from("donor_contributions")
    .update({
      voided_at: new Date().toISOString(),
      voided_reason: reason.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return error ? saveFailure(error) : { ok: true };
};

export const restoreContribution = async (id: string): Promise<SaveResult> => {
  const { error } = await supabase
    .from("donor_contributions")
    .update({ voided_at: null, voided_reason: null, updated_at: new Date().toISOString() })
    .eq("id", id);

  return error ? saveFailure(error) : { ok: true };
};

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

/** Coverage for a set of students, or for everyone when ids are omitted. */
export const loadStudentCoverage = async (
  studentIds?: string[],
): Promise<MoneyRead<Map<string, StudentCoverage>>> => {
  const byStudent = new Map<string, StudentCoverage>();
  if (studentIds && studentIds.length === 0) return { data: byStudent, available: true };

  let query = supabase.from("student_coverage").select("*");
  if (studentIds) query = query.in("student_id", studentIds);

  const { data, error } = await query;

  if (error) {
    if (isMissingRelation(error)) return { data: byStudent, available: false };
    console.error("Error loading student coverage", error);
    return { data: byStudent, available: true };
  }

  (data ?? []).forEach((row: any) => {
    byStudent.set(row.student_id, {
      student_id: row.student_id,
      student_name: row.student_name ?? null,
      school_id: row.school_id ?? null,
      monthly_need_thb: num(row.monthly_need_thb),
      monthly_covered_thb: num(row.monthly_covered_thb),
      monthly_gap_thb: num(row.monthly_gap_thb),
      donor_count: Number(row.donor_count ?? 0),
      need_unknown: Boolean(row.need_unknown),
    });
  });

  return { data: byStudent, available: true };
};

/** Every donor funding a student, for the students a caller names. */
export const loadStudentDonors = async (
  studentIds: string[],
): Promise<MoneyRead<Map<string, StudentDonorLink[]>>> => {
  const byStudent = new Map<string, StudentDonorLink[]>();
  if (!studentIds.length) return { data: byStudent, available: true };

  const { data, error } = await supabase
    .from("student_donors")
    .select("*")
    .in("student_id", studentIds);

  if (error) {
    if (isMissingRelation(error)) return { data: byStudent, available: false };
    console.error("Error loading student donors", error);
    return { data: byStudent, available: true };
  }

  (data ?? []).forEach((row: any) => {
    const list = byStudent.get(row.student_id) ?? [];
    list.push({ ...row, monthly_amount_thb: num(row.monthly_amount_thb) });
    byStudent.set(row.student_id, list);
  });

  return { data: byStudent, available: true };
};

/**
 * How covered is this student, as one word.
 *
 * The tones are the platform's existing five, used the way the report badges
 * already use them, so an admin reading a students table is not learning a
 * second colour language for money.
 */
export type CoverageState = "unknown" | "uncovered" | "partial" | "funded" | "over";

export const coverageState = (coverage: StudentCoverage | undefined): CoverageState => {
  if (!coverage || coverage.need_unknown) return "unknown";
  if (coverage.monthly_need_thb <= 0) return "unknown";
  if (coverage.monthly_covered_thb <= 0) return "uncovered";
  if (coverage.monthly_covered_thb < coverage.monthly_need_thb) return "partial";
  if (coverage.monthly_covered_thb > coverage.monthly_need_thb) return "over";
  return "funded";
};

export const COVERAGE_META: Record<
  CoverageState,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  unknown: { label: "Need not set", tone: "neutral" },
  uncovered: { label: "Uncovered", tone: "danger" },
  partial: { label: "Partly funded", tone: "warning" },
  funded: { label: "Funded", tone: "success" },
  over: { label: "Over-funded", tone: "info" },
};

/**
 * Sort key for a coverage column. Higher sorts first.
 *
 * Biggest gap first, then students whose need nobody has recorded — because an
 * unknown need is a question for somebody, not a settled zero — then the funded
 * ones, quietly, at the bottom.
 *
 * Three bands rather than a bare gap: an unknown need has no gap to compare, so
 * returning -1 for it put every unanswered student *below* the fully funded
 * ones, which is the opposite of what this is for. The band carries the
 * ordering and the gap only breaks ties inside the top band.
 */
const RANK_BAND = 1e12;

/**
 * What to say about a donor whose money will not stretch to next month.
 *
 * Returns null when there is nothing to say. The wording is here rather than in
 * three components so the table chip, the dashboard count and the balance card
 * cannot describe the same state three ways.
 */
export const shortfallSentence = (balance: DonorBalance): string | null => {
  if (balance.covers_next_month) return null;
  return `Needs ${new Intl.NumberFormat("en-US").format(
    Math.round(balance.shortfall_next_month_thb),
  )} THB more to cover next month.`;
};

export const coverageRank = (coverage: StudentCoverage | undefined): number => {
  const state = coverageState(coverage);
  if (state === "unknown") return RANK_BAND;
  const gap = coverage?.monthly_gap_thb ?? 0;
  return gap > 0 ? RANK_BAND * 2 + gap : gap;
};
