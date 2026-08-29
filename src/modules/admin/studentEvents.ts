// src/modules/admin/studentEvents.ts
//
// A student's notes and their activity trail.
//
// The two are deliberately separate tables and deliberately linked. Notes are
// where somebody writes a sentence about a student on purpose, and where they
// go to read what colleagues have written. The activity log is everything that
// happened to the record, in order, including every one of those notes.
//
// So: a note is written once and appears twice. Nobody has to remember to also
// log it, because `addNote` writes both — a trail that depends on a caller
// remembering is a trail with holes in exactly the places that matter.
//
// Every write here is best-effort on the log side. If the event row fails, the
// note still saved, and telling somebody their note failed when it did not is
// worse than a gap in the timeline.

import { supabase } from "../../lib/supabaseClient";

/* ------------------------------------------------------------------ Notes */

export interface StudentNote {
  id: string;
  student_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  edited: boolean;
}

const shapeNote = (row: any): StudentNote => ({
  id: row.id,
  student_id: row.student_id,
  author_id: row.author_id ?? null,
  author_name: row.author?.full_name ?? null,
  body: row.body,
  created_at: row.created_at,
  updated_at: row.updated_at,
  edited: Boolean(row.edited),
});

/**
 * Every note on a student, newest first.
 *
 * Returns an empty list when the table is not there yet: a record page with no
 * notes reads as "nobody has written one", which is also true before the
 * migration is applied.
 */
export const loadNotes = async (studentId: string): Promise<StudentNote[]> => {
  const withAuthor = await supabase
    .from("student_notes")
    .select("id, student_id, author_id, body, created_at, updated_at, edited, author:author_id (full_name)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (!withAuthor.error) return (withAuthor.data ?? []).map(shapeNote);

  // No foreign key PostgREST can see: the notes are still worth showing.
  const plain = await supabase
    .from("student_notes")
    .select("id, student_id, author_id, body, created_at, updated_at, edited")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (plain.error) return [];
  return (plain.data ?? []).map(shapeNote);
};

/** The signed-in person, for authoring. Null when the session has gone. */
const currentUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

const firstLine = (body: string, limit = 80) => {
  const line = body.trim().split("\n")[0] ?? "";
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line;
};

export const addNote = async (studentId: string, body: string): Promise<string | null> => {
  const trimmed = body.trim();
  if (!trimmed) return "Write something before saving the note.";

  const actorId = await currentUserId();

  const { error } = await supabase
    .from("student_notes")
    .insert({ student_id: studentId, author_id: actorId, body: trimmed });

  if (error) {
    console.error("Error adding note", error);
    return writeFailure(error, "note");
  }

  await logEvent(studentId, "note_added", `Note added: “${firstLine(trimmed)}”`);
  return null;
};

export const editNote = async (
  noteId: string,
  studentId: string,
  body: string,
): Promise<string | null> => {
  const trimmed = body.trim();
  if (!trimmed) return "A note cannot be emptied. Delete it instead.";

  const { error } = await supabase
    .from("student_notes")
    .update({ body: trimmed, updated_at: new Date().toISOString(), edited: true })
    .eq("id", noteId);

  if (error) {
    console.error("Error editing note", error);
    return writeFailure(error, "note");
  }

  await logEvent(studentId, "note_edited", `Note edited: “${firstLine(trimmed)}”`);
  return null;
};

export const deleteNote = async (noteId: string, studentId: string): Promise<string | null> => {
  const { error } = await supabase.from("student_notes").delete().eq("id", noteId);

  if (error) {
    console.error("Error deleting note", error);
    return writeFailure(error, "note");
  }

  await logEvent(studentId, "note_deleted", "Note deleted");
  return null;
};

/* --------------------------------------------------------------- Activity */

export type StudentEventKind =
  | "student_created"
  | "student_updated"
  | "photo_updated"
  | "note_added"
  | "note_edited"
  | "note_deleted"
  | "report_added"
  | "report_updated"
  | "report_deleted"
  | "scholarship_changed"
  | "teacher_assigned"
  | "donor_card_sent"
  | "donor_card_downloaded"
  | "donor_profile_updated"
  | "consent_updated"
  | "archived"
  | "restored";

export interface StudentEvent {
  id: string;
  kind: StudentEventKind;
  summary: string;
  detail: Record<string, unknown> | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

/** The glyph beside each entry. Colour is not used: a timeline is not a status. */
export const EVENT_ICON: Record<StudentEventKind, string> = {
  student_created: "plus",
  student_updated: "pencil",
  photo_updated: "upload",
  note_added: "clipboard-list",
  note_edited: "pencil",
  note_deleted: "trash-2",
  report_added: "clipboard-list",
  report_updated: "pencil",
  report_deleted: "trash-2",
  scholarship_changed: "hand-coins",
  teacher_assigned: "contact",
  donor_card_sent: "send",
  donor_card_downloaded: "download",
  donor_profile_updated: "pencil",
  consent_updated: "shield-check",
  archived: "inbox",
  restored: "refresh-cw",
};

const shapeEvent = (row: any): StudentEvent => ({
  id: row.id,
  kind: row.kind,
  summary: row.summary,
  detail: (row.detail ?? null) as Record<string, unknown> | null,
  actor_id: row.actor_id ?? null,
  actor_name: row.actor?.full_name ?? null,
  created_at: row.created_at,
});

export const loadEvents = async (studentId: string, limit = 200): Promise<StudentEvent[]> => {
  const withActor = await supabase
    .from("student_events")
    .select("id, kind, summary, detail, actor_id, created_at, actor:actor_id (full_name)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!withActor.error) return (withActor.data ?? []).map(shapeEvent);

  const plain = await supabase
    .from("student_events")
    .select("id, kind, summary, detail, actor_id, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (plain.error) return [];
  return (plain.data ?? []).map(shapeEvent);
};

/**
 * Records that something happened.
 *
 * Never throws and never reports failure to the caller. The action it describes
 * has already succeeded by the time this runs; failing the action because its
 * footnote could not be written would be the wrong trade every time.
 */
export const logEvent = async (
  studentId: string,
  kind: StudentEventKind,
  summary: string,
  detail?: Record<string, unknown>,
): Promise<void> => {
  const actorId = await currentUserId();

  const { error } = await supabase.from("student_events").insert({
    student_id: studentId,
    actor_id: actorId,
    kind,
    summary,
    detail: detail ?? null,
  });

  if (error) console.error("Error recording student event", error);
};

/* ------------------------------------------------------------- Archiving */

/**
 * Takes a student out of the working lists without touching anything about them.
 *
 * Nothing cascades, nothing is nulled, no report or scholarship is removed. The
 * only change is the word on the record, and it goes back the same way.
 */
export const setStudentStatus = async (
  studentId: string,
  status: "enrolled" | "archived",
  studentName: string,
): Promise<string | null> => {
  const actorId = await currentUserId();

  const { error } = await supabase
    .from("students")
    .update(
      status === "archived"
        ? { status, archived_at: new Date().toISOString(), archived_by: actorId }
        : { status, archived_at: null, archived_by: null },
    )
    .eq("id", studentId);

  if (error) {
    console.error("Error changing student status", error);
    return writeFailure(error, "student");
  }

  await logEvent(
    studentId,
    status === "archived" ? "archived" : "restored",
    status === "archived"
      ? `${studentName} was archived. Their records are kept.`
      : `${studentName} was restored to the programme.`,
  );

  return null;
};

const writeFailure = (error: { code?: string; message?: string } | null, noun: string): string => {
  const message = (error?.message ?? "").toLowerCase();
  if (error?.code === "42501" || message.includes("row-level security")) {
    return `Your account is not allowed to change this ${noun}. Ask an administrator.`;
  }
  if (message.includes("does not exist") || message.includes("schema cache")) {
    return "This feature needs a database migration that has not been applied yet.";
  }
  return `The ${noun} did not save. Check your connection, then try again.`;
};
