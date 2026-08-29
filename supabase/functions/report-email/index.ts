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
  type EmailLanguage,
  type ReportEmailData,
  type ReportEmailRecipient,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "Method not allowed");

  try {
    // 1) The caller must be a signed-in admin.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user: caller } = { user: null }, error: callerError } =
      await callerClient.auth.getUser();

    if (callerError || !caller) return fail(401, "Unauthorized");

    const { data: roles } = await serviceClient
      .from("person_roles")
      .select("role")
      .eq("user_id", caller.id);

    if (!(roles ?? []).some((row) => row.role === "admin")) return fail(403, "Forbidden");

    const body = await req.json().catch(() => ({}));
    const reportId = body?.reportId as string | undefined;
    /** Render and return without sending. What the preview dialog calls. */
    const previewOnly = Boolean(body?.preview);

    if (!reportId) return fail(400, "reportId is required.");

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

    const recipients = (payload.recipients ?? []) as ReportEmailRecipient[];

    if (recipients.length === 0) {
      return fail(409, "No donor funds this student, so there is nobody to send to.");
    }

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
      return new Response(
        JSON.stringify({
          previews: recipients.map((recipient) => ({
            donor_id: recipient.donor_id,
            name: recipient.name,
            email: recipient.email,
            language: recipient.language,
            subject: subjectFor(data, recipient.language),
            html: renderReportEmail(data, recipient.language, recipient.name),
            missingLanguage: !hasLanguage(data, recipient.language),
          })),
        }),
        { headers: jsonHeaders },
      );
    }

    if (!RESEND_API_KEY) {
      const message =
        "Email is not configured on the server. Set RESEND_API_KEY before sending reports.";
      await recordFailure(reportId, message);
      return fail(503, message);
    }

    // 7) Refuse before sending anything, rather than sending some and failing
    //    on the rest. A donor whose language is missing must not receive the
    //    other one "just this once" — that is the whole point of asking.
    const unwritable = recipients.filter(
      (recipient) => !hasLanguage(data, recipient.language as EmailLanguage),
    );
    if (unwritable.length > 0) {
      const names = unwritable.map((r) => `${r.name ?? "A donor"} (${r.language})`).join(", ");
      const message = `The report has no version in the language these donors read: ${names}. Nothing was sent.`;
      await recordFailure(reportId, message);
      return fail(409, message);
    }

    const addressless = recipients.filter((recipient) => !recipient.email?.trim());
    if (addressless.length > 0) {
      const names = addressless.map((r) => r.name ?? "A donor").join(", ");
      const message = `No email address on record for: ${names}. Nothing was sent.`;
      await recordFailure(reportId, message);
      return fail(409, message);
    }

    // 8) Send.
    const sent: ReportEmailRecipient[] = [];
    const failures: string[] = [];

    for (const recipient of recipients) {
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
          subject: subjectFor(data, language),
          html: renderReportEmail(data, language, recipient.name),
          text: renderReportEmailText(data, language, recipient.name),
        }),
      });

      if (response.ok) {
        sent.push(recipient);
      } else {
        const detail = await response.text().catch(() => `${response.status}`);
        failures.push(`${recipient.name ?? recipient.email}: ${detail.slice(0, 200)}`);
      }
    }

    const now = new Date().toISOString();

    // A partial send is recorded as both: who received it, and who did not.
    // Collapsing it to "failed" would hide that some donors already have the
    // email, and a retry would send those donors a duplicate.
    await serviceClient
      .from("term_updates")
      .update({
        sent_at: sent.length > 0 ? now : null,
        sent_to: sent.length > 0 ? sent : null,
        send_attempted_at: now,
        send_error: failures.length > 0 ? failures.join(" · ") : null,
      })
      .eq("id", reportId);

    if (failures.length > 0 && sent.length === 0) {
      return fail(502, `The email service refused every message. ${failures.join(" · ")}`);
    }

    return new Response(
      JSON.stringify({
        sent: sent.map((r) => ({ donor_id: r.donor_id, name: r.name, email: r.email, language: r.language })),
        failed: failures,
      }),
      { headers: jsonHeaders },
    );
  } catch (error) {
    console.error("report-email failed", error);
    return fail(500, "Something went wrong while sending this report.");
  }
});
