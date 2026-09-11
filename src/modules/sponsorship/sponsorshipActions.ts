// src/modules/sponsorship/sponsorshipActions.ts
//
// Changing a sponsorship after it exists: its terms, its two switches, and
// ending it.
//
// Ending writes two tables (the row and the money released), so it goes through
// the end_sponsorship database function, which does both or neither. The rest
// touch one row each and are ordinary updates.

import { supabase } from "../../lib/supabaseClient";
import { isMissingRelation } from "../donor/donorMoney";
import { logEvent } from "../admin/studentEvents";
import { monthsInWindow, pledgeFor } from "./fit";
import { schoolYear, type ProgrammeCalendar } from "../calendar/schoolCalendar";
import type { SponsorshipDraft } from "./SponsorshipFields";
import type { Sponsorship } from "./sponsorships";

export type ActionFailure = "not_set_up" | "not_allowed" | "failed";

export interface ActionResult {
  ok: boolean;
  reason?: ActionFailure;
}

const failure = (error: { code?: string; message?: string }): ActionResult => {
  if (isMissingRelation(error) || error.code === "PGRST202") return { ok: false, reason: "not_set_up" };
  if (error.code === "42501") return { ok: false, reason: "not_allowed" };
  console.error("Sponsorship action failed", error);
  return { ok: false, reason: "failed" };
};

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * What ending today would give back to the donor. Mirrors end_sponsorship in
 * 20260911150000 so the confirm dialog names the same amount the database will
 * release.
 */
export const releasePreview = (row: Sponsorship, on = todayIso()): number => {
  if (row.supportType === "specific_item") return 0;
  if (row.coverageStart && on < row.coverageStart) return row.totalAmountThb;
  if (row.coverageEnd && on >= row.coverageEnd) return 0;
  if (!row.coverageStart) return 0;
  const used = Math.min(row.totalAmountThb, row.monthlyAmountThb * monthsInWindow(row.coverageStart, on));
  return Math.max(0, Math.round((row.totalAmountThb - used) * 100) / 100);
};

export const endSponsorship = async (
  row: Sponsorship,
  reason: string,
  studentName: string,
): Promise<ActionResult & { released: number }> => {
  const { data, error } = await supabase.rpc("end_sponsorship", { p_id: row.id, p_reason: reason });
  if (error) return { ...failure(error), released: 0 };

  const released = Number(data ?? 0);
  await logEvent(row.studentId, "scholarship_changed", `${row.donorName ?? "A donor"} stopped funding ${studentName}`, {
    scholarship_id: row.id,
    donor_id: row.donorId,
    reason,
    released_thb: released,
  });
  return { ok: true, released };
};

/**
 * What renewing would cost: the next school year after this support ends, at
 * the same monthly amount. Mirrors renew_sponsorship in 20260911180000.
 */
export const renewalPreview = (
  row: Sponsorship,
  cal: ProgrammeCalendar,
): { start: string; end: string; amount: number } => {
  const after = row.coverageEnd ?? new Date().toISOString().slice(0, 10);
  let year = Number(after.slice(0, 4));
  let sy = schoolYear(year, cal);
  if (sy.startsOn <= after) {
    year += 1;
    sy = schoolYear(year, cal);
  }
  return { start: sy.startsOn, end: sy.endsOn, amount: row.monthlyAmountThb * monthsInWindow(sy.startsOn, sy.endsOn) };
};

export const renewSponsorship = async (row: Sponsorship): Promise<ActionResult> => {
  const { error } = await supabase.rpc("renew_sponsorship", { p_id: row.id });
  if (!error) return { ok: true };
  // The database refuses a renewal the balance can't cover; say that, not "failed".
  if (error.code === "23514") return { ok: false, reason: "failed" };
  return failure(error);
};

export const setSponsorshipSwitch = async (
  row: Sponsorship,
  field: "report_emails_enabled" | "auto_renew",
  value: boolean,
): Promise<ActionResult> => {
  const { error } = await supabase.from("scholarships").update({ [field]: value }).eq("id", row.id);
  if (error) return failure(error);

  const what = field === "report_emails_enabled" ? "Report emails" : "Renewal";
  await logEvent(
    row.studentId,
    "scholarship_changed",
    `${what} turned ${value ? "on" : "off"} for ${row.donorName ?? "a donor"}`,
    { scholarship_id: row.id, [field]: value },
  );
  return { ok: true };
};

export const draftFromSponsorship = (row: Sponsorship): SponsorshipDraft => ({
  supportType: row.supportType,
  monthly: row.supportType === "specific_item" ? "" : String(row.monthlyAmountThb || ""),
  oneOff: row.supportType === "specific_item" ? String(row.totalAmountThb || "") : "",
  item: row.itemDescription ?? "",
  start: row.coverageStart ?? todayIso(),
  end: row.coverageEnd ?? "",
  emails: row.reportEmailsEnabled,
  renew: row.autoRenew,
  shortenedTo: null,
});

export const updateSponsorship = async (
  row: Sponsorship,
  draft: SponsorshipDraft,
  studentName: string,
): Promise<ActionResult> => {
  const specific = draft.supportType === "specific_item";
  const { error } = await supabase
    .from("scholarships")
    .update({
      support_type: draft.supportType,
      item_description: specific ? draft.item.trim() : null,
      monthly_amount_thb: specific ? 0 : Number(draft.monthly),
      amount_thb: pledgeFor(draft),
      coverage_start: draft.start,
      coverage_end: specific ? draft.start : draft.end || null,
      report_emails_enabled: draft.emails,
      auto_renew: specific ? false : draft.renew,
    })
    .eq("id", row.id);

  if (error) return failure(error);

  await logEvent(row.studentId, "scholarship_changed", `${row.donorName ?? "A donor"}'s support for ${studentName} changed`, {
    scholarship_id: row.id,
    before: { monthly: row.monthlyAmountThb, total: row.totalAmountThb, start: row.coverageStart, end: row.coverageEnd },
    after: { monthly: Number(draft.monthly) || 0, total: pledgeFor(draft), start: draft.start, end: draft.end },
  });
  return { ok: true };
};
