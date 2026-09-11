// src/modules/reports/ReportList.tsx
//
// One student's term reports, newest first, wherever that student is shown.
//
// A report is written from the student's page, so it is added and edited there
// too — a drawer over the record rather than a route away from it. Somebody
// writing a report is looking at the student while they write it.
//
// Read-only for a screen where the viewer cannot change a report — a donor
// reading their sponsored student's history sees the same list without the
// controls, and without anything that was never shared with them.

import React from "react";
import { EmptyState, LoadingState, formatDate } from "../../design-system";
import { Badge, Button, Icon } from "../../design-system/lumen";
import { ReportFormDrawer } from "./ReportFormDrawer";
import { attachmentName, attachmentUrl, isImagePath, type ReportAttachment } from "./reportAttachments";
import { loadStudentReports, type ReportSummary } from "./reportRecord";
import { REPORT_STATE_META } from "./reportStatus";
import styles from "./ReportList.module.scss";

const asDate = (value: string | null) => (value ? formatDate(value) : "No date");

export interface ReportListProps {
  studentId: string;
  /** Named on the drawer, so a report is visibly about this student. */
  studentName?: string | null;
  /** False hides add, edit and delete — a donor's view of the same history. */
  editable?: boolean;
  /** True shows only what was shared with donors: no internal notes, no private files. */
  donorView?: boolean;
}

export const ReportList: React.FC<ReportListProps> = ({
  studentId,
  studentName,
  editable = true,
  donorView = false,
}) => {
  const [reports, setReports] = React.useState<ReportSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [drawer, setDrawer] = React.useState<{ open: boolean; reportId: string | null }>({
    open: false,
    reportId: null,
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setReports(await loadStudentReports(studentId));
    setLoading(false);
  }, [studentId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const visibleFiles = (attachments: ReportAttachment[]) =>
    donorView ? attachments.filter((attachment) => attachment.is_public) : attachments;

  if (loading) return <LoadingState />;

  return (
    <div className={styles.wrap}>
      {editable && (
        <div className={styles.toolbar}>
          <span className={styles.count}>
            {reports.length === 1 ? "Reports: 1" : `Reports: ${reports.length}`}
          </span>
          <Button
            variant="primary"
            icon="plus"
            onClick={() => setDrawer({ open: true, reportId: null })}
          >
            Add report
          </Button>
        </div>
      )}

      {reports.length === 0 ? (
        <EmptyState
          icon="clipboard-list"
          title="No reports yet"
          description={
            editable
              ? "A term report records how this student is doing, and is what the donor reads."
              : "Reports appear here once the school sends one."
          }
          action={
            editable ? (
              <Button variant="primary" icon="plus" onClick={() => setDrawer({ open: true, reportId: null })}>
                Add report
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={styles.list}>
          {reports.map((report) => {
            const files = visibleFiles(report.attachments);
            return (
              <article key={report.id} className={styles.item}>
                <div className={styles.head}>
                  <span className={styles.date}>{asDate(report.report_date)}</span>
                  {/* The same pill, in the same colours, as the students table. */}
                  {report.status && !donorView && (
                    <span title={REPORT_STATE_META[report.status].hint}>
                      <Badge tone={REPORT_STATE_META[report.status].tone} dot>
                        {REPORT_STATE_META[report.status].label}
                      </Badge>
                    </span>
                  )}
                  {report.grade && <Badge tone="info">{report.grade}</Badge>}
                  {report.grade_text && <span className={styles.summary}>{report.grade_text}</span>}
                  {editable && (
                    <span className={styles.headActions}>
                      <Button
                        variant="secondary"
                        icon="pencil"
                        onClick={() => setDrawer({ open: true, reportId: report.id })}
                      >
                        Edit
                      </Button>
                    </span>
                  )}
                </div>

                <p className={styles.body}>
                  {report.donor_comment || "No comment was written for the donor."}
                </p>

                {!donorView && report.internal_note && (
                  <p className={styles.internal}>
                    <Icon name="shield-off" size={13} />
                    <span>Internal note: {report.internal_note}</span>
                  </p>
                )}

                {files.length > 0 && (
                  <div className={styles.files}>
                    {files.map((attachment) => (
                      <a
                        key={attachment.path}
                        className={styles.file}
                        href={attachmentUrl(attachment.path)}
                        target="_blank"
                        rel="noreferrer"
                        title={attachmentName(attachment.path)}
                      >
                        {isImagePath(attachment.path) ? (
                          <img src={attachmentUrl(attachment.path)} alt="" />
                        ) : (
                          <Icon name="clipboard-list" size={16} />
                        )}
                        {!donorView && !attachment.is_public && (
                          <span className={styles.private} title="Not shared with donors">
                            <Icon name="shield-off" size={11} />
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {editable && (
        <ReportFormDrawer
          opened={drawer.open}
          reportId={drawer.reportId}
          studentId={studentId}
          lockStudent
          contextLabel={studentName ?? undefined}
          onClose={() => setDrawer({ open: false, reportId: null })}
          onSaved={() => {
            setDrawer({ open: false, reportId: null });
            void load();
          }}
          onDeleted={() => void load()}
        />
      )}
    </div>
  );
};

export default ReportList;
