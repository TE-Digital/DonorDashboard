// supabase/functions/send-welcome/template.ts
//
// The welcome email: a short letter introducing a student to the donor who has
// just started funding them.
//
// It reads like a note from a school, not a receipt and not an appeal: a
// greeting, the student's photo, their name, what and where they study, a few
// lines about them, an optional word from the admin, and a closing that says
// reports will follow. No location, no family, no phone. Nothing here can reach
// those fields, because nothing passes them in.
//
// The organisation's greeting and closing come from an email template; the
// student part is fixed here, so a template can never drop or rewrite it.
//
// Shared by the preview dialog and the edge function, the way the report email
// is: one renderer, so what the admin reads is what sends. Deno bundles only
// what sits beside the function, so the file lives here and the browser
// re-exports it (src/modules/sponsorship/welcomeEmailTemplate.ts).
//
// Email clients cannot read CSS custom properties and Outlook renders through
// Word, so layout is tables and inline styles, with Lumen tokens as literals.
// Years are Western in both languages: Buddhist Era display is out of scope.

export type WelcomeLanguage = "en" | "th";

export interface WelcomeEmailData {
  donorName: string | null;
  studentName: string;
  schoolName: string | null;
  gradeLevel: string | null;
  photoUrl: string | null;
  description: string;
  note: string | null;
  organisationName: string;
  contactEmail: string | null;
  primaryColor: string | null;
  /** The template's words in this language, placeholders unfilled. */
  subject: string;
  intro: string;
  closing: string;
}

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const PLACEHOLDERS = ["donor_name", "student_name", "school_name", "grade_level", "report_period", "organisation"];

const fill = (text: string, data: WelcomeEmailData): string => {
  const values: Record<string, string> = {
    donor_name: data.donorName ?? "",
    student_name: data.studentName,
    school_name: data.schoolName ?? "",
    grade_level: data.gradeLevel ?? "",
    report_period: "",
    organisation: data.organisationName,
  };
  return text.replace(/\{([a-z_]+)\}/g, (match, key: string) => (PLACEHOLDERS.includes(key) ? values[key] : match));
};

// Thai school names usually already start with "โรงเรียน"; adding it again reads "โรงเรียนโรงเรียน…".
const thaiSchool = (school: string): string =>
  school.trim().startsWith("โรงเรียน") ? school.trim() : `โรงเรียน${school.trim()}`;

const COPY = {
  en: {
    studies: (grade: string | null, school: string | null) =>
      grade && school ? `${grade} at ${school}` : grade || school || "",
    noteFrom: "A note from us",
    photoAlt: (name: string) => `A photograph of ${name}`,
  },
  th: {
    studies: (grade: string | null, school: string | null) =>
      [grade ? `ชั้น ${grade}` : "", school ? thaiSchool(school) : ""].filter(Boolean).join(" "),
    noteFrom: "ข้อความจากเรา",
    photoAlt: (name: string) => `ภาพถ่ายของ${name}`,
  },
} as const;

// Lumen tokens as literals.
const INK = "#161819"; // --text-heading
const BODY = "#3d4143"; // --text-body
const MUTED = "#6b7173"; // --text-muted
const LINE = "#e6e8e9"; // --border-subtle
const PAPER = "#ffffff"; // --surface-card
const GROUND = "#f6f5f2"; // --surface-nav
const FALLBACK_ACCENT = "#072ac8"; // --blue-500

const paragraphs = (text: string, style: string) =>
  escapeHtml(text)
    .split(/\n{2,}/)
    .filter((part) => part.trim())
    .map((part) => `<p style="${style}">${part.replace(/\n/g, "<br />")}</p>`)
    .join("");

export const welcomeSubject = (data: WelcomeEmailData): string => fill(data.subject, data).trim();

export const renderWelcomeEmail = (data: WelcomeEmailData, language: WelcomeLanguage): string => {
  const copy = COPY[language];
  const accent = data.primaryColor?.trim() || FALLBACK_ACCENT;
  const fontStack =
    language === "th"
      ? "'Noto Sans Thai','Figtree',system-ui,-apple-system,'Segoe UI',sans-serif"
      : "'Figtree',system-ui,-apple-system,'Segoe UI',sans-serif";
  const text = `margin:0 0 16px;font-size:16px;line-height:1.75;color:${BODY}`;
  const studies = copy.studies(data.gradeLevel, data.schoolName);

  const rows: string[] = [];

  rows.push(`<tr><td style="padding:28px 32px 4px">${paragraphs(fill(data.intro, data), text)}</td></tr>`);

  if (data.photoUrl) {
    rows.push(
      `<tr><td style="padding:8px 0 0"><img src="${escapeHtml(data.photoUrl)}" alt="${escapeHtml(
        copy.photoAlt(data.studentName),
      )}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0" /></td></tr>`,
    );
  }

  rows.push(`<tr><td style="padding:24px 32px 0">
    <h1 style="margin:0 0 6px;font-size:22px;line-height:1.35;font-weight:600;color:${INK}">${escapeHtml(data.studentName)}</h1>
    ${studies ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:${MUTED}">${escapeHtml(studies)}</p>` : ""}
    ${paragraphs(data.description, text)}
  </td></tr>`);

  if (data.note?.trim()) {
    rows.push(`<tr><td style="padding:0 32px 8px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td style="padding:14px 18px;background:${GROUND};border-radius:8px">
          <div style="font-size:12px;color:${MUTED};margin-bottom:6px">${escapeHtml(copy.noteFrom)}</div>
          ${paragraphs(data.note, `margin:0;font-size:15px;line-height:1.7;color:${BODY}`)}
        </td></tr>
      </table>
    </td></tr>`);
  }

  rows.push(`<tr><td style="padding:16px 32px 28px">
    <hr style="border:0;border-top:1px solid ${LINE};margin:0 0 20px" />
    ${paragraphs(fill(data.closing, data), `margin:0 0 12px;font-size:15px;line-height:1.7;color:${BODY}`)}
    ${
      data.contactEmail
        ? `<p style="margin:0;font-size:13px;line-height:1.6;color:${accent}">${escapeHtml(data.contactEmail)}</p>`
        : ""
    }
  </td></tr>`);

  return `<!doctype html>
<html lang="${language}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(welcomeSubject(data))}</title></head>
<body style="margin:0;padding:0;background:${GROUND};font-family:${fontStack};color:${BODY}">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${GROUND}">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:${PAPER};border:1px solid ${LINE};border-radius:12px;overflow:hidden">
        ${rows.join("\n        ")}
      </table>
    </td></tr>
  </table>
</body></html>`;
};

/** The plain text part, for mail clients that strip HTML. */
export const renderWelcomeEmailText = (data: WelcomeEmailData, language: WelcomeLanguage): string => {
  const copy = COPY[language];
  return [
    fill(data.intro, data),
    "",
    data.studentName,
    copy.studies(data.gradeLevel, data.schoolName),
    "",
    data.description,
    data.note?.trim() ? `\n${copy.noteFrom}\n${data.note.trim()}` : "",
    "",
    fill(data.closing, data),
    data.contactEmail ?? "",
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n")
    .trim();
};
