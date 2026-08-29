// src/modules/reports/donorReports.ts
//
// What a donor is allowed to read, and what they may say back.
//
// The donor student page used to query term_updates with no status filter at
// all, so a donor signed in today could read a teacher's unfinished draft about
// a child. It also read `info` — the legacy duplicate of the donor text — and
// truncated it to 200 characters when `donor_comment` was empty, which meant
// the donor sometimes saw a clipped internal narrative instead of the sentence
// written for them.
//
// Both are fixed here, and neither fix lives in a query a future screen has to
// remember: `donor_reports` is a view that does not select internal_note and
// only exposes approved rows, and the RLS on term_updates enforces the same
// rule for anything that goes around it. This file is the client half.

import { supabase } from "../../lib/supabaseClient";
import { isMissingRelation } from "../donor/donorMoney";
import { parseAttachments, type ReportAttachment } from "./reportAttachments";

/** A report as a donor sees it. `internal_note` is absent by construction. */
export interface DonorReport {
  id: string;
  student_id: string | null;
  report_date: string | null;
  covers_start: string | null;
  covers_end: string | null;
  grade: string | null;
  grade_text: string | null;
  grade_numeric: number | null;
  donor_comment: string | null;
  attachments: ReportAttachment[];
  approved_at: string | null;
  flagged_at: string | null;
  flag_reason: string | null;
  flag_resolved_at: string | null;
  created_at: string | null;
}

export const DONOR_REPORT_COLUMNS =
  "id, student_id, report_date, covers_start, covers_end, grade, grade_text, grade_numeric, donor_comment, attachments, approved_at, flagged_at, flag_reason, flag_resolved_at, created_at";

/** A question from a donor, or an answer from staff, on one report. */
export interface ReportComment {
  id: string;
  report_id: string;
  author_id: string | null;
  body: string;
  audience: "donor" | "internal";
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

const toReport = (row: any): DonorReport => ({
  id: row.id,
  student_id: row.student_id ?? null,
  report_date: row.report_date ?? null,
  covers_start: row.covers_start ?? null,
  covers_end: row.covers_end ?? null,
  grade: row.grade ?? null,
  grade_text: row.grade_text ?? null,
  grade_numeric: row.grade_numeric ?? null,
  donor_comment: row.donor_comment ?? null,
  // Only attachments a person marked public during verification. The filter is
  // repeated here as well as in the view because an attachment is a file on a
  // URL, and a mistake here is a photo of a child leaving the building.
  attachments: parseAttachments(row.attachments).filter((file) => file.is_public),
  approved_at: row.approved_at ?? null,
  flagged_at: row.flagged_at ?? null,
  flag_reason: row.flag_reason ?? null,
  flag_resolved_at: row.flag_resolved_at ?? null,
  created_at: row.created_at ?? null,
});

/**
 * Reports for one student, as a donor may see them.
 *
 * Reads the view, and falls back to a status-filtered read of the table when
 * the migration has not landed yet — never to an unfiltered one. A deploy where
 * the code is ahead of the database should show a donor fewer reports, not
 * more.
 */
export const loadDonorReports = async (studentId: string): Promise<DonorReport[]> => {
  const viewRead = await supabase
    .from("donor_reports")
    .select(DONOR_REPORT_COLUMNS)
    .eq("student_id", studentId)
    .order("report_date", { ascending: false });

  if (!viewRead.error) return (viewRead.data ?? []).map(toReport);

  if (!isMissingRelation(viewRead.error)) {
    console.error("Error loading donor reports", viewRead.error);
    return [];
  }

  const tableRead = await supabase
    .from("term_updates")
    .select("id, student_id, report_date, covers_start, covers_end, grade, grade_text, grade_numeric, donor_comment, attachments, created_at, status")
    .eq("student_id", studentId)
    .eq("status", "approved")
    .order("report_date", { ascending: false });

  if (tableRead.error) {
    // The status column itself is missing, which means the lifecycle migration
    // has not been applied either. Show nothing rather than showing everything.
    console.error("Error loading donor reports", tableRead.error);
    return [];
  }

  return (tableRead.data ?? []).map(toReport);
};

/** Every report a donor may see, across all the students they fund. */
export const loadDonorReportFeed = async (studentIds: string[]): Promise<DonorReport[]> => {
  if (!studentIds.length) return [];

  const { data, error } = await supabase
    .from("donor_reports")
    .select(DONOR_REPORT_COLUMNS)
    .in("student_id", studentIds)
    .order("report_date", { ascending: false });

  if (error) {
    if (!isMissingRelation(error)) console.error("Error loading donor report feed", error);
    return [];
  }

  return (data ?? []).map(toReport);
};

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export const loadReportComments = async (
  reportId: string,
  /** Staff see both audiences; a donor's session is limited by RLS anyway. */
  includeInternal = false,
): Promise<ReportComment[]> => {
  let query = supabase
    .from("report_comments")
    .select("*")
    .eq("report_id", reportId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (!includeInternal) query = query.eq("audience", "donor");

  const { data, error } = await query;

  if (error) {
    if (!isMissingRelation(error)) console.error("Error loading report comments", error);
    return [];
  }

  return (data ?? []) as ReportComment[];
};

export interface CommentResult {
  ok: boolean;
  message?: string;
  comment?: ReportComment;
}

const commentFailure = (error: { code?: string; message?: string }): CommentResult => {
  if (isMissingRelation(error)) {
    return { ok: false, message: "Comments are not set up on this database yet." };
  }
  if (error.code === "42501") {
    return { ok: false, message: "You cannot comment on this report." };
  }
  return { ok: false, message: error.message ?? "Could not post that comment." };
};

export const postComment = async (
  reportId: string,
  body: string,
  audience: "donor" | "internal" = "donor",
): Promise<CommentResult> => {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, message: "Write something first." };

  const { data: session } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("report_comments")
    .insert({ report_id: reportId, body: trimmed, audience, author_id: session?.user?.id ?? null })
    .select("*")
    .maybeSingle();

  if (error) return commentFailure(error);
  return { ok: true, comment: (data ?? undefined) as ReportComment | undefined };
};

/** A person may edit what they wrote. RLS decides whether it is theirs. */
export const editComment = async (id: string, body: string): Promise<CommentResult> => {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, message: "A comment cannot be empty." };

  const { error } = await supabase
    .from("report_comments")
    .update({ body: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id);

  return error ? commentFailure(error) : { ok: true };
};

/**
 * Soft delete. A thread with a hole in it reads as though somebody's question
 * was never asked, and the person who asked it remembers asking.
 */
export const deleteComment = async (id: string): Promise<CommentResult> => {
  const { error } = await supabase
    .from("report_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  return error ? commentFailure(error) : { ok: true };
};

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

/**
 * A donor raises a question on a report they have already been sent.
 *
 * The flag is written to the report, not to a separate queue, so it travels
 * with the thing it is about: the admin reports table sorts it to the top and
 * the donor sees the same amber state on their own copy.
 */
export const flagReport = async (reportId: string, reason: string): Promise<CommentResult> => {
  // Through a function rather than a direct update: a donor has select on
  // term_updates and no update policy, and an RLS-blocked update matches zero
  // rows without raising, so the screen would say "sent" and store nothing.
  const { error } = await supabase.rpc("flag_report", {
    p_report_id: reportId,
    p_reason: reason.trim() || null,
  });

  if (error) return commentFailure(error);

  // The reason is also posted as a comment, so the thread the donor opens
  // already contains what they said and the answer lands beside it rather than
  // somewhere else.
  if (reason.trim()) await postComment(reportId, reason, "donor");

  return { ok: true };
};

export const resolveFlag = async (reportId: string, reply: string): Promise<CommentResult> => {
  if (reply.trim()) {
    const posted = await postComment(reportId, reply, "donor");
    if (!posted.ok) return posted;
  }

  const { error } = await supabase.rpc("resolve_report_flag", {
    p_report_id: reportId,
  });

  return error ? commentFailure(error) : { ok: true };
};

/** Open means raised and not yet answered. */
export const hasOpenFlag = (report: {
  flagged_at?: string | null;
  flag_resolved_at?: string | null;
}): boolean => Boolean(report.flagged_at && !report.flag_resolved_at);
