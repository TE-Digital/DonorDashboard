// supabase/functions/send-donor-card/index.ts
//
// Emails one student's donor card to their donor.
//
// The browser already refuses to send without consent and a published profile.
// That check is a courtesy to the admin, not a control: it runs on a machine
// the organisation does not own, in code anybody can edit. The check that
// matters is this one, and it re-reads consent from the database every time.
//
// What leaves this function is three fields — display name, description, photo.
// The student row is read with an explicit column list rather than `*`, so a
// column added to `students` next year cannot quietly find its way into an
// email about a child.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Set to enable sending. Without it the function refuses rather than pretending.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = Deno.env.get("DONOR_CARD_FROM") ?? "iCare Thailand <no-reply@icare.or.th>";
const ORGANISATION = Deno.env.get("ORGANISATION_NAME") ?? "iCare Thailand Foundation";

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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "Method not allowed");

  try {
    // 1) The caller must be an admin.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !caller) return fail(401, "Unauthorized");

    const { data: roles } = await serviceClient
      .from("person_roles")
      .select("role")
      .eq("user_id", caller.id);

    if (!(roles ?? []).some((row) => row.role === "admin")) return fail(403, "Forbidden");

    const body = await req.json().catch(() => ({}));
    const studentId = body?.studentId as string | undefined;
    const overrideEmail = (body?.email as string | undefined)?.trim().toLowerCase();

    if (!studentId) return fail(400, "studentId is required.");

    // 2) The card, and only the card. Named columns, never `*`.
    const { data: student, error: studentError } = await serviceClient
      .from("students")
      .select("id, donor_display_name, donor_description, donor_photo_path, donor_profile_status, consent_status, status")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError || !student) return fail(404, "That student does not exist.");

    // 3) The gate. Re-read here, never taken from the request.
    if (student.consent_status !== "approved") {
      return fail(409, "Consent for this student is not approved. Nothing was sent.");
    }
    if (student.donor_profile_status !== "published") {
      return fail(409, "This donor profile is not published yet. Nothing was sent.");
    }
    if (!student.donor_display_name?.trim() || !student.donor_description?.trim()) {
      return fail(409, "The card needs a display name and a description. Nothing was sent.");
    }

    // 4) Who it goes to. The donor on the student's current award, unless the
    //    caller named an address — which is still checked against that donor.
    const { data: awards } = await serviceClient
      .from("scholarship_awards")
      .select("donor_id, status, period_end")
      .eq("student_id", studentId)
      .order("period_end", { ascending: false });

    const donorId = (awards ?? []).find((award) => award.donor_id)?.donor_id;
    if (!donorId) return fail(409, "This student has no donor on record, so there is nobody to send to.");

    const { data: donor } = await serviceClient
      .from("donors")
      .select("id, name, contact, invited_email")
      .eq("id", donorId)
      .maybeSingle();

    const donorEmail =
      overrideEmail ||
      ((donor?.contact as { email?: string } | null)?.email ?? donor?.invited_email ?? "")
        .trim()
        .toLowerCase();

    if (!donorEmail) return fail(409, "That donor has no email address on record.");

    // 5) The photo, as a link the email client can load.
    const photoUrl = student.donor_photo_path
      ? serviceClient.storage.from("student-profiles").getPublicUrl(student.donor_photo_path).data
          .publicUrl
      : null;

    const name = escapeHtml(student.donor_display_name.trim());
    const description = escapeHtml(student.donor_description.trim());

    const html = `<!doctype html>
<html><body style="margin:0;background:#f6f8f7;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c302a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e3eae7;border-radius:8px;overflow:hidden">
        <tr><td style="height:6px;background:#1c7ed6"></td></tr>
        <tr><td align="center" style="padding:32px 32px 0">
          ${photoUrl ? `<img src="${photoUrl}" width="180" height="180" alt="" style="border-radius:90px;object-fit:cover">` : ""}
        </td></tr>
        <tr><td align="center" style="padding:20px 32px 0;font-size:26px;font-weight:600">${name}</td></tr>
        <tr><td align="center" style="padding:12px 40px 32px;font-size:15px;line-height:1.7;color:#41554e">${description}</td></tr>
        <tr><td align="center" style="padding:16px;border-top:1px solid #e3eae7;font-size:12px;color:#6a7d76">${escapeHtml(ORGANISATION)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    if (!RESEND_API_KEY) {
      return fail(
        503,
        "Email is not configured on the server. Set RESEND_API_KEY, or download the card and send it yourself.",
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [donorEmail],
        subject: `An update about ${student.donor_display_name.trim()}`,
        html,
      }),
    });

    if (!response.ok) {
      console.error("send-donor-card: provider error", response.status, await response.text());
      return fail(502, "The email could not be sent. Try again in a minute.");
    }

    // 6) Record it, on the student and on the timeline. Both best effort: the
    //    email has already gone, and saying it failed would be false.
    const sentAt = new Date().toISOString();

    const { error: stampError } = await serviceClient
      .from("students")
      .update({ donor_card_sent_at: sentAt })
      .eq("id", studentId);
    if (stampError) console.error("send-donor-card: stamp", stampError);

    const { error: eventError } = await serviceClient.from("student_events").insert({
      student_id: studentId,
      actor_id: caller.id,
      kind: "donor_card_sent",
      summary: `Donor card sent to ${donorEmail}`,
      detail: { recipient: donorEmail, donor_id: donorId },
    });
    if (eventError) console.error("send-donor-card: event", eventError);

    return new Response(JSON.stringify({ recipient: donorEmail, sentAt }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("send-donor-card: unexpected", error);
    return fail(500, "Something went wrong. Try again in a minute.");
  }
});
