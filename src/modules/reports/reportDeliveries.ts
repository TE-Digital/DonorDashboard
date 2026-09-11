// src/modules/reports/reportDeliveries.ts
//
// Who is still waiting for a report (task 1.15).
//
// report-email writes one row per report and recipient into report_deliveries:
// waiting, sent or failed. The Reports beta list, its send dialog and the
// sidebar count all read the open ones (waiting or failed) through here.
//
// Before the migration runs the table doesn't exist. Every read then answers
// "nobody is waiting" rather than failing the screen it sits on.

import { supabase } from "../../lib/supabaseClient";

export type DeliveryStatus = "waiting" | "sent" | "failed";

export interface ReportDelivery {
  id: string;
  report_id: string;
  donor_id: string | null;
  name: string | null;
  email: string | null;
  language: "en" | "th";
  status: DeliveryStatus;
  reason: string | null;
  error: string | null;
}

const OPEN_COLUMNS = "id, report_id, donor_id, name, email, language, status, reason, error";

/** The table isn't there yet: PostgREST says 42P01 or PGRST205. */
const isMissingTable = (error: { code?: string } | null): boolean =>
  error?.code === "42P01" || error?.code === "PGRST205";

/** Fired after any send, so the sidebar count catches up without a reload. */
export const DELIVERIES_CHANGED = "report-deliveries-changed";

export const notifyDeliveriesChanged = (): void => {
  window.dispatchEvent(new Event(DELIVERIES_CHANGED));
};

/**
 * Open deliveries (waiting or failed), optionally for some reports only.
 * `available` is false when the table doesn't exist yet.
 */
export async function loadOpenDeliveries(
  reportIds?: string[],
): Promise<{ rows: ReportDelivery[]; available: boolean }> {
  if (reportIds && reportIds.length === 0) return { rows: [], available: true };

  // A row with a reason other than "no_email" records why a donor was left out
  // on purpose (support ended, reports turned off, waiting on a decision). That
  // is a fact about the donor, not a report still owed to them, so it never
  // counts as waiting to send.
  let query = supabase
    .from("report_deliveries")
    .select(OPEN_COLUMNS)
    .in("status", ["waiting", "failed"])
    .or("reason.is.null,reason.eq.no_email")
    .is("deleted_at", null)
    .limit(1000);
  if (reportIds) query = query.in("report_id", reportIds);

  const { data, error } = await query;
  if (error) {
    if (!isMissingTable(error)) console.error("Error loading report deliveries", error);
    return { rows: [], available: !isMissingTable(error) };
  }
  return { rows: (data ?? []) as ReportDelivery[], available: true };
}

/** How many approved reports still have someone waiting: the sidebar count. */
export async function countReportsWaitingToSend(): Promise<number> {
  const { rows } = await loadOpenDeliveries();
  if (rows.length === 0) return 0;
  const reportIds = Array.from(new Set(rows.map((row) => row.report_id)));
  // Only approved reports can be sent; a report sent back to the teacher after
  // its preview was built isn't waiting on anybody here.
  const { data, error } = await supabase
    .from("term_updates")
    .select("id")
    .in("id", reportIds)
    .eq("status", "approved");
  if (error) return 0;
  return (data ?? []).length;
}
