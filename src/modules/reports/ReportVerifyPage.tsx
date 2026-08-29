// src/modules/reports/ReportVerifyPage.tsx
//
// The moment a report becomes something a donor reads.
//
// Approving used to be a select going from "Submitted" to "Approved". Nothing
// in that act asked anybody to read what was being sent, to decide which
// photographs of a child were leaving the organisation, or to notice that the
// teacher's paragraph mentions a guardian problem the donor has no business
// hearing about. The status changed and a report went out.
//
// So the commit is a screen. Left, everything the teacher wrote, including the
// internal note, read-only. Right, exactly what the donor will read, editable.
// The footer names the people who will receive it before it offers the button
// that sends it — because "Approve" with no recipient named is a decision made
// without its most important fact.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Stack, Switch, Text, Textarea, TextInput } from "@mantine/core";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  LoadingState,
  PageHeader,
  formatDate,
  formatDateRange,
} from "../../design-system";
import { Badge, Banner, Button, Dialog, EmptyState, Icon } from "../../design-system/lumen";
import {
  attachmentName,
  attachmentUrl,
  isImagePath,
  parseAttachments,
  type ReportAttachment,
} from "./reportAttachments";
import { REPORT_COLUMNS, type ReportRecord } from "./reportRecord";
import { ReportCommentThread } from "./ReportCommentThread";
import { EmailPreviewDialog } from "./EmailPreviewDialog";
import { hasOpenFlag, resolveFlag } from "./donorReports";
import styles from "./ReportVerifyPage.module.scss";

type Pane = "source" | "donor";

interface Recipient {
  donorId: string;
  name: string;
  /** What this person asked for on the donor form. */
  language: "en" | "th";
}

export const ReportVerifyPage: React.FC = () => {
  const { reportId = "" } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [studentName, setStudentName] = useState<string>("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // The editable donor-facing version, in both languages.
  //
  // Two columns rather than one translated on the fly: a donor who asked for
  // Thai gets Thai that a person wrote and a person approved, or gets nothing.
  // Machine translation was considered and rejected — an unreviewed sentence
  // about a child, sent to the person paying for her, is the failure this
  // product cannot have.
  const [commentEn, setCommentEn] = useState("");
  const [commentTh, setCommentTh] = useState("");
  const [gradeEn, setGradeEn] = useState("");
  const [gradeTh, setGradeTh] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<"en" | "th">("en");
  const [writing, setWriting] = useState<"en" | "th">("en");
  const [attachments, setAttachments] = useState<ReportAttachment[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [pane, setPane] = useState<Pane>("donor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [resolving, setResolving] = useState(false);

  // Approving moves focus somewhere deliberate rather than leaving it on a
  // button that no longer exists.
  const liveRef = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState("");

  const load = useCallback(async () => {
    if (!reportId) return;

    const [reportRead, session] = await Promise.all([
      supabase.from("term_updates").select(REPORT_COLUMNS).eq("id", reportId).maybeSingle(),
      supabase.auth.getUser(),
    ]);

    setCurrentUserId(session.data?.user?.id ?? null);

    if (reportRead.error || !reportRead.data) {
      console.error("Error loading report", reportRead.error);
      setReport(null);
      setLoading(false);
      return;
    }

    const record = reportRead.data as ReportRecord;
    setReport(record);

    const anyRecord = record as any;
    // Before the bilingual migration a report has only donor_comment, and it
    // was written in English by the forms that existed then.
    const source = (anyRecord.source_language as "en" | "th") ?? "en";
    setSourceLanguage(source);
    setCommentEn(anyRecord.donor_comment_en ?? (source === "en" ? record.donor_comment ?? "" : ""));
    setCommentTh(anyRecord.donor_comment_th ?? (source === "th" ? record.donor_comment ?? "" : ""));
    setGradeEn(anyRecord.grade_text_en ?? (source === "en" ? record.grade_text ?? record.grade ?? "" : ""));
    setGradeTh(anyRecord.grade_text_th ?? (source === "th" ? record.grade_text ?? "" : ""));
    // Open on the language somebody still has to write, not on the one the
    // teacher already filled in.
    setWriting(source === "en" ? "th" : "en");
    setAttachments(parseAttachments(record.attachments));

    if (record.student_id) {
      const [studentRead, donorRead] = await Promise.all([
        supabase.from("students").select("name").eq("id", record.student_id).maybeSingle(),
        supabase
          .from("student_donors")
          .select("donor_id, donor_name, donor_language")
          .eq("student_id", record.student_id),
      ]);

      setStudentName((studentRead.data as any)?.name ?? "");

      if (donorRead.error) {
        // The view may not exist yet. An empty recipient list is honest; a
        // guessed one is not, and this footer is what somebody approves on.
        setRecipients([]);
      } else {
        setRecipients(
          (donorRead.data ?? []).map((row: any) => ({
            donorId: row.donor_id,
            name: row.donor_name ?? "A donor",
            language: (row.donor_language as "en" | "th") ?? "en",
          })),
        );
      }
    }

    setLoading(false);
  }, [reportId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const togglePublic = (path: string) => {
    setAttachments((prev) =>
      prev.map((file) => (file.path === path ? { ...file, is_public: !file.is_public } : file)),
    );
  };

  const approve = async () => {
    if (busy || !report) return;
    setBusy(true);
    setError(null);

    // The source language stays in donor_comment, so every screen written
    // before this migration keeps reading what it always read.
    const sourceComment = sourceLanguage === "th" ? commentTh : commentEn;
    const sourceGrade = sourceLanguage === "th" ? gradeTh : gradeEn;

    const { error: writeError } = await supabase
      .from("term_updates")
      .update({
        donor_comment: sourceComment.trim() || null,
        // `info` is the legacy duplicate that older donor screens read. It is
        // written from the same field so no screen has to know that.
        info: sourceComment.trim() || null,
        grade_text: sourceGrade.trim() || null,
        donor_comment_en: commentEn.trim() || null,
        donor_comment_th: commentTh.trim() || null,
        grade_text_en: gradeEn.trim() || null,
        grade_text_th: gradeTh.trim() || null,
        source_language: sourceLanguage,
        attachments,
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", report.id);

    setBusy(false);

    if (writeError) {
      setError(writeError.message ?? "Could not approve this report.");
      return;
    }

    if (recipients.length === 0) {
      // Approving files the report. With nobody funding this student there is
      // no email to preview, and pretending otherwise would be theatre.
      setAnnouncement(
        "Report approved. No donor is funding this student yet, so nobody has received it.",
      );
      setTimeout(() => navigate("/admin/reports"), 900);
      return;
    }

    // Approved is not sent. The email is the entire delivery, so a person sees
    // it before it goes.
    setPreviewOpen(true);
  };

  const requestChanges = async () => {
    if (busy || !report) return;
    setBusy(true);

    const { error: writeError } = await supabase
      .from("term_updates")
      .update({
        status: "changes_requested",
        internal_note: changeNote.trim()
          ? `${report.internal_note ? `${report.internal_note}\n\n` : ""}Changes requested: ${changeNote.trim()}`
          : report.internal_note,
      })
      .eq("id", report.id);

    setBusy(false);

    if (writeError) {
      setError(writeError.message ?? "Could not send this back.");
      return;
    }

    setRequesting(false);
    navigate("/admin/reports");
  };

  if (loading) return <LoadingState />;

  if (!report) {
    return (
      <EmptyState
        icon="clipboard-list"
        title="Report not found"
        description="It may have been removed."
        action={
          <Button variant="secondary" onClick={() => navigate("/admin/reports")}>
            Back to reports
          </Button>
        }
      />
    );
  }

  const alreadySent = report.status === "approved";
  const sentAt = (report as any).sent_at as string | null;
  const sendError = (report as any).send_error as string | null;

  /**
   * Donors whose language has no text on this report.
   *
   * Sending is blocked while this is non-empty, and the block names the person
   * rather than the field. "The Thai version is empty" is a fact about a form;
   * "Khun Somchai reads Thai" is a fact about somebody who will otherwise
   * receive nothing.
   */
  const needsTranslation = recipients.filter((recipient) =>
    recipient.language === "th" ? !commentTh.trim() : !commentEn.trim(),
  );
  const flagOpen = hasOpenFlag(report);

  // Clearing the flag is what closes the loop the donor opened. Until this
  // existed a flagged report stayed flagged for good: it sorted to the top of
  // the admin table for ever and the donor never saw an answer land.
  const clearFlag = async () => {
    setResolving(true);
    setError(null);
    const result = await resolveFlag(report.id, "");
    setResolving(false);

    if (!result.ok) {
      setError(result.message ?? "The flag could not be cleared.");
      return;
    }

    setAnnouncement("Flag cleared.");
    void load();
  };

  const recipientLine = (() => {
    if (recipients.length === 0) {
      return (
        <span className={`${styles.recipients} ${styles.recipientsNone}`}>
          No donor funds this student yet — approving files the report, it does not send it.
        </span>
      );
    }
    if (recipients.length === 1) {
      return <span className={styles.recipients}>Goes to {recipients[0].name}.</span>;
    }
    return (
      <span className={styles.recipients}>
        Goes to {recipients[0].name} and {recipients.length - 1} other
        {recipients.length - 1 === 1 ? "" : "s"}.
      </span>
    );
  })();

  return (
    <Stack>
      <PageHeader
        title={`Verify report${studentName ? ` · ${studentName}` : ""}`}
        subtitle={
          report.covers_start || report.covers_end
            ? `Covering ${formatDateRange(report.covers_start, report.covers_end)}`
            : `Written ${formatDate(report.report_date)}`
        }
        onBack={() => navigate("/admin/reports")}
        backLabel="Reports"
      />

      <div aria-live="polite" ref={liveRef} style={{ position: "absolute", left: -9999 }}>
        {announcement}
      </div>

      {alreadySent && (
        <Banner tone="info" title="This report has already gone to the donor">
          Changes you save here change what they see next time they open it.
        </Banner>
      )}

      {flagOpen && (
        <Banner
          tone="warning"
          title="The donor asked a question about this report"
          action={
            <Button variant="secondary" onClick={clearFlag} disabled={resolving}>
              {resolving ? "Clearing…" : "Mark as answered"}
            </Button>
          }
        >
          {report.flag_reason || "No reason was given."} Reply in the thread below, then mark it
          answered.
        </Banner>
      )}

      {error && (
        <Banner tone="danger" title="Could not save">
          {error}
        </Banner>
      )}

      <div className={styles.narrowNotice}>
        Verification compares two versions side by side. On a wider screen you can see both at once.
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Report versions">
        <button
          type="button"
          role="tab"
          aria-selected={pane === "source"}
          className={`${styles.tab} ${pane === "source" ? styles.tabActive : ""}`}
          onClick={() => setPane("source")}
        >
          Teacher's report
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pane === "donor"}
          className={`${styles.tab} ${pane === "donor" ? styles.tabActive : ""}`}
          onClick={() => setPane("donor")}
        >
          What the donor sees
        </button>
      </div>

      <div className={styles.panes}>
        <section
          className={`${styles.pane} ${styles.source} ${pane === "source" ? "" : styles.hiddenPane}`}
          aria-label="The teacher's report"
        >
          <h2 className={styles.paneTitle}>
            Teacher's report
            <Badge tone="neutral">Read only</Badge>
          </h2>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Grade</span>
            <span className={styles.fieldValue}>
              {report.grade_text || report.grade || "—"}
              {report.grade_numeric !== null ? ` (${report.grade_numeric})` : ""}
            </span>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Written for the donor</span>
            <span className={styles.fieldValue}>{report.donor_comment || "—"}</span>
          </div>

          {report.internal_note && (
            <div className={styles.internal}>
              <div className={styles.internalLabel}>
                <Icon name="shield-off" size={14} />
                Internal note — never sent to a donor
              </div>
              <div className={styles.fieldValue}>{report.internal_note}</div>
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Attachments · {parseAttachments(report.attachments).length}
            </span>
          </div>
        </section>

        <section
          className={`${styles.pane} ${pane === "donor" ? "" : styles.hiddenPane}`}
          aria-label="What the donor will see"
        >
          <h2 className={styles.paneTitle}>
            What the donor sees
            <Badge tone="info">Editable</Badge>
          </h2>

          {/* Which language is being written. A tablist rather than two
              stacked pairs of fields: side by side they compete, and the
              question here is only ever "which one am I writing now". */}
          <div className={styles.langTabs} role="tablist" aria-label="Language of the donor's copy">
            {(["en", "th"] as const).map((code) => {
              const written = code === "en" ? commentEn.trim() : commentTh.trim();
              return (
                <button
                  key={code}
                  type="button"
                  role="tab"
                  aria-selected={writing === code}
                  className={`${styles.langTab} ${writing === code ? styles.langTabActive : ""}`}
                  onClick={() => setWriting(code)}
                  lang={code}
                >
                  {code === "en" ? "English" : "ไทย"}
                  {code === sourceLanguage ? (
                    <span className={styles.langNote}>original</span>
                  ) : !written ? (
                    // Said in words, not only in amber: the whole point is that
                    // somebody notices this before pressing send.
                    <span className={styles.langMissing}>not written yet</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {needsTranslation.length > 0 && (
            <div className={styles.translationNeeded}>
              {needsTranslation
                .map(
                  (r) =>
                    `${r.name} reads ${r.language === "th" ? "Thai" : "English"}, and that version is empty.`,
                )
                .join(" ")}
            </div>
          )}

          <TextInput
            label={writing === "en" ? "Grade, as the donor reads it" : "ผลการเรียนที่ผู้บริจาคจะเห็น"}
            placeholder={writing === "en" ? "Top of her class" : "ได้ที่หนึ่งของห้อง"}
            lang={writing}
            value={writing === "en" ? gradeEn : gradeTh}
            onChange={(event) =>
              writing === "en"
                ? setGradeEn(event.currentTarget.value)
                : setGradeTh(event.currentTarget.value)
            }
          />

          <Textarea
            label={writing === "en" ? "The update" : "เนื้อหารายงาน"}
            placeholder={
              writing === "en"
                ? "Mali finished top of her class this term and has started helping the younger children with their reading."
                : "ภาคเรียนนี้มะลิสอบได้ที่หนึ่งของห้อง และเริ่มช่วยสอนการอ่านให้น้อง ๆ"
            }
            autosize
            minRows={6}
            lang={writing}
            value={writing === "en" ? commentEn : commentTh}
            onChange={(event) =>
              writing === "en"
                ? setCommentEn(event.currentTarget.value)
                : setCommentTh(event.currentTarget.value)
            }
          />

          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Photographs and files — each one off by default
            </span>
            <div className={styles.attachments}>
              {attachments.length === 0 && (
                <Text size="sm" c="dimmed">
                  Nothing attached to this report.
                </Text>
              )}
              {attachments.map((file) => (
                <div key={file.path} className={styles.attachment}>
                  <span className={styles.attachmentLeft}>
                    {isImagePath(file.path) ? (
                      <img className={styles.thumb} src={attachmentUrl(file.path)} alt="" />
                    ) : (
                      <Icon name="clipboard-list" size={18} />
                    )}
                    <span className={styles.attachmentName}>{attachmentName(file.path)}</span>
                  </span>
                  <Switch
                    size="sm"
                    checked={Boolean(file.is_public)}
                    onChange={() => togglePublic(file.path)}
                    label={file.is_public ? "Donor sees this" : "Hidden"}
                    aria-label={`Show ${attachmentName(file.path)} to the donor`}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className={styles.footer}>
        {recipientLine}
        <div className={styles.footerActions}>
          <Button variant="ghost" onClick={() => setRequesting(true)} disabled={busy}>
            Request changes
          </Button>
          <Button
            variant="primary"
            icon="send"
            onClick={approve}
            disabled={busy || needsTranslation.length > 0}
          >
            {busy
              ? "Saving…"
              : needsTranslation.length > 0
                ? "A version is missing"
                : alreadySent
                  ? "Save and resend"
                  : "Approve & send to donor"}
          </Button>
        </div>
      </div>

      {/* Staff talk about the report here. The donor's own thread on the same
          report is the same component, with the internal audience hidden. */}
      <ReportCommentThread
        reportId={report.id}
        currentUserId={currentUserId}
        staff
        placeholder="Note something for the team, or reply to the donor."
      />

      <EmailPreviewDialog
        reportId={report.id}
        opened={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onSent={(sent) => {
          setAnnouncement(
            `Report sent to ${sent.map((r) => r.name ?? "a donor").join(" and ")}.`,
          );
          setTimeout(() => navigate("/admin/reports"), 900);
        }}
      />

      {requesting && (
        <Dialog
          open
          onClose={() => (busy ? undefined : setRequesting(false))}
          title="Send this back to the teacher?"
          description="Say what needs changing. It is added to the internal note, and the report leaves your queue until they resubmit."
          footer={
            <>
              <Button variant="ghost" onClick={() => setRequesting(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" onClick={requestChanges} disabled={busy || !changeNote.trim()}>
                {busy ? "Sending…" : "Request changes"}
              </Button>
            </>
          }
        >
          <Textarea
            autosize
            minRows={3}
            label="What needs changing"
            placeholder="The grade is missing, and the photo is of a different student."
            value={changeNote}
            onChange={(event) => setChangeNote(event.currentTarget.value)}
          />
        </Dialog>
      )}
    </Stack>
  );
};

export default ReportVerifyPage;
