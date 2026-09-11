// src/modules/reports/DonorReportCard.tsx
//
// One term report, rendered for the person funding the child.
//
// This is the donor half of "one record, two renders". The teacher writes one
// report; the admin decides during verification what of it the donor reads;
// this component renders that decision and nothing else. `internal_note` is not
// a prop here, and cannot be passed in: the only way it could reach a donor is
// if somebody added it to this file on purpose.
//
// The order is the order a person reads in. Which term, how she did, what her
// teacher said, the photographs — and only then the two things the donor can
// do about it.

import React, { useState } from "react";
import { Text, Textarea } from "@mantine/core";
import { formatDate, formatDateRange } from "../../design-system";
import { Badge, Button, Dialog } from "../../design-system/lumen";
import { attachmentName, attachmentUrl, isImagePath } from "./reportAttachments";
import { flagReport, hasOpenFlag, type DonorReport } from "./donorReports";
import { ReportCommentThread } from "./ReportCommentThread";
import styles from "./DonorReportCard.module.scss";

export interface DonorReportCardProps {
  report: DonorReport;
  studentName?: string;
  currentUserId: string | null;
  /** Reload after a flag is raised, so the banner appears. */
  onChanged?: () => void;
  /** Comments and flagging are hidden in a read-only preview. */
  readOnly?: boolean;
}

export const DonorReportCard: React.FC<DonorReportCardProps> = ({
  report,
  studentName,
  currentUserId,
  onChanged,
  readOnly,
}) => {
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = hasOpenFlag(report);

  const grade = report.grade_text || report.grade || null;

  const submitFlag = async () => {
    if (busy) return;
    setBusy(true);
    const result = await flagReport(report.id, reason);
    setBusy(false);

    if (!result.ok) {
      setError(result.message ?? "We couldn't send your question. Try again.");
      return;
    }

    setFlagging(false);
    setReason("");
    onChanged?.();
  };

  return (
    <article className={styles.card} aria-label={`Report from ${formatDate(report.report_date)}`}>
      <header className={styles.head}>
        <div>
          <div className={styles.term}>
            {studentName ? `${studentName} · ` : ""}
            {report.covers_start || report.covers_end
              ? formatDateRange(report.covers_start, report.covers_end)
              : "Term report"}
          </div>
          <div className={styles.date}>Sent {formatDate(report.approved_at ?? report.report_date)}</div>
        </div>
        {open && <Badge tone="warning">Question raised</Badge>}
      </header>

      {open && (
        <div className={styles.flagBanner}>
          <strong>You asked about this report.</strong>
          <span>{report.flag_reason || "We'll reply here."}</span>
        </div>
      )}

      {grade && (
        <div className={styles.grade}>
          <span>Grade</span>
          <span className={styles.gradeValue}>{grade}</span>
          {report.grade_numeric !== null && <span>({report.grade_numeric})</span>}
        </div>
      )}

      {report.donor_comment ? (
        <p className={styles.comment}>{report.donor_comment}</p>
      ) : (
        <Text size="sm" c="dimmed">
          No written update for this term.
        </Text>
      )}

      {report.attachments.length > 0 && (
        <div className={styles.photos}>
          {report.attachments.map((file) =>
            isImagePath(file.path) ? (
              <img
                key={file.path}
                className={styles.photo}
                src={attachmentUrl(file.path)}
                // A photograph of a specific child, described as one. "Image"
                // is not an alternative to seeing her.
                alt={`${studentName ?? "The student"}, photo from this term's report`}
                loading="lazy"
              />
            ) : (
              <a
                key={file.path}
                className={styles.fileLink}
                href={attachmentUrl(file.path)}
                target="_blank"
                rel="noreferrer"
              >
                {attachmentName(file.path)}
              </a>
            ),
          )}
        </div>
      )}

      {!readOnly && (
        <>
          <ReportCommentThread
            reportId={report.id}
            currentUserId={currentUserId}
            placeholder="Ask a question about this report."
          />

          {!open && (
            <div>
              {/* Quieter than the comment box on purpose. Most responses are a
                  comment; a flag is for when an answer is actually needed. */}
              <Button variant="ghost" icon="triangle-alert" onClick={() => setFlagging(true)}>
                Flag this report
              </Button>
            </div>
          )}
        </>
      )}

      {flagging && (
        <Dialog
          open
          onClose={() => (busy ? undefined : setFlagging(false))}
          title="Ask us about this report"
          description="This puts the report at the top of the team's list until somebody answers you. Your question appears in the comments below, and so will their reply."
          footer={
            <>
              <Button variant="ghost" onClick={() => setFlagging(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" onClick={submitFlag} disabled={busy || !reason.trim()}>
                {busy ? "Sending…" : "Send question"}
              </Button>
            </>
          }
        >
          <Textarea
            autosize
            minRows={3}
            label="What would you like to know?"
            placeholder="Who is Mali living with at the moment?"
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
          />
          {error && (
            <Text size="sm" c="red" mt="sm">
              {error}
            </Text>
          )}
        </Dialog>
      )}
    </article>
  );
};

export default DonorReportCard;
