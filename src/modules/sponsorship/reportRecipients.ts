// src/modules/sponsorship/reportRecipients.ts
//
// Who a student's report goes to, and who it doesn't and why.
//
// The send step shows every donor connected to the student, not only the ones
// who will get the email. A donor left off silently is a donor somebody later
// wonders about ("did Khun Somchai get Mali's report?"), so each person the
// report is not going to is listed with the reason in words.
//
// A donor receives the report when all of these hold: their support for this
// student is active, report emails are on for this student, they haven't
// turned off emails altogether, and they have an address. The reason codes
// match what the send dialog writes to report_deliveries.reason.
//
// Language defaults to the donor's preference and the template to the report
// default; the admin can change either per person before sending.

import { supabase } from "../../lib/supabaseClient";
import { isMissingRelation } from "../donor/donorMoney";
import { loadEmailTemplates, templateHasLanguage, type EmailTemplate } from "./emailTemplates";

export type ExclusionReason =
  | "needs_decision"
  | "support_ended"
  | "report_emails_off"
  | "donor_emails_off"
  | "no_email";

export type RecipientLanguage = "en" | "th";

export interface ReportRecipient {
  donorId: string;
  scholarshipId: string;
  name: string;
  email: string | null;
  /** The donor's saved preference; the dialog may override it for one send. */
  preferredLanguage: RecipientLanguage;
  included: boolean;
  reason: ExclusionReason | null;
}

/** Support that ended this long ago is history, not a missing recipient. */
const RECENTLY_ENDED_DAYS = 180;

const RANK: Record<string, number> = { active: 0, needs_decision: 1, ended: 2 };

export const exclusionKey = (reason: ExclusionReason) => `sponsorship.recipients.reasons.${reason}`;

export interface RecipientRead {
  data: ReportRecipient[];
  available: boolean;
}

export const loadReportRecipients = async (studentId: string): Promise<RecipientRead> => {
  const since = new Date(Date.now() - RECENTLY_ENDED_DAYS * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("scholarships")
    .select(
      "id, donor_id, status, coverage_end, report_emails_enabled, donors(name, contact, invited_email, preferred_language, wants_email_updates)",
    )
    .eq("student_id", studentId)
    .or(`status.in.(active,needs_decision),and(status.eq.ended,coverage_end.gte.${since})`);

  if (error) {
    if (!isMissingRelation(error)) console.error("Error loading report recipients", error);
    return { data: [], available: !isMissingRelation(error) };
  }

  // One line per donor: if a donor funds the student twice (an ended row and
  // its renewal), the live one speaks for them.
  const byDonor = new Map<string, any>();
  for (const row of (data ?? []) as any[]) {
    const current = byDonor.get(row.donor_id);
    if (!current || (RANK[row.status] ?? 9) < (RANK[current.status] ?? 9)) byDonor.set(row.donor_id, row);
  }

  const recipients = Array.from(byDonor.values()).map((row): ReportRecipient => {
    const donor = row.donors ?? {};
    const email = ((donor.contact?.email ?? donor.invited_email ?? "") as string).trim().toLowerCase() || null;

    let reason: ExclusionReason | null = null;
    if (row.status === "needs_decision") reason = "needs_decision";
    else if (row.status === "ended") reason = "support_ended";
    else if (row.report_emails_enabled === false) reason = "report_emails_off";
    else if (donor.wants_email_updates === false) reason = "donor_emails_off";
    else if (!email) reason = "no_email";

    return {
      donorId: row.donor_id,
      scholarshipId: row.id,
      name: donor.name ?? "",
      email,
      preferredLanguage: donor.preferred_language === "th" ? "th" : "en",
      included: reason === null,
      reason,
    };
  });

  // Who gets it first, then who doesn't, each alphabetical.
  recipients.sort((a, b) => Number(b.included) - Number(a.included) || a.name.localeCompare(b.name));
  return { data: recipients, available: true };
};

/** The report templates, with the default first; empty when templates aren't set up. */
export const loadReportTemplates = async (): Promise<EmailTemplate[]> => (await loadEmailTemplates("report")).data;

/**
 * The template to preselect for one person: the default, unless it has no
 * version in their language and another template does.
 */
export const templateFor = (templates: EmailTemplate[], language: RecipientLanguage): EmailTemplate | null => {
  const usable = templates.filter((template) => templateHasLanguage(template, language));
  return usable.find((template) => template.isDefault) ?? usable[0] ?? templates.find((t) => t.isDefault) ?? null;
};
