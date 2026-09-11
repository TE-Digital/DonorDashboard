// src/modules/sponsorship/sponsorships.ts
//
// A donor funding a student, as one definition every screen reads.
//
// In the database this is a `scholarships` row. On screen it is always "donor"
// (docs/VOICE.md: donor, never sponsor); in code it is a sponsorship, because
// that is the relationship: money from a donor, to a student, for a period,
// with a status and a few decisions attached.
//
// Every read degrades rather than throwing. Before 20260911140000 the
// relationship columns do not exist, and a Sponsors tab that empties the
// student page on that ordering is worse than one that shows the money and says
// the rest is not set up yet.

import { supabase } from "../../lib/supabaseClient";
import { isMissingRelation } from "../donor/donorMoney";

export type SponsorshipStatus = "active" | "needs_decision" | "ended";
export type SupportType = "full" | "partial" | "specific_item";
export type DecisionReason = "student_archived" | "renewal_short" | "graduated";

export interface Sponsorship {
  id: string;
  studentId: string;
  donorId: string;
  donorName: string | null;
  /** donors.wants_email_updates. Off stops every report email to this donor. */
  donorWantsEmails: boolean;
  monthlyAmountThb: number;
  totalAmountThb: number;
  coverageStart: string | null;
  coverageEnd: string | null;
  status: SponsorshipStatus;
  supportType: SupportType;
  itemDescription: string | null;
  reportEmailsEnabled: boolean;
  autoRenew: boolean;
  decisionReason: DecisionReason | null;
  decisionSince: string | null;
  welcomeSentAt: string | null;
  welcomeSkippedAt: string | null;
  endedAt: string | null;
  endedReason: string | null;
  createdAt: string | null;
}

const BASE_COLUMNS =
  "id, student_id, donor_id, amount_thb, monthly_amount_thb, coverage_start, coverage_end, status, ended_at, ended_reason, created_at, donors(name, wants_email_updates)";

/** Base columns plus everything 20260911140000_sponsorships.sql adds. */
const SPONSORSHIP_COLUMNS = `${BASE_COLUMNS}, support_type, item_description, report_emails_enabled, auto_renew, decision_reason, decision_since, welcome_sent_at, welcome_skipped_at`;

const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Old rows may still say 'inactive' until the donor-records migration runs. */
const normaliseStatus = (value: unknown): SponsorshipStatus =>
  value === "active" || value === "needs_decision" ? value : "ended";

const fromRow = (row: any): Sponsorship => ({
  id: row.id,
  studentId: row.student_id,
  donorId: row.donor_id,
  donorName: row.donors?.name ?? null,
  // A null was saved before anyone set the field; nobody asked for emails to stop.
  donorWantsEmails: row.donors?.wants_email_updates ?? true,
  monthlyAmountThb: num(row.monthly_amount_thb ?? row.amount_thb),
  totalAmountThb: num(row.amount_thb),
  coverageStart: row.coverage_start ?? null,
  coverageEnd: row.coverage_end ?? null,
  status: normaliseStatus(row.status),
  supportType: (row.support_type as SupportType) ?? "partial",
  itemDescription: row.item_description ?? null,
  reportEmailsEnabled: row.report_emails_enabled ?? true,
  autoRenew: row.auto_renew ?? true,
  decisionReason: (row.decision_reason as DecisionReason) ?? null,
  decisionSince: row.decision_since ?? null,
  welcomeSentAt: row.welcome_sent_at ?? null,
  welcomeSkippedAt: row.welcome_skipped_at ?? null,
  endedAt: row.ended_at ?? null,
  endedReason: row.ended_reason ?? null,
  createdAt: row.created_at ?? null,
});

/** Newest relationships first, with ended ones kept: they are the history. */
const STATUS_ORDER: Record<SponsorshipStatus, number> = { needs_decision: 0, active: 1, ended: 2 };

export const sortSponsorships = (rows: Sponsorship[]): Sponsorship[] =>
  [...rows].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (b.coverageStart ?? "").localeCompare(a.coverageStart ?? ""),
  );

export interface SponsorshipRead<T> {
  data: T;
  /** False when `scholarships` itself cannot be read. */
  available: boolean;
  /** False when the relationship columns are missing (before 20260911140000). */
  extended: boolean;
}

const readSponsorships = async (
  filter: { column: "student_id" | "donor_id"; ids: string[] },
): Promise<SponsorshipRead<Sponsorship[]>> => {
  if (!filter.ids.length) return { data: [], available: true, extended: true };

  const full = await supabase.from("scholarships").select(SPONSORSHIP_COLUMNS).in(filter.column, filter.ids);
  if (!full.error) {
    return { data: sortSponsorships((full.data ?? []).map(fromRow)), available: true, extended: true };
  }

  if (!isMissingRelation(full.error)) {
    console.error("Error loading sponsorships", full.error);
    return { data: [], available: true, extended: true };
  }

  const base = await supabase.from("scholarships").select(BASE_COLUMNS).in(filter.column, filter.ids);
  if (base.error) {
    if (!isMissingRelation(base.error)) console.error("Error loading sponsorships", base.error);
    return { data: [], available: !isMissingRelation(base.error), extended: false };
  }
  return { data: sortSponsorships((base.data ?? []).map(fromRow)), available: true, extended: false };
};

export const loadStudentSponsorships = (studentId: string) =>
  readSponsorships({ column: "student_id", ids: [studentId] });

export const loadSponsorshipsForStudents = (studentIds: string[]) =>
  readSponsorships({ column: "student_id", ids: studentIds });

export const loadDonorSponsorships = (donorId: string) =>
  readSponsorships({ column: "donor_id", ids: [donorId] });

/** Active donors per student, for chips and the directory column. */
export const activeDonorsByStudent = (rows: Sponsorship[]): Map<string, Sponsorship[]> => {
  const byStudent = new Map<string, Sponsorship[]>();
  rows
    .filter((row) => row.status === "active")
    .forEach((row) => byStudent.set(row.studentId, [...(byStudent.get(row.studentId) ?? []), row]));
  return byStudent;
};

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export type MissingGate = "archived" | "consent_pending" | "consent_declined" | "profile_unpublished";

export interface Eligibility {
  studentId: string;
  isEligible: boolean;
  missingGates: MissingGate[];
  activeSponsorships: number;
}

export const loadEligibility = async (
  studentIds?: string[],
): Promise<SponsorshipRead<Map<string, Eligibility>>> => {
  const byStudent = new Map<string, Eligibility>();
  if (studentIds && !studentIds.length) return { data: byStudent, available: true, extended: true };

  let query = supabase.from("student_sponsor_eligibility").select("*");
  if (studentIds) query = query.in("student_id", studentIds);
  const { data, error } = await query;

  if (error) {
    if (!isMissingRelation(error)) console.error("Error loading eligibility", error);
    return { data: byStudent, available: false, extended: false };
  }

  (data ?? []).forEach((row: any) =>
    byStudent.set(row.student_id, {
      studentId: row.student_id,
      isEligible: Boolean(row.is_eligible),
      missingGates: (row.missing_gates ?? []) as MissingGate[],
      activeSponsorships: Number(row.active_sponsorships ?? 0),
    }),
  );
  return { data: byStudent, available: true, extended: true };
};

// ---------------------------------------------------------------------------
// Vocabulary. Labels are i18n keys; tones are the platform's existing five.
// ---------------------------------------------------------------------------

export const SPONSORSHIP_STATUS_TONE: Record<SponsorshipStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  needs_decision: "warning",
  ended: "neutral",
};

export const statusKey = (status: SponsorshipStatus) => `sponsorship.status.${status}`;
export const decisionKey = (reason: DecisionReason) => `sponsorship.decision.${reason}`;
export const supportTypeKey = (type: SupportType) => `sponsorship.support.${type}`;
export const missingGateKey = (gate: MissingGate) => `sponsorship.gates.${gate}`;
