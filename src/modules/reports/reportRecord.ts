// src/modules/reports/reportRecord.ts
//
// One definition of what a term report is.
//
// A report was written five times over — an admin create page, an admin edit
// page, a combined admin form, and a teacher create and edit page — each with
// its own idea of which fields exist, which are required, and what happens to
// an attachment on save. Five copies of a form is five different products for
// the same job, and the person filling it in is the same teacher either way.
//
// This file owns the record. ReportForm owns the fields. The pages own only
// where the form sits and where you go after saving.
//
// Two columns hold the same sentence for historical reasons: `donor_comment` is
// what the donor reads, and `info` is what older donor screens read. Both are
// written from the one field, here, so no screen has to know that.

import { supabase } from "../../lib/supabaseClient";
import { parseAttachments, type ReportAttachment } from "./reportAttachments";
import type { ReportStatus } from "./reportStatus";
import type { FieldErrors } from "../../design-system/fieldValidation";

export type { ReportAttachment };

/** The columns every screen reads for a report. */
export const REPORT_COLUMNS =
  "id, student_id, report_date, covers_start, covers_end, grade, grade_text, grade_numeric, donor_comment, internal_note, info, attachments, status, due_date, created_at, flagged_at, flag_reason, flag_resolved_at";

export interface ReportRecord {
  id: string;
  student_id: string | null;
  report_date: string | null;
  covers_start: string | null;
  covers_end: string | null;
  grade: string | null;
  grade_text: string | null;
  grade_numeric: number | null;
  donor_comment: string | null;
  internal_note: string | null;
  info: string | null;
  attachments: unknown;
  /** Where this report is in its cycle. See reportStatus.ts. */
  status: ReportStatus | null;
  due_date: string | null;
  created_at: string | null;
  /** A donor asked a question on this report. See donorReports.ts. */
  flagged_at: string | null;
  flag_reason: string | null;
  flag_resolved_at: string | null;
}

/** The form's shape — every value a string, as the inputs hold them. */
export interface ReportDetailsInput {
  studentId: string | null;
  /** ISO date. The day the report is written, not the term it covers. */
  reportDate: string;
  coversStart: string;
  coversEnd: string;
  grade: string;
  gradeText: string;
  gradeNumeric: string;
  donorComment: string;
  internalNote: string;
  /** Where the report is in its cycle — the thing the directory reads. */
  status: ReportStatus;
  /** When this cycle was due. Drives "Due in 12 days" and "Overdue". */
  dueDate: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export const emptyReportDetails = (studentId: string | null = null): ReportDetailsInput => ({
  studentId,
  reportDate: today(),
  coversStart: "",
  coversEnd: "",
  grade: "",
  gradeText: "",
  gradeNumeric: "",
  donorComment: "",
  internalNote: "",
  // A new report starts as a draft. Submitting is a decision, not a side effect
  // of opening the form.
  status: "draft",
  dueDate: "",
});

export const toReportDetails = (record: ReportRecord): ReportDetailsInput => ({
  studentId: record.student_id ?? null,
  reportDate: record.report_date ?? today(),
  coversStart: record.covers_start ?? "",
  coversEnd: record.covers_end ?? "",
  grade: record.grade ?? "",
  gradeText: record.grade_text ?? "",
  gradeNumeric: record.grade_numeric != null ? String(record.grade_numeric) : "",
  // Older rows put the donor sentence in `info` and left donor_comment empty.
  donorComment: record.donor_comment ?? record.info ?? "",
  internalNote: record.internal_note ?? "",
  status: record.status ?? "submitted",
  dueDate: record.due_date ?? "",
});

export const toReportRow = (
  values: ReportDetailsInput,
  attachments: ReportAttachment[],
) => {
  const donorComment = values.donorComment.trim() || null;
  const numeric = values.gradeNumeric.trim();

  return {
    student_id: values.studentId,
    report_date: values.reportDate || null,
    covers_start: values.coversStart || null,
    covers_end: values.coversEnd || null,
    grade: values.grade.trim() || null,
    grade_text: values.gradeText.trim() || null,
    grade_numeric: numeric ? Number(numeric) : null,
    donor_comment: donorComment,
    internal_note: values.internalNote.trim() || null,
    // Kept in step with donor_comment: donor screens still read this column.
    info: donorComment,
    status: values.status,
    due_date: values.dueDate || null,
    attachments: attachments.length ? attachments : null,
  };
};

/* ------------------------------------------------------------- Validation */

/**
 * The first problem with these values, or null.
 *
 * A report needs a student and a date. Everything else is what the teacher
 * actually has to hand — refusing to save a report because the numeric grade
 * is missing is how a term's observations get lost.
 */
/** The fields a report can be wrong about, in the order the form asks. */
export type ReportField =
  | "studentId"
  | "reportDate"
  | "coversStart"
  | "coversEnd"
  | "dueDate"
  | "gradeNumeric"
  | "donorComment";

export const REPORT_FIELD_ORDER: readonly ReportField[] = [
  "studentId",
  "reportDate",
  "coversStart",
  "coversEnd",
  "dueDate",
  "gradeNumeric",
  "donorComment",
];

/**
 * Everything wrong with these values, by field.
 *
 * A report has thirteen inputs. Answering a failed save with one sentence in a
 * banner made the person hunt for which of the thirteen it was about.
 */
export const validateReportDetails = (values: ReportDetailsInput): FieldErrors<ReportField> => {
  const errors: FieldErrors<ReportField> = {};

  if (!values.studentId) errors.studentId = "Choose the student this report is about.";

  if (!values.reportDate) {
    errors.reportDate = "Choose the date of this report.";
  } else if (Number.isNaN(new Date(values.reportDate).getTime())) {
    errors.reportDate = "Enter the report date as a date.";
  }

  if (values.coversStart && values.coversEnd && values.coversStart > values.coversEnd) {
    errors.coversEnd = "The period this report covers ends before it starts.";
  }

  const numeric = values.gradeNumeric.trim();
  if (numeric && !Number.isFinite(Number(numeric))) {
    errors.gradeNumeric = "The numeric grade must be a number, or empty.";
  }

  // A draft is allowed to be unfinished. Anything past draft is on its way to a
  // donor, and the donor's sentence is the point of the whole record.
  if (values.status !== "draft" && !values.donorComment.trim()) {
    errors.donorComment = "Write the comment for the donor before submitting this report.";
  }

  return errors;
};

/* ----------------------------------------------------------------- Reads */

export interface LoadedReport {
  details: ReportDetailsInput;
  attachments: ReportAttachment[];
  error: string | null;
}

export const loadReport = async (reportId: string): Promise<LoadedReport> => {
  const { data, error } = await supabase
    .from("term_updates")
    .select(REPORT_COLUMNS)
    .eq("id", reportId)
    .maybeSingle();

  if (error || !data) {
    console.error("Error loading report", error);
    return {
      details: emptyReportDetails(),
      attachments: [],
      error: "That report could not be opened. It may have been deleted.",
    };
  }

  const record = data as unknown as ReportRecord;
  return {
    details: toReportDetails(record),
    attachments: parseAttachments(record.attachments),
    error: null,
  };
};

export interface ReportSummary {
  id: string;
  student_id: string | null;
  report_date: string | null;
  status: ReportStatus | null;
  due_date: string | null;
  grade_text: string | null;
  grade: string | null;
  donor_comment: string | null;
  internal_note: string | null;
  attachments: ReportAttachment[];
}

const toSummary = (record: ReportRecord): ReportSummary => ({
  id: record.id,
  student_id: record.student_id,
  report_date: record.report_date,
  status: record.status ?? "approved",
  due_date: record.due_date,
  grade_text: record.grade_text,
  grade: record.grade,
  donor_comment: record.donor_comment ?? record.info,
  internal_note: record.internal_note,
  attachments: parseAttachments(record.attachments),
});

/** Every report for one student, newest first. */
export const loadStudentReports = async (studentId: string): Promise<ReportSummary[]> => {
  const { data, error } = await supabase
    .from("term_updates")
    .select(REPORT_COLUMNS)
    .eq("student_id", studentId)
    .order("report_date", { ascending: false });

  if (error) {
    console.error("Error loading student reports", error);
    return [];
  }

  return ((data ?? []) as unknown as ReportRecord[]).map(toSummary);
};

/* ---------------------------------------------------------------- Writes */

export interface SaveReportResult {
  id: string | null;
  error: string | null;
}

/**
 * Creates or updates one report. `reportId` decides which.
 *
 * Attachments are passed in already uploaded, because an upload that has
 * happened cannot be rolled back by a failed insert — the caller uploads
 * first, then hands the paths here.
 */
export const saveReport = async (
  values: ReportDetailsInput,
  attachments: ReportAttachment[],
  reportId?: string | null,
): Promise<SaveReportResult> => {
  const row = toReportRow(values, attachments);

  if (reportId) {
    const { error } = await supabase.from("term_updates").update(row).eq("id", reportId);
    if (error) {
      console.error("Error updating report", error);
      return { id: null, error: writeFailure(error) };
    }
    return { id: reportId, error: null };
  }

  const { data, error } = await supabase
    .from("term_updates")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    console.error("Error creating report", error);
    return { id: null, error: writeFailure(error) };
  }

  return { id: data.id, error: null };
};

export const deleteReport = async (reportId: string): Promise<string | null> => {
  const { error } = await supabase.from("term_updates").delete().eq("id", reportId);
  if (error) {
    console.error("Error deleting report", error);
    return writeFailure(error);
  }
  return null;
};

/**
 * Turns a Postgres refusal into a sentence.
 *
 * A teacher editing somebody else's student hits the row-level policy, and
 * PostgREST answers with the policy name. True, and useless to read.
 */
const writeFailure = (error: { code?: string; message?: string } | null): string => {
  const message = (error?.message ?? "").toLowerCase();
  if (error?.code === "42501" || message.includes("row-level security")) {
    return "Your account is not allowed to change this report. Ask an administrator.";
  }
  return "The report did not save. Check your connection, then try again.";
};
