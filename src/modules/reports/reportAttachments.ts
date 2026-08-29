// src/modules/reports/reportAttachments.ts
//
// The photos and documents attached to a term report.
//
// An attachment carries one flag that matters: `is_public` decides whether a
// donor sees it. That flag is a privacy decision about a child, so it is set
// per file, defaults to false, and is never inferred from the file type.
//
// Uploads happen before the row is written and are not rolled back if the write
// then fails — a file in the bucket with no row is a small mess; a saved report
// pointing at files that were never uploaded is a broken record.

import { supabase } from "../../lib/supabaseClient";

export const REPORT_BUCKET = "progress-photos";

export interface ReportAttachment {
  path: string;
  /** True only when somebody deliberately shared this file with donors. */
  is_public: boolean;
}

/** A file chosen in the form, not yet uploaded. */
export interface AttachmentDraft {
  file: File;
  isPublic: boolean;
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const isImagePath = (path: string): boolean =>
  /\.(jpe?g|png|webp|gif|avif)$/i.test(path.split("?")[0] ?? "");

export const attachmentName = (path: string): string => path.split("/").pop() ?? path;

export const attachmentUrl = (path: string): string => {
  const { data } = supabase.storage.from(REPORT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

/**
 * Reads the `attachments` column, whatever shape it is in.
 *
 * Rows have been written as a JSON array, as a JSON string, and — before the
 * public flag existed — as an array of bare paths. All three still exist in the
 * table, so all three are read.
 */
export const parseAttachments = (raw: unknown): ReportAttachment[] => {
  if (!raw) return [];

  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value)) return [];

  return value
    .map((entry): ReportAttachment | null => {
      if (typeof entry === "string") return { path: entry, is_public: false };
      if (entry && typeof entry === "object" && typeof (entry as any).path === "string") {
        return { path: (entry as any).path, is_public: Boolean((entry as any).is_public) };
      }
      return null;
    })
    .filter((entry): entry is ReportAttachment => entry !== null);
};

export const attachmentProblem = (file: File): string | null => {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `${file.name} is larger than 10 MB. Choose a smaller file.`;
  }
  return null;
};

export interface UploadResult {
  attachments: ReportAttachment[];
  error: string | null;
}

/**
 * Uploads the chosen files under the student's folder.
 *
 * The name is randomised rather than kept: two teachers both uploading
 * "IMG_0001.jpg" for the same student must not overwrite each other, and a
 * filename typed by a person is not something to put in a URL.
 */
export const uploadAttachments = async (
  studentId: string,
  drafts: AttachmentDraft[],
): Promise<UploadResult> => {
  if (!drafts.length) return { attachments: [], error: null };

  const uploaded: ReportAttachment[] = [];

  for (const draft of drafts) {
    const problem = attachmentProblem(draft.file);
    if (problem) return { attachments: uploaded, error: problem };

    const extension = draft.file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${studentId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const { data, error } = await supabase.storage
      .from(REPORT_BUCKET)
      .upload(path, draft.file);

    if (error) {
      console.error("Error uploading attachment", error);
      return {
        attachments: uploaded,
        error: `${draft.file.name} could not be uploaded. The report was not saved.`,
      };
    }

    uploaded.push({ path: data?.path ?? path, is_public: draft.isPublic });
  }

  return { attachments: uploaded, error: null };
};

/**
 * Deletes files that are no longer on a report. Best effort by design: the
 * report is already saved without them, and a leftover file in the bucket is
 * not worth telling the teacher about.
 */
export const removeAttachments = async (paths: string[]): Promise<void> => {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(REPORT_BUCKET).remove(paths);
  if (error) console.error("Error removing attachments", error);
};
