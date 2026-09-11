// src/modules/reports/reportEmailTemplate.ts
//
// The application's door to the email renderer.
//
// The renderer itself lives in `supabase/functions/report-email/template.ts`,
// which is the one place it can live. Deno edge functions bundle only what sits
// inside their own directory, so a copy under `src/` would have to be a second
// copy — and two renderers means the preview an admin approves is not
// guaranteed to be the email that sends. Given that this email is the entire
// delivery mechanism, that gap is the one thing this feature cannot have.
//
// So the function owns the file and the browser reaches across to it. It is
// plain TypeScript with no Deno APIs and no DOM APIs, which is why this works
// in both runtimes.

export {
  renderReportEmail,
  renderReportEmailText,
  subjectFor,
  hasLanguage,
  localName,
  formatEmailDate,
  escapeHtml,
  fillFrame,
  frameComplete,
} from "../../../supabase/functions/report-email/template";

export type {
  EmailLanguage,
  ReportEmailData,
  ReportEmailRecipient,
  ReportFrame,
} from "../../../supabase/functions/report-email/template";
