// src/modules/reports/ReportCommentThread.tsx
//
// The conversation on one report.
//
// A donor reads that Mali finished top of her class and wants to know whether
// she is still living with her grandmother. Before this there was nowhere to
// put that: the question went to whoever the donor had an email address for,
// the answer went back the same way, and neither ever reached the report it was
// about.
//
// Two audiences share one thread and must never share one row. A donor comment
// is visible to the donor and to staff; an internal comment is staff-only, and
// the composer says which one is being written in words, on the control itself,
// rather than relying on a colour somebody might not notice at 6pm.

import React, { useEffect, useState } from "react";
import { Text, Textarea } from "@mantine/core";
import { formatDateTime } from "../../design-system";
import { Badge, Button } from "../../design-system/lumen";
import {
  deleteComment,
  editComment,
  loadReportComments,
  postComment,
  type ReportComment,
} from "./donorReports";
import styles from "./DonorReportCard.module.scss";

export interface ReportCommentThreadProps {
  reportId: string;
  /** The signed-in user, so their own comments are theirs to edit. */
  currentUserId: string | null;
  /** Staff see internal comments and may choose which audience to write to. */
  staff?: boolean;
  /** Wording for the empty state and the button, per side. */
  placeholder?: string;
}

export const ReportCommentThread: React.FC<ReportCommentThreadProps> = ({
  reportId,
  currentUserId,
  staff = false,
  placeholder = "Ask a question about this report.",
}) => {
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [audience, setAudience] = useState<"donor" | "internal">("donor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const reload = async () => {
    const rows = await loadReportComments(reportId, staff);
    setComments(rows);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, staff]);

  const send = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError(null);

    const result = await postComment(reportId, draft, staff ? audience : "donor");
    setBusy(false);

    if (!result.ok) {
      setError(result.message ?? "Could not post that comment.");
      return;
    }

    setDraft("");
    reload();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setBusy(true);
    const result = await editComment(editingId, editDraft);
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "Could not save that change.");
      return;
    }
    setEditingId(null);
    setEditDraft("");
    reload();
  };

  const remove = async (comment: ReportComment) => {
    setBusy(true);
    const result = await deleteComment(comment.id);
    setBusy(false);
    if (result.ok) reload();
    else setError(result.message ?? "Could not remove that comment.");
  };

  return (
    <section className={styles.thread} aria-label="Comments on this report">
      <h3 className={styles.threadTitle}>
        {comments.length === 0 ? "Comments" : `Comments · ${comments.length}`}
      </h3>

      {loading ? (
        <Text size="sm" c="dimmed">
          Loading comments…
        </Text>
      ) : comments.length === 0 ? (
        <Text size="sm" c="dimmed">
          No comments yet.
        </Text>
      ) : (
        <ul className={styles.comments}>
          {comments.map((comment) => {
            const mine = Boolean(currentUserId) && comment.author_id === currentUserId;
            const isEditing = editingId === comment.id;

            return (
              <li
                key={comment.id}
                className={[
                  styles.bubble,
                  mine ? styles.mine : "",
                  comment.audience === "internal" ? styles.internal : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className={styles.bubbleMeta}>
                  <span>{mine ? "You" : comment.audience === "internal" ? "Staff, internal" : "iCare"}</span>
                  <span>·</span>
                  <span>{formatDateTime(comment.created_at)}</span>
                  {comment.audience === "internal" && <Badge tone="warning">Internal</Badge>}
                  {comment.updated_at && comment.updated_at !== comment.created_at && (
                    <span>· edited</span>
                  )}
                </div>

                {isEditing ? (
                  <>
                    <Textarea
                      autosize
                      minRows={2}
                      value={editDraft}
                      onChange={(event) => setEditDraft(event.currentTarget.value)}
                      aria-label="Edit your comment"
                    />
                    <div className={styles.bubbleActions}>
                      <Button variant="primary" size="sm" onClick={saveEdit} disabled={busy}>
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} disabled={busy}>
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className={styles.bubbleBody}>{comment.body}</p>
                    {/* Only your own words are yours to change. The report
                        itself stays owned by the teacher who wrote it. */}
                    {mine && (
                      <div className={styles.bubbleActions}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingId(comment.id);
                            setEditDraft(comment.body);
                          }}
                        >
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(comment)} disabled={busy}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.composer}>
        <Textarea
          autosize
          minRows={2}
          placeholder={placeholder}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          aria-label="Write a comment"
        />

        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}

        <div className={styles.composerActions}>
          {staff && (
            // Which audience, said in words on the control. A staff reply that
            // was meant to be internal and lands in front of a donor is the one
            // mistake this thread must make hard.
            <Button
              variant="ghost"
              size="sm"
              icon={audience === "donor" ? "mail" : "shield-off"}
              onClick={() => setAudience(audience === "donor" ? "internal" : "donor")}
            >
              {audience === "donor" ? "The donor will see this" : "Internal only"}
            </Button>
          )}
          <Button variant="primary" icon="send" onClick={send} disabled={busy || !draft.trim()}>
            {busy ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ReportCommentThread;
