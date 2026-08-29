// src/modules/reports/index.ts
//
// The reports module. One definition of what a term report is, one form that
// writes it, one list that shows it — shared by the admin screens, the teacher
// screens and the student record.
//
// Import from here, not from the individual files.

export { ReportForm } from "./ReportForm";
export type { ReportFormProps, SavedReport } from "./ReportForm";

export { ReportFormDrawer } from "./ReportFormDrawer";
export type { ReportFormDrawerProps } from "./ReportFormDrawer";

export { ReportList } from "./ReportList";
export type { ReportListProps } from "./ReportList";

export {
  CYCLE_MONTHS,
  DUE_SOON_DAYS,
  REPORT_STATE_META,
  REPORT_STATE_RANK,
  REPORT_STATUS_OPTIONS,
  loadCycleReports,
  reportCycle,
} from "./reportStatus";
export type { CycleReport, ReportCycle, ReportCycleState, ReportStateMeta, ReportStatus } from "./reportStatus";

export {
  REPORT_COLUMNS,
  deleteReport,
  emptyReportDetails,
  loadReport,
  loadStudentReports,
  saveReport,
  toReportDetails,
  toReportRow,
  validateReportDetails,
  REPORT_FIELD_ORDER,
} from "./reportRecord";
export type {
  ReportField,
  LoadedReport,
  ReportDetailsInput,
  ReportRecord,
  ReportSummary,
  SaveReportResult,
} from "./reportRecord";

export {
  REPORT_BUCKET,
  attachmentName,
  attachmentUrl,
  isImagePath,
  parseAttachments,
  removeAttachments,
  uploadAttachments,
} from "./reportAttachments";
export type { AttachmentDraft, ReportAttachment } from "./reportAttachments";

export { ReportRoutePage } from "./ReportRoutePage";
export type { ReportRoutePageProps } from "./ReportRoutePage";
