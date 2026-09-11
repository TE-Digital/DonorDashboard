// src/modules/reports/reportEmailTemplate.ts
//
// The report email.
//
// With no donor dashboard, this email *is* the delivery. There is no page a
// donor can visit to see a corrected version, no notification badge, no second
// chance. Whatever this function renders is what a person who paid for a
// child's school year receives, once, and it has to be right.
//
// It reads as a letter from a school: the photograph, her name, her grade, what
// her teacher said, a line from iCare, and nothing else. Deliberately not a
// newsletter and specifically not a fundraising appeal — no progress bar, no
// "she still needs your help", no donate button under a photograph of a child.
//
// Two mechanical constraints shape every line of the HTML:
//
//   * Email clients do not support CSS custom properties, so the Lumen tokens
//     appear here as literal hex values. They are copied, not imported, and the
//     comment beside each one names the token it came from so a palette change
//     can find them.
//   * Outlook still renders through Word's HTML engine, so layout is tables
//     with inline styles. Flexbox, grid and <style> blocks are not options.
//
// This file is shared by the preview dialog and the edge function. One
// renderer, so what an admin approves is byte-for-byte what sends.

export type EmailLanguage = "en" | "th";

export interface ReportEmailRecipient {
  /** Null for an address typed in at send, which belongs to no donor. */
  donor_id: string | null;
  name: string | null;
  email: string | null;
  language: EmailLanguage;
}

export interface ReportEmailData {
  studentName: string;
  studentNameTh: string | null;
  schoolName: string | null;
  schoolNameTh: string | null;
  gradeLevel: string | null;
  photoUrl: string | null;
  coversStart: string | null;
  coversEnd: string | null;
  reportDate: string | null;
  gradeTextEn: string | null;
  gradeTextTh: string | null;
  commentEn: string | null;
  commentTh: string | null;
  /** From branding_settings, so a rebrand does not need a deploy. */
  organisationName: string;
  logoUrl: string | null;
  contactEmail: string | null;
  primaryColor: string | null;
}

/* ----------------------------------------------------------------- copy */

// Both languages live side by side rather than in the app's translation
// catalogue: this text is sent, not displayed, and the edge function renders it
// in Deno with no i18next available.
const COPY = {
  en: {
    subject: (name: string) => `${name}'s term report`,
    greeting: (donor: string | null) => (donor ? `Dear ${donor},` : "Dear friend,"),
    intro: (name: string) =>
      `Here is how ${name} got on this term, in ${name}'s teacher's own words.`,
    gradeLabel: "Grade this term",
    schoolLabel: "School",
    termLabel: "Term",
    signOff: "With thanks from all of us,",
    replyNote: (email: string) =>
      `If you'd like to ask anything about this report, reply to this email or write to ${email}.`,
    photoAlt: (name: string) => `A photograph of ${name} taken this term`,
  },
  th: {
    subject: (name: string) => `รายงานประจำภาคเรียนของ${name}`,
    greeting: (donor: string | null) => (donor ? `เรียน คุณ${donor}` : "เรียน ท่านผู้สนับสนุน"),
    intro: (name: string) => `นี่คือความคืบหน้าของ${name}ในภาคเรียนนี้ เขียนโดยคุณครูผู้ดูแล`,
    gradeLabel: "ผลการเรียนภาคเรียนนี้",
    schoolLabel: "โรงเรียน",
    termLabel: "ภาคเรียน",
    signOff: "ด้วยความขอบคุณจากพวกเราทุกคน",
    replyNote: (email: string) =>
      `มีคำถามเกี่ยวกับรายงานฉบับนี้ไหมคะ ตอบกลับอีเมลนี้ หรือติดต่อ ${email} ได้เลยค่ะ`,
    photoAlt: (name: string) => `ภาพถ่ายของ${name}ในภาคเรียนนี้`,
  },
} as const;

/* ------------------------------------------------------------- helpers */

/**
 * Escapes anything that came from a person.
 *
 * A teacher's paragraph, a child's name and a school's name all reach this
 * template as free text, and any of them may contain an ampersand or an angle
 * bracket. Matches the helper in send-donor-card rather than inventing a
 * second one.
 */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/**
 * A date a person can read, in their own language.
 *
 * Thai dates use Thai month names with the Western year ("11 ก.ย. 2026"), the
 * same as every other screen for now (docs/VOICE.md §7). The Buddhist Era year
 * (2569) comes in a later release, across the product at once; switching only
 * the email would show one donor two different years for the same report.
 */
export const formatEmailDate = (value: string | null, language: EmailLanguage): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  if (language === "th") {
    return `${date.getDate()} ${MONTHS_TH[date.getMonth()]} ${date.getFullYear()}`;
  }
  return `${date.getDate()} ${MONTHS_EN[date.getMonth()]} ${date.getFullYear()}`;
};

const dateRange = (from: string | null, to: string | null, language: EmailLanguage): string => {
  const a = formatEmailDate(from, language);
  const b = formatEmailDate(to, language);
  if (a && b) return language === "th" ? `${a} ถึง ${b}` : `${a} to ${b}`;
  return a || b || "";
};

/** The name of a person or place in the language being written. */
export const localName = (
  latin: string | null,
  thai: string | null,
  language: EmailLanguage,
): string => {
  if (language === "th") return (thai || latin || "").trim();
  return (latin || thai || "").trim();
};

/** Which language's text exists on this report. */
export const hasLanguage = (data: ReportEmailData, language: EmailLanguage): boolean =>
  Boolean((language === "th" ? data.commentTh : data.commentEn)?.trim());

/**
 * The organisation's own words around the report, from an email template, in
 * one language, placeholders still in braces. The report itself (grade and
 * the teacher's paragraph) is never part of a frame, so no template can drop
 * or rewrite what a teacher wrote. Without a frame the built in words are used.
 */
export interface ReportFrame {
  subject: string;
  intro: string;
  closing: string;
}

const PLACEHOLDERS = ["donor_name", "student_name", "school_name", "grade_level", "report_period", "organisation"];

/** Fills {placeholders}; an unknown one is left as written so a typo shows rather than vanishing. */
export const fillFrame = (
  text: string,
  data: ReportEmailData,
  language: EmailLanguage,
  recipientName: string | null,
): string => {
  const values: Record<string, string> = {
    donor_name: recipientName ?? "",
    student_name: localName(data.studentName, data.studentNameTh, language),
    school_name: localName(data.schoolName, data.schoolNameTh, language),
    grade_level: data.gradeLevel ?? "",
    report_period: dateRange(data.coversStart, data.coversEnd, language),
    organisation: data.organisationName,
  };
  return text.replace(/\{([a-z_]+)\}/g, (match, key: string) => (PLACEHOLDERS.includes(key) ? values[key] : match));
};

/** A frame is usable in a language only when all three parts are written. */
export const frameComplete = (frame: ReportFrame | null | undefined): frame is ReportFrame =>
  Boolean(frame?.subject.trim() && frame?.intro.trim() && frame?.closing.trim());

export const subjectFor = (data: ReportEmailData, language: EmailLanguage, frame?: ReportFrame | null): string =>
  frameComplete(frame)
    ? fillFrame(frame.subject, data, language, null).trim()
    : COPY[language].subject(localName(data.studentName, data.studentNameTh, language));

/* ---------------------------------------------------------------- HTML */

// Lumen tokens as literals, because email cannot read custom properties.
const INK = "#161819"; // --text-heading
const BODY = "#3d4143"; // --text-body
const MUTED = "#6b7173"; // --text-muted
const LINE = "#e6e8e9"; // --border-subtle
const PAPER = "#ffffff"; // --surface-card
const GROUND = "#f6f5f2"; // --surface-nav, the warm off-white of the app chrome
const FALLBACK_ACCENT = "#072ac8"; // --blue-500

export const renderReportEmail = (
  data: ReportEmailData,
  language: EmailLanguage,
  recipientName: string | null,
  frame?: ReportFrame | null,
): string => {
  const copy = COPY[language];
  const accent = data.primaryColor?.trim() || FALLBACK_ACCENT;
  const framed = frameComplete(frame) ? frame : null;
  // A template's paragraphs, with their line breaks kept.
  const frameParagraphs = (text: string, style: string) =>
    escapeHtml(fillFrame(text, data, language, recipientName))
      .split(/\n{2,}/)
      .filter((part) => part.trim())
      .map((part) => `<p style="${style}">${part.replace(/\n/g, "<br />")}</p>`)
      .join("");

  const student = escapeHtml(localName(data.studentName, data.studentNameTh, language));
  const school = escapeHtml(localName(data.schoolName, data.schoolNameTh, language));
  const grade = escapeHtml((language === "th" ? data.gradeTextTh : data.gradeTextEn) ?? "");
  const comment = (language === "th" ? data.commentTh : data.commentEn) ?? "";
  const term = escapeHtml(dateRange(data.coversStart, data.coversEnd, language));

  // The teacher's paragraph, with its line breaks kept. A report written as
  // three short paragraphs must not arrive as one block.
  const body = escapeHtml(comment)
    .split(/\n{2,}/)
    .filter((part) => part.trim())
    .map(
      (part) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:${BODY}">${part.replace(
          /\n/g,
          "<br />",
        )}</p>`,
    )
    .join("");

  const fontStack =
    language === "th"
      ? "'Noto Sans Thai','Figtree',system-ui,-apple-system,'Segoe UI',sans-serif"
      : "'Figtree',system-ui,-apple-system,'Segoe UI',sans-serif";

  const rows: string[] = [];

  if (data.logoUrl) {
    rows.push(
      `<tr><td style="padding:24px 32px 0"><img src="${escapeHtml(
        data.logoUrl,
      )}" alt="${escapeHtml(data.organisationName)}" height="28" style="height:28px;width:auto;border:0" /></td></tr>`,
    );
  }

  if (data.photoUrl) {
    rows.push(
      // Full width, aspect ratio untouched. She is a specific child, not a
      // thumbnail cropped to fit a grid.
      `<tr><td style="padding:24px 0 0"><img src="${escapeHtml(
        data.photoUrl,
      )}" alt="${escapeHtml(copy.photoAlt(student))}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0" /></td></tr>`,
    );
  }

  rows.push(`<tr><td style="padding:28px 32px 0">
    ${
      framed
        ? frameParagraphs(framed.intro, `margin:0 0 16px;font-size:16px;line-height:1.6;color:${BODY}`)
        : `<p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:${BODY}">${escapeHtml(
            copy.greeting(recipientName),
          )}</p>`
    }
    <h1 style="margin:0 0 6px;font-size:22px;line-height:1.35;font-weight:600;color:${INK}">${student}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:${MUTED}">${[
      school && `${escapeHtml(copy.schoolLabel)}: ${school}`,
      data.gradeLevel && escapeHtml(String(data.gradeLevel)),
      term && `${escapeHtml(copy.termLabel)}: ${term}`,
    ]
      .filter(Boolean)
      .join(" &nbsp;·&nbsp; ")}</p>
  </td></tr>`);

  if (grade) {
    rows.push(`<tr><td style="padding:0 32px 20px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td style="padding:14px 18px;background:${GROUND};border-radius:8px">
          <div style="font-size:12px;color:${MUTED};margin-bottom:4px">${escapeHtml(copy.gradeLabel)}</div>
          <div style="font-size:18px;font-weight:600;color:${INK}">${grade}</div>
        </td></tr>
      </table>
    </td></tr>`);
  }

  rows.push(
    `<tr><td style="padding:0 32px">
      ${
        framed
          ? ""
          : `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${MUTED}">${escapeHtml(copy.intro(student))}</p>`
      }
      ${body}
    </td></tr>`,
  );

  rows.push(`<tr><td style="padding:8px 32px 28px">
    <hr style="border:0;border-top:1px solid ${LINE};margin:0 0 20px" />
    ${
      framed
        ? frameParagraphs(framed.closing, `margin:0 0 12px;font-size:15px;line-height:1.6;color:${BODY}`)
        : `<p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:${BODY}">${escapeHtml(copy.signOff)}</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;font-weight:600;color:${accent}">${escapeHtml(
      data.organisationName,
    )}</p>`
    }
    ${
      data.contactEmail
        ? `<p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED}">${escapeHtml(
            copy.replyNote(data.contactEmail),
          )}</p>`
        : ""
    }
  </td></tr>`);

  return `<!doctype html>
<html lang="${language}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subjectFor(data, language, framed))}</title></head>
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

/**
 * The plain-text part.
 *
 * Not an afterthought: some corporate mail clients strip HTML entirely, and a
 * donor at such a company would otherwise receive an empty message about a
 * child. This is the same report, readable.
 */
export const renderReportEmailText = (
  data: ReportEmailData,
  language: EmailLanguage,
  recipientName: string | null,
  frame?: ReportFrame | null,
): string => {
  const copy = COPY[language];
  const framed = frameComplete(frame) ? frame : null;
  const student = localName(data.studentName, data.studentNameTh, language);
  const school = localName(data.schoolName, data.schoolNameTh, language);
  const grade = (language === "th" ? data.gradeTextTh : data.gradeTextEn) ?? "";
  const comment = (language === "th" ? data.commentTh : data.commentEn) ?? "";

  if (framed) {
    return [
      fillFrame(framed.intro, data, language, recipientName),
      "",
      student,
      [school, data.gradeLevel, dateRange(data.coversStart, data.coversEnd, language)].filter(Boolean).join(" · "),
      grade ? `${copy.gradeLabel}: ${grade}` : "",
      "",
      comment,
      "",
      fillFrame(framed.closing, data, language, recipientName),
      data.contactEmail ? copy.replyNote(data.contactEmail) : "",
    ]
      .filter((line) => line !== "")
      .join("\n");
  }

  return [
    copy.greeting(recipientName),
    "",
    student,
    [school, data.gradeLevel, dateRange(data.coversStart, data.coversEnd, language)]
      .filter(Boolean)
      .join(" · "),
    grade ? `${copy.gradeLabel}: ${grade}` : "",
    "",
    copy.intro(student),
    "",
    comment,
    "",
    copy.signOff,
    data.organisationName,
    data.contactEmail ? copy.replyNote(data.contactEmail) : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
};
