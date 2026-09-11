// supabase/functions/report-email/index.ts
//
// Sends one approved term report to every donor funding that student, each in
// the language they asked for.
//
// There is no donor dashboard. This email is the delivery — the only way a
// donor learns how the child they pay for is doing — which changes what the
// failure modes mean. A report that is approved and whose email did not send is
// not a queued job; it is a person who was never told. So every path here
// either sends or writes down, on the report row, exactly why it did not.
//
// Three gates, all re-read here rather than trusted from the request, because
// the browser is a machine this organisation does not own:
//
//   1. The caller is an admin.
//   2. The report is approved. A draft cannot be emailed by calling this
//      function directly with an id.
//   3. The recipient's language actually exists on the report. A Thai donor is
//      not sent the English version as a consolation.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  renderReportEmail,
  renderReportEmailText,
  subjectFor,
  hasLanguage,
  frameComplete,
  type EmailLanguage,
  type ReportEmailData,
  type ReportEmailRecipient,
  type ReportFrame,
} from "./template.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Set to enable sending. Without it the function refuses rather than pretending,
// exactly as send-donor-card does.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = Deno.env.get("REPORT_FROM") ?? "iCare Thailand <no-reply@icare.or.th>";
const ORGANISATION = Deno.env.get("ORGANISATION_NAME") ?? "iCare Thailand Foundation";
const PHOTO_BUCKET = "progress-photos";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders };

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fail = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: jsonHeaders });

/**
 * Records the failure on the report before answering.
 *
 * A send that fails and says so only in an HTTP response disappears the moment
 * the admin closes the tab. `send_error` is what makes the reports table able
 * to show "Approved · not sent", which is the only way anybody finds out.
 */
const recordFailure = async (reportId: string, message: string) => {
  await serviceClient
    .from("term_updates")
    .update({ send_error: message, send_attempted_at: new Date().toISOString() })
    .eq("id", reportId);
};

/** report_deliveries doesn't exist until 20260911115000 runs. */
const isMissingTable = (error: { code?: string } | null) => error?.code === "42P01" || error?.code === "PGRST205";

/**
 * Writes one recipient's state for a report: updates their live row, or adds
 * one. A donor is matched by donor_id; an added address by its email.
 *
 * A failure here is logged and never stops a send. The email reaching the
 * person matters more than the list recording it, and sent_to still does.
 */
const recordDelivery = async (
  reportId: string,
  recipient: ReportEmailRecipient,
  fields: {
    status: "waiting" | "sent" | "failed";
    sent_at?: string;
    error: string | null;
    reason: string | null;
    template_id?: string | null;
  },
) => {
  const email = recipient.email?.trim() ? recipient.email.trim().toLowerCase() : null;
  const values = {
    ...fields,
    name: recipient.name,
    email,
    language: recipient.language === "th" ? "th" : "en",
  };

  let match = serviceClient
    .from("report_deliveries")
    .update(values)
    .eq("report_id", reportId)
    .is("deleted_at", null);
  match = recipient.donor_id ? match.eq("donor_id", recipient.donor_id) : match.is("donor_id", null).eq("email", email ?? "");

  const { data, error } = await match.select("id");
  if (error) {
    if (!isMissingTable(error)) console.error("report-email: couldn't record delivery", error);
    return;
  }
  if ((data ?? []).length > 0) return;

  const { error: insertError } = await serviceClient
    .from("report_deliveries")
    .insert({ report_id: reportId, donor_id: recipient.donor_id, ...values });
  if (insertError && !isMissingTable(insertError)) {
    console.error("report-email: couldn't record delivery", insertError);
  }
};

/**
 * Adds a waiting row for each recipient who has no row yet. Existing rows are
 * left alone: a failed or no-address row keeps its reason, and a sent one
 * stays sent.
 */
const recordWaiting = async (reportId: string, recipients: ReportEmailRecipient[]) => {
  if (recipients.length === 0) return;
  const { data, error } = await serviceClient
    .from("report_deliveries")
    .select("id, donor_id, status, reason")
    .eq("report_id", reportId)
    .is("deleted_at", null);
  if (error) {
    if (!isMissingTable(error)) console.error("report-email: couldn't read deliveries", error);
    return;
  }
  const existing = (data ?? []) as Array<{ id: string; donor_id: string | null; status: string; reason: string | null }>;

  // A donor left out earlier on purpose (reports turned off, support waiting on
  // a decision) who is a recipient again still has that row, with its reason.
  // Clear it, or the Waiting to send list would keep hiding somebody who is now
  // owed the report.
  const intended = new Map(recipients.filter((r) => r.donor_id).map((r) => [r.donor_id as string, r]));
  for (const row of existing) {
    const recipient = row.donor_id ? intended.get(row.donor_id) : undefined;
    if (!recipient || row.status !== "waiting" || row.reason === null || row.reason === "no_email") continue;
    const { error: clearError } = await serviceClient
      .from("report_deliveries")
      .update({ reason: recipient.email?.trim() ? null : "no_email" })
      .eq("id", row.id);
    if (clearError) console.error("report-email: couldn't clear an old exclusion", clearError);
  }

  const known = new Set(existing.map((row) => row.donor_id));
  const rows = recipients
    .filter((recipient) => recipient.donor_id && !known.has(recipient.donor_id))
    .map((recipient) => ({
      report_id: reportId,
      donor_id: recipient.donor_id,
      name: recipient.name,
      email: recipient.email?.trim() ? recipient.email.trim().toLowerCase() : null,
      language: recipient.language === "th" ? "th" : "en",
      status: "waiting",
      reason: recipient.email?.trim() ? null : "no_email",
    }));
  if (rows.length === 0) return;
  const { error: insertError } = await serviceClient.from("report_deliveries").insert(rows);
  if (insertError) console.error("report-email: couldn't record waiting deliveries", insertError);
};

/** Why a donor connected to the student is not being sent this report. Matches report_deliveries_reason_check. */
type ExclusionReason = "needs_decision" | "support_ended" | "report_emails_off" | "donor_emails_off" | "no_email";

interface Excluded {
  donor_id: string;
  name: string | null;
  email: string | null;
  language: EmailLanguage;
  reason: ExclusionReason;
}

/** Support that ended this long ago is history, not a missing recipient. */
const RECENTLY_ENDED_DAYS = 180;

/**
 * Every donor connected to this student who is not getting the report, with
 * the reason. The view already leaves them out of `recipients`; this is how the
 * dialog can name them instead of letting them vanish.
 */
const loadExcluded = async (studentId: string): Promise<Excluded[]> => {
  const since = new Date(Date.now() - RECENTLY_ENDED_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await serviceClient
    .from("scholarships")
    .select(
      "donor_id, status, coverage_end, report_emails_enabled, donors(name, contact, invited_email, preferred_language, wants_email_updates)",
    )
    .eq("student_id", studentId)
    .or(`status.in.(active,needs_decision),and(status.eq.ended,coverage_end.gte.${since})`);
  if (error) {
    // Before 20260911140000 there is no report_emails_enabled column; nobody
    // is excluded for it, and the send goes on as before.
    if (error.code !== "42703") console.error("report-email: couldn't read exclusions", error);
    return [];
  }

  const rank: Record<string, number> = { active: 0, needs_decision: 1, ended: 2 };
  const byDonor = new Map<string, any>();
  for (const row of (data ?? []) as any[]) {
    const current = byDonor.get(row.donor_id);
    if (!current || (rank[row.status] ?? 9) < (rank[current.status] ?? 9)) byDonor.set(row.donor_id, row);
  }

  const out: Excluded[] = [];
  for (const row of byDonor.values()) {
    const donor = row.donors ?? {};
    const email = String(donor.contact?.email ?? donor.invited_email ?? "").trim().toLowerCase() || null;
    let reason: ExclusionReason | null = null;
    if (row.status === "needs_decision") reason = "needs_decision";
    else if (row.status === "ended") reason = "support_ended";
    else if (row.report_emails_enabled === false) reason = "report_emails_off";
    else if (donor.wants_email_updates === false) reason = "donor_emails_off";
    if (reason) {
      out.push({
        donor_id: row.donor_id,
        name: donor.name ?? null,
        email,
        language: donor.preferred_language === "th" ? "th" : "en",
        reason,
      });
    }
  }
  return out;
};

interface TemplateRow {
  id: string;
  is_default: boolean;
  frames: Record<EmailLanguage, ReportFrame>;
}

/** Report templates. Empty before 20260911160000, and the built in words are used. */
const loadReportTemplates = async (): Promise<TemplateRow[]> => {
  const { data, error } = await serviceClient
    .from("email_templates")
    .select("id, is_default, subject_en, subject_th, intro_en, intro_th, closing_en, closing_th")
    .eq("kind", "report")
    .is("deleted_at", null);
  if (error) {
    if (!isMissingTable(error)) console.error("report-email: couldn't read templates", error);
    return [];
  }
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    is_default: Boolean(row.is_default),
    frames: {
      en: { subject: row.subject_en ?? "", intro: row.intro_en ?? "", closing: row.closing_en ?? "" },
      th: { subject: row.subject_th ?? "", intro: row.intro_th ?? "", closing: row.closing_th ?? "" },
    },
  }));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "We couldn't send this report. Reload the page and try again.");

  try {
    // 1) The caller must be a signed-in admin.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user: caller } = { user: null }, error: callerError } =
      await callerClient.auth.getUser();

    if (callerError || !caller) return fail(401, "Your session has ended. Sign in again to continue.");

    const { data: roles } = await serviceClient
      .from("person_roles")
      .select("role")
      .eq("user_id", caller.id);

    if (!(roles ?? []).some((row) => row.role === "admin")) return fail(403, "Only admins can send reports. Ask an admin to do this for you.");

    const body = await req.json().catch(() => ({}));
    const reportId = body?.reportId as string | undefined;
    /** Render and return without sending. What the preview dialog calls. */
    const previewOnly = Boolean(body?.preview);

    // Addresses typed in at send (task 1.14): extra people to send to, and an
    // address for a funding donor who has none on record. The dialog checks
    // them too, but this function is what actually emails them, so it checks
    // again rather than trusting the page.
    const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isLanguage = (value: unknown): value is EmailLanguage => value === "en" || value === "th";
    const rawExtras: any[] = Array.isArray(body?.extraRecipients) ? body.extraRecipients : [];
    const rawDonorAddresses: any[] = Array.isArray(body?.donorAddresses) ? body.donorAddresses : [];
    const badAddress = [...rawExtras, ...rawDonorAddresses].find(
      (entry) => !EMAIL.test(String(entry?.email ?? "").trim()),
    );
    if (badAddress) {
      return fail(400, `"${String(badAddress?.email ?? "")}" doesn't look like a complete email address. Nothing was sent.`);
    }
    const extraRecipients = rawExtras.map((entry) => ({
      email: String(entry.email).trim().toLowerCase(),
      language: isLanguage(entry.language) ? entry.language : ("en" as EmailLanguage),
    }));
    const donorAddresses = new Map<string, { email: string; saveToDonor: boolean }>(
      rawDonorAddresses
        .filter((entry) => typeof entry?.donorId === "string")
        .map((entry) => [
          entry.donorId as string,
          { email: String(entry.email).trim().toLowerCase(), saveToDonor: entry.saveToDonor !== false },
        ]),
    );

    // Send to these funding donors only (task 1.15: one waiting delivery at a
    // time). An empty list means no donor, for retrying an added address. Left
    // out, every funding donor is in scope, as before.
    const onlyDonorIds: Set<string> | null = Array.isArray(body?.onlyDonorIds)
      ? new Set((body.onlyDonorIds as unknown[]).filter((id): id is string => typeof id === "string"))
      : null;
    const inScope = (recipient: ReportEmailRecipient) =>
      !onlyDonorIds || (recipient.donor_id !== null && onlyDonorIds.has(recipient.donor_id));

    // What the admin chose per donor at send: a template and a language. A
    // donor with no choice gets their own language and the default template.
    const rawChoices: any[] = Array.isArray(body?.choices) ? body.choices : [];
    const choices = new Map<string, { templateId: string | null; language: EmailLanguage | null }>(
      rawChoices
        .filter((entry) => typeof entry?.donorId === "string")
        .map((entry) => [
          entry.donorId as string,
          {
            templateId: typeof entry.templateId === "string" ? entry.templateId : null,
            language: isLanguage(entry.language) ? entry.language : null,
          },
        ]),
    );

    if (!reportId) return fail(400, "We couldn't tell which report to send. Reload the page and try again.");

    // 2) Everything one email needs, in one read.
    const { data: payload, error: payloadError } = await serviceClient
      .from("report_email_payload")
      .select("*")
      .eq("report_id", reportId)
      .maybeSingle();

    if (payloadError || !payload) return fail(404, "That report does not exist.");

    // 3) The gate. A report that has not been approved has not been read by
    //    anybody, and this function will not be the thing that sends it.
    if (payload.status !== "approved") {
      return fail(409, "This report is not approved. Nothing was sent.");
    }

    // Each donor in the language the admin chose for this send, or their own.
    const recipients = ((payload.recipients ?? []) as ReportEmailRecipient[]).map((recipient) => {
      const chosen = recipient.donor_id ? choices.get(recipient.donor_id)?.language : null;
      return chosen ? { ...recipient, language: chosen } : recipient;
    });
    const [excluded, templates] = await Promise.all([
      loadExcluded(payload.student_id),
      loadReportTemplates(),
    ]);
    const defaultTemplate = templates.find((template) => template.is_default) ?? templates[0] ?? null;
    /** The template for one recipient: their chosen one, else the default. */
    const templateFor = (recipient: ReportEmailRecipient): TemplateRow | null => {
      const id = recipient.donor_id ? choices.get(recipient.donor_id)?.templateId : null;
      return (id && templates.find((template) => template.id === id)) || defaultTemplate;
    };
    const frameFor = (recipient: ReportEmailRecipient): ReportFrame | null => {
      const template = templateFor(recipient);
      const frame = template?.frames[recipient.language as EmailLanguage] ?? null;
      return frameComplete(frame) ? frame : null;
    };

    if (recipients.length === 0 && extraRecipients.length === 0 && !previewOnly) {
      // The view leaves out donors who switched report emails off, so "nobody"
      // can mean no funding donor, or none who wants these emails. The preview
      // still opens with nobody listed, because an address can be added there.
      return fail(409, "No donor who funds this student is set to receive report emails, and no address was added. Nothing was sent.");
    }

    // A report can be sent more than once: after an address is added for a
    // donor who was skipped the first time. Whoever already received it is not
    // emailed again, and their record is kept rather than overwritten.
    const { data: prior, error: priorError } = await serviceClient
      .from("term_updates")
      .select("sent_to")
      .eq("id", reportId)
      .maybeSingle();
    // Not knowing who already has it is a reason to stop, not to assume nobody:
    // guessing wrong emails every donor a second time.
    if (priorError) {
      return fail(500, "We couldn't check who has already received this report. Nothing was sent.");
    }
    const alreadySent = (prior?.sent_to ?? []) as ReportEmailRecipient[];
    // Donor ids only: an added address has none, and a null here would make
    // every added address look like it had already been sent.
    const alreadySentIds = new Set(alreadySent.map((r) => r.donor_id).filter((id): id is string => Boolean(id)));
    const alreadySentEmails = new Set(alreadySent.map((r) => (r.email ?? "").toLowerCase()).filter(Boolean));

    // A donor with no address on record can be given one at send. Everything
    // below works on these, so the typed address counts everywhere.
    const addressGivenFor = new Set<string>();
    const withAddresses: ReportEmailRecipient[] = recipients.map((recipient) => {
      const given = !recipient.email?.trim() && recipient.donor_id ? donorAddresses.get(recipient.donor_id) : undefined;
      if (!given || !recipient.donor_id) return recipient;
      addressGivenFor.add(recipient.donor_id);
      return { ...recipient, email: given.email };
    });
    // Extra addresses, less any that already have this report or duplicate a donor.
    const extras: ReportEmailRecipient[] = extraRecipients
      .filter(
        (entry, index, all) =>
          !alreadySentEmails.has(entry.email) &&
          all.findIndex((other) => other.email === entry.email) === index &&
          !withAddresses.some((recipient) => (recipient.email ?? "").toLowerCase() === entry.email),
      )
      .map((entry) => ({ donor_id: null, name: null, email: entry.email, language: entry.language }));

    // 4) Branding, so a rebrand reaches the inbox without a deploy.
    const { data: branding } = await serviceClient
      .from("branding_settings")
      .select("logo_url, primary_color, donor_contact_email")
      .eq("id", "global")
      .maybeSingle();

    // 5) The photograph. Only an attachment somebody marked public during
    //    verification, and signed rather than made permanently public: an
    //    email link to a child's photo should expire.
    let photoUrl: string | null = null;
    const attachments = (payload.attachments ?? []) as Array<{ path?: string; is_public?: boolean }>;
    const publicImage = attachments.find(
      (file) => file?.path && file.is_public && /\.(jpe?g|png|webp)$/i.test(file.path),
    );

    if (publicImage?.path) {
      // 90 days: long enough that a donor can reopen the email next month,
      // short enough that a forwarded link does not live forever.
      const { data: signed } = await serviceClient.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(publicImage.path, 60 * 60 * 24 * 90);
      photoUrl = signed?.signedUrl ?? null;
    }

    const data: ReportEmailData = {
      studentName: payload.student_name ?? "",
      studentNameTh: payload.student_name_th ?? null,
      schoolName: payload.school_name ?? null,
      schoolNameTh: payload.school_name_th ?? null,
      gradeLevel: payload.grade_level ?? null,
      photoUrl,
      coversStart: payload.covers_start ?? null,
      coversEnd: payload.covers_end ?? null,
      reportDate: payload.report_date ?? null,
      gradeTextEn: payload.grade_text_en ?? null,
      gradeTextTh: payload.grade_text_th ?? null,
      commentEn: payload.donor_comment_en ?? null,
      commentTh: payload.donor_comment_th ?? null,
      organisationName: ORGANISATION,
      logoUrl: branding?.logo_url ?? null,
      contactEmail: branding?.donor_contact_email ?? null,
      primaryColor: branding?.primary_color ?? null,
    };

    // 6) The preview path stops here. Same renderer, same data, so what an
    //    admin approves is byte-for-byte what would send.
    if (previewOnly) {
      // Everyone this report is meant for, and who hasn't had it, is written
      // down as waiting now. If the dialog is closed without sending, the
      // report still shows on the Waiting to send list instead of vanishing.
      await recordWaiting(
        reportId,
        recipients.filter((recipient) => recipient.donor_id && !alreadySentIds.has(recipient.donor_id)),
      );
      return new Response(
        JSON.stringify({
          previews: recipients.map((recipient) => ({
            donor_id: recipient.donor_id,
            name: recipient.name,
            email: recipient.email,
            language: recipient.language,
            subject: subjectFor(data, recipient.language, frameFor(recipient)),
            html: renderReportEmail(data, recipient.language, recipient.name, frameFor(recipient)),
            missingLanguage: !hasLanguage(data, recipient.language),
          })),
          // The report itself, so the dialog can re-render when the admin picks
          // another template or language for someone without a round trip.
          data,
          // Donors connected to the student who won't get it, and why.
          excluded: excluded.map((row) => ({ donor_id: row.donor_id, name: row.name, reason: row.reason })),
          // Which versions exist, so the dialog can apply the same language
          // rule to an address typed in at send, which has no preview of its own.
          languages: { en: hasLanguage(data, "en"), th: hasLanguage(data, "th") },
        }),
        { headers: jsonHeaders },
      );
    }

    if (!RESEND_API_KEY) {
      const message =
        "We can't send emails right now. That part is still being set up. Try again later.";
      console.error("report-email: RESEND_API_KEY is not set");
      await recordFailure(reportId, message);
      return fail(503, message);
    }

    // 7) Refuse before sending anything, rather than sending some and failing
    //    on the rest. A donor whose language is missing must not receive the
    //    other one "just this once" — that is the whole point of asking.
    // Checked only for donors this send will actually reach. A donor skipped
    // for having no address, or one who already has the report, must not hold
    // it up for everyone else.
    const unwritable = [...withAddresses.filter(inScope), ...extras].filter(
      (recipient) =>
        recipient.email?.trim() &&
        !(recipient.donor_id && alreadySentIds.has(recipient.donor_id)) &&
        !hasLanguage(data, recipient.language as EmailLanguage),
    );
    const noTemplateLanguage = withAddresses.filter((recipient) => {
      if (!inScope(recipient) || !recipient.email?.trim()) return false;
      const id = recipient.donor_id ? choices.get(recipient.donor_id)?.templateId : null;
      if (!id) return false;
      const template = templates.find((row) => row.id === id);
      return !template || !frameComplete(template.frames[recipient.language as EmailLanguage]);
    });
    if (noTemplateLanguage.length > 0) {
      const names = noTemplateLanguage.map((r) => `${r.name ?? r.email ?? "A donor"} (${r.language})`).join(", ");
      return fail(409, `The template chosen for ${names} has no version in that language. Choose another template. Nothing was sent.`);
    }

    if (unwritable.length > 0) {
      const names = unwritable.map((r) => `${r.name ?? r.email ?? "A donor"} (${r.language})`).join(", ");
      const message = `The report has no version in the language these donors read: ${names}. Nothing was sent.`;
      await recordFailure(reportId, message);
      return fail(409, message);
    }

    // A donor with no address used to stop the send for everyone funding this
    // student. The others now receive it, and whoever was skipped is named in
    // the response and in send_error, so the gap stays visible until fixed.
    const addressless = withAddresses.filter((recipient) => inScope(recipient) && !recipient.email?.trim());
    const sendable = [
      ...withAddresses.filter(
        (recipient) =>
          inScope(recipient) &&
          recipient.email?.trim() &&
          !(recipient.donor_id && alreadySentIds.has(recipient.donor_id)),
      ),
      ...extras,
    ];
    const skippedNote =
      addressless.length > 0
        ? `No email address on record for: ${addressless.map((r) => r.name ?? "A donor").join(", ")}.`
        : null;

    if (sendable.length === 0) {
      const message = skippedNote
        ? `${skippedNote} Nothing was sent.`
        : "Every donor with an email address has already received this report. Nothing was sent.";
      if (skippedNote) await recordFailure(reportId, message);
      return fail(409, message);
    }

    // 8) Send.
    const sent: ReportEmailRecipient[] = [];
    const failures: string[] = [];
    const refused: Array<{ recipient: ReportEmailRecipient; detail: string }> = [];

    for (const recipient of sendable) {
      const language = recipient.language as EmailLanguage;

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: [recipient.email],
          // A donor's reply goes to a person, not into a no-reply void. This is
          // the only channel they have for a question now that there is no
          // dashboard to ask in.
          reply_to: branding?.donor_contact_email ?? undefined,
          subject: subjectFor(data, language, frameFor(recipient)),
          html: renderReportEmail(data, language, recipient.name, frameFor(recipient)),
          text: renderReportEmailText(data, language, recipient.name, frameFor(recipient)),
        }),
      });

      if (response.ok) {
        sent.push(recipient);
      } else {
        const detail = await response.text().catch(() => `${response.status}`);
        failures.push(`${recipient.name ?? recipient.email}: ${detail.slice(0, 200)}`);
        refused.push({ recipient, detail: detail.slice(0, 500) });
      }
    }

    // One row per person in report_deliveries: who has it, who was refused,
    // and who is still waiting for an address. The Waiting to send list reads
    // these, so a gap stays visible until somebody closes it.
    const sentAt = new Date().toISOString();
    for (const recipient of sent) {
      await recordDelivery(reportId, recipient, {
        status: "sent",
        sent_at: sentAt,
        error: null,
        reason: null,
        template_id: templateFor(recipient)?.id ?? null,
      });
    }
    // Everyone connected to the student who wasn't sent it, with the reason,
    // so the record says why rather than simply not mentioning them.
    for (const row of excluded) {
      await recordDelivery(
        reportId,
        { donor_id: row.donor_id, name: row.name, email: row.email, language: row.language },
        { status: "waiting", error: null, reason: row.reason },
      );
    }
    for (const { recipient, detail } of refused) {
      await recordDelivery(reportId, recipient, { status: "failed", error: detail, reason: null });
    }
    for (const recipient of addressless) {
      await recordDelivery(reportId, recipient, { status: "waiting", error: null, reason: "no_email" });
    }

    const now = new Date().toISOString();

    // A partial send is recorded as both: who received it, and who did not.
    // Collapsing it to "failed" would hide that some donors already have the
    // email, and a retry would send those donors a duplicate.
    // sent_at and sent_to are written only when something was sent this time.
    // Writing null on a failed attempt would erase the record of an earlier
    // send that did reach people.
    const update: Record<string, unknown> = {
      send_attempted_at: now,
      send_error: [...failures, ...(skippedNote ? [skippedNote] : [])].join(" · ") || null,
    };
    if (sent.length > 0) {
      update.sent_at = now;
      // Each person with the template and language they were actually sent.
      update.sent_to = [
        ...alreadySent,
        ...sent.map((recipient) => ({ ...recipient, template_id: templateFor(recipient)?.id ?? null })),
      ];
    }
    await serviceClient.from("term_updates").update(update).eq("id", reportId);

    // "Save to donor" was ticked for an address typed in at send. The donor
    // keeps it, so their next report goes without anybody typing it again.
    // Only for a donor who had no address and who actually received this one.
    const unsaved: string[] = [];
    for (const recipient of sent) {
      if (!recipient.donor_id || !addressGivenFor.has(recipient.donor_id)) continue;
      const given = donorAddresses.get(recipient.donor_id);
      if (!given?.saveToDonor) continue;
      const { data: donorRow } = await serviceClient
        .from("donors")
        .select("contact")
        .eq("id", recipient.donor_id)
        .maybeSingle();
      const contact = { ...((donorRow?.contact ?? {}) as Record<string, unknown>), email: given.email };
      const { error: saveError } = await serviceClient.from("donors").update({ contact }).eq("id", recipient.donor_id);
      if (saveError) unsaved.push(recipient.name ?? given.email);
    }

    if (failures.length > 0 && sent.length === 0) {
      console.error("report-email: every message refused", failures);
      return fail(502, "We couldn't send this report to anyone. Try again in a minute.");
    }

    return new Response(
      JSON.stringify({
        sent: sent.map((r) => ({
          donor_id: r.donor_id,
          name: r.name,
          email: r.email,
          language: r.language,
          template_id: templateFor(r)?.id ?? null,
        })),
        failed: failures,
        skipped: addressless.map((r) => ({ donor_id: r.donor_id, name: r.name })),
        // Sent to, but the typed address couldn't be saved to the donor.
        unsaved,
      }),
      { headers: jsonHeaders },
    );
  } catch (error) {
    console.error("report-email failed", error);
    return fail(500, "We couldn't send this report. Check your connection and try again.");
  }
});
