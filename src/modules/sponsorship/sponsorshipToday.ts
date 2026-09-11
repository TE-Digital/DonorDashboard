// src/modules/sponsorship/sponsorshipToday.ts
//
// The donor work waiting on an admin, as items for the dashboard's Today rail.
//
// Four kinds, each one a specific thing to do rather than a count:
//
//   * a donor whose free money could fund students who are waiting for one,
//   * a new donor and student who have not had their welcome email,
//   * support waiting on a decision (the student left, or renewal fell short),
//     which turns urgent after a month because that student's reports are
//     reaching nobody in the meantime,
//   * support ending within a month, so the admin can talk to the donor first.
//
// Every read degrades to nothing rather than failing the dashboard: a rail with
// fewer items is honest on a database without the sponsorship migration; a red
// screen is not.

import i18n from "../../i18n";
import { formatCurrency, formatDate } from "../../design-system";
import { supabase } from "../../lib/supabaseClient";
import { isMissingRelation, loadDonorBalances, loadStudentCoverage } from "../donor/donorMoney";
import type { TodayItem } from "../admin/dashboardMetrics";
import { decisionKey, type DecisionReason } from "./sponsorships";

/** More donors than this with money to give become one item, not a wall of them. */
const MAX_DONOR_ITEMS = 5;
/** A decision left this long turns the item urgent. */
export const ESCALATE_AFTER_DAYS = 30;
/** How far ahead an ending is worth mentioning. */
const RENEWAL_NOTICE_DAYS = 30;

const DAY_MS = 86_400_000;

const todayIso = () => new Date().toISOString().slice(0, 10);

const daysSince = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / DAY_MS));
};

const addDaysIso = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);

interface LiveRow {
  id: string;
  student_id: string;
  donor_id: string;
  status: string;
  coverage_end: string | null;
  auto_renew: boolean | null;
  decision_reason: DecisionReason | null;
  decision_since: string | null;
  welcome_sent_at: string | null;
  welcome_skipped_at: string | null;
  created_at: string | null;
  students: { name: string | null; nickname: string | null } | null;
  donors: { name: string | null } | null;
}

const relationshipItems = async (): Promise<TodayItem[]> => {
  const t = i18n.t.bind(i18n);
  const { data, error } = await supabase
    .from("scholarships")
    .select(
      "id, student_id, donor_id, status, coverage_end, auto_renew, decision_reason, decision_since, welcome_sent_at, welcome_skipped_at, created_at, students(name, nickname), donors(name)",
    )
    .in("status", ["active", "needs_decision"]);

  if (error) {
    if (!isMissingRelation(error)) console.error("Error loading donor work for Today", error);
    return [];
  }

  const items: TodayItem[] = [];
  const today = todayIso();
  const noticeUntil = addDaysIso(RENEWAL_NOTICE_DAYS);

  ((data ?? []) as unknown as LiveRow[]).forEach((row) => {
    const donor = row.donors?.name ?? t("donorCard.aDonor");
    const student = row.students?.nickname || row.students?.name || t("sponsorship.today.aStudent");
    const tab = `/admin/students/${row.student_id}?tab=donors`;

    if (row.status === "needs_decision") {
      const waited = daysSince(row.decision_since);
      const urgent = (waited ?? 0) > ESCALATE_AFTER_DAYS;
      const reason = row.decision_reason ? t(decisionKey(row.decision_reason)) : "";
      items.push({
        id: `decision-${row.id}`,
        kind: "decision",
        title: t("sponsorship.today.decision", { donor }),
        detail: t(urgent ? "sponsorship.today.decisionDetailUrgent" : "sponsorship.today.decisionDetail", {
          student,
          reason,
        }),
        waitingDays: waited,
        href: `${tab}&decide=${row.id}`,
        urgent,
      });
      return;
    }

    if (!row.welcome_sent_at && !row.welcome_skipped_at) {
      items.push({
        id: `welcome-${row.id}`,
        kind: "welcome",
        title: t("sponsorship.today.welcome", { donor }),
        detail: t("sponsorship.today.welcomeDetail", { student }),
        waitingDays: daysSince(row.created_at),
        href: `${tab}&welcome=${row.id}`,
      });
    }

    if (row.coverage_end && row.coverage_end >= today && row.coverage_end <= noticeUntil) {
      items.push({
        id: `renewal-${row.id}`,
        kind: "renewal",
        title: t("sponsorship.today.renewal", { student, donor, date: formatDate(row.coverage_end) }),
        detail: row.auto_renew
          ? t("sponsorship.today.renewalAuto", { donor })
          : t("sponsorship.today.renewalOff"),
        waitingDays: null,
        href: tab,
      });
    }
  });

  return items;
};

/**
 * Donors whose free money could fund a student who is waiting for a donor.
 *
 * "Could fund" means at least one month of that student's gap: a balance too
 * small to help anybody is not work, and does not keep reminding.
 */
const canHelpItems = async (): Promise<TodayItem[]> => {
  const t = i18n.t.bind(i18n);
  const { data, error } = await supabase
    .from("student_sponsor_eligibility")
    .select("student_id")
    .eq("is_eligible", true)
    .eq("active_sponsorships", 0);

  if (error) {
    if (!isMissingRelation(error)) console.error("Error loading students waiting for a donor", error);
    return [];
  }

  const waitingIds = ((data ?? []) as Array<{ student_id: string }>).map((row) => row.student_id);
  if (!waitingIds.length) return [];

  const [coverage, balances] = await Promise.all([loadStudentCoverage(waitingIds), loadDonorBalances()]);
  const gaps = waitingIds
    .map((id) => coverage.data.get(id))
    .filter((row) => row && !row.need_unknown && row.monthly_gap_thb > 0)
    .map((row) => row!.monthly_gap_thb);

  if (!gaps.length) return [];
  const smallestGap = Math.min(...gaps);

  const donors = Array.from(balances.data.values())
    .filter((balance) => balance.free_balance_thb >= smallestGap)
    .sort((a, b) => b.free_balance_thb - a.free_balance_thb);

  if (!donors.length) return [];

  if (donors.length > MAX_DONOR_ITEMS) {
    const total = donors.reduce((sum, balance) => sum + balance.free_balance_thb, 0);
    return [
      {
        id: "can-help",
        kind: "allocate",
        title: t("sponsorship.today.canHelpMany", { count: donors.length }),
        detail: t("sponsorship.today.canHelpManyDetail", { amount: formatCurrency(total), students: gaps.length }),
        waitingDays: null,
        href: "/admin/students?focus=no-donor",
      },
    ];
  }

  return donors.map((balance) => {
    const count = gaps.filter((gap) => gap <= balance.free_balance_thb).length;
    return {
      id: `can-help-${balance.donor_id}`,
      kind: "allocate" as const,
      title: t("sponsorship.today.canHelp", { donor: balance.donor_name ?? t("donorCard.aDonor"), count }),
      detail: t("sponsorship.today.canHelpDetail", { amount: formatCurrency(balance.free_balance_thb) }),
      waitingDays: null,
      href: `/admin/donors/${balance.donor_id}?tab=students&assign=1`,
    };
  });
};

export const loadSponsorshipTodayItems = async (): Promise<TodayItem[]> => {
  const [relationships, canHelp] = await Promise.all([relationshipItems(), canHelpItems()]);
  return [...canHelp, ...relationships];
};
