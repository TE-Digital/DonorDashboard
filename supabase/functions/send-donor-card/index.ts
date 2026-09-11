// supabase/functions/send-donor-card/index.ts
//
// Emails one student's donor card to their donors, each in the language that
// donor asked for.
//
// The browser already refuses to send without consent and a published profile.
// That check is a courtesy to the admin, not a control: it runs on a machine
// the organisation does not own, in code anybody can edit. The check that
// matters is this one, and it re-reads consent from the database every time.
//
// What leaves this function is three fields (display name, description, photo)
// in one language. The student row is read with an explicit column list rather
// than `*`, so a column added to `students` next year cannot quietly find its
// way into an email about a child.
//
// Language is a fact about the donor, not a setting of the send: a donor who
// reads Thai gets the Thai card or nothing, and nobody is quietly sent the other
// language instead.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Set to enable sending. Without it the function refuses rather than pretending.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = Deno.env.get("DONOR_CARD_FROM") ?? "iCare Thailand <no-reply@icare.or.th>";
const ORGANISATION = Deno.env.get("ORGANISATION_NAME") ?? "iCare Thailand Foundation";

type Language = "en" | "th";

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

const LANGUAGE_NAME: Record<Language, string> = { en: "English", th: "Thai" };

interface CardText {
  name: string;
  description: string;
}

interface Recipient {
  donorId: string;
  name: string;
  email: string;
  language: Language;
}

const cardHtml = (card: CardText, language: Language, photoUrl: string | null) => `<!doctype html>
<html lang="${language}"><body style="margin:0;background:#f6f8f7;font-family:Figtree,'Noto Sans Thai',system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c302a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e3eae7;border-radius:8px;overflow:hidden">
        <tr><td style="height:6px;background:#1c7ed6"></td></tr>
        <tr><td align="center" style="padding:32px 32px 0">
          ${photoUrl ? `<img src="${photoUrl}" width="180" height="180" alt="${escapeHtml(card.name)}" style="border-radius:90px;object-fit:cover">` : ""}
        </td></tr>
        <tr><td align="center" style="padding:20px 32px 0;font-size:26px;font-weight:600">${escapeHtml(card.name)}</td></tr>
        <tr><td align="center" style="padding:12px 40px 32px;font-size:15px;line-height:1.8;color:#41554e">${escapeHtml(card.description)}</td></tr>
        <tr><td align="center" style="padding:16px;border-top:1px solid #e3eae7;font-size:12px;color:#6a7d76">${escapeHtml(ORGANISATION)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const subjectFor = (card: CardText, language: Language) =>
  language === "th" ? `แนะนำให้รู้จัก${card.name}` : `Meet ${card.name}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "We couldn't process that request.");

  try {
    // 1) The caller must be an admin.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !caller) return fail(401, "You need to sign in again before you can do that.");

    const { data: roles } = await serviceClient
      .from("person_roles")
      .select("role")
      .eq("user_id", caller.id);

    if (!(roles ?? []).some((row) => row.role === "admin")) return fail(403, "Only admins can send this.");

    const body = await req.json().catch(() => ({}));
    const studentId = body?.studentId as string | undefined;
    const overrideEmail = (body?.email as string | undefined)?.trim().toLowerCase();
    const overrideLanguage = body?.language === "th" || body?.language === "en" ? (body.language as Language) : null;

    if (!studentId) return fail(400, "We're missing some details needed to send this. Close this and try again.");

    // 2) The card, and only the card. Named columns, never `*`. The Thai columns
    //    arrive with 20260911130000; before that the card is English only.
    const baseColumns =
      "id, donor_display_name, donor_description, donor_photo_path, donor_profile_status, consent_status, status";
    let studentRead = await serviceClient
      .from("students")
      .select(`${baseColumns}, donor_display_name_th, donor_description_th`)
      .eq("id", studentId)
      .maybeSingle();
    if (studentRead.error?.code === "42703") {
      studentRead = await serviceClient.from("students").select(baseColumns).eq("id", studentId).maybeSingle();
    }

    const student = studentRead.data as Record<string, string | null> | null;
    if (studentRead.error || !student) return fail(404, "We couldn't find that student.");

    // 3) The gate. Re-read here, never taken from the request.
    if (student.consent_status !== "approved") {
      return fail(409, "Consent for this student isn't approved. Nothing was sent.");
    }
    if (student.donor_profile_status !== "published") {
      return fail(409, "This donor profile isn't published yet. Nothing was sent.");
    }

    const cards: Record<Language, CardText | null> = {
      en:
        student.donor_display_name?.trim() && student.donor_description?.trim()
          ? { name: student.donor_display_name.trim(), description: student.donor_description.trim() }
          : null,
      th:
        student.donor_display_name_th?.trim() && student.donor_description_th?.trim()
          ? { name: student.donor_display_name_th.trim(), description: student.donor_description_th.trim() }
          : null,
    };

    if (!cards.en && !cards.th) {
      return fail(409, "The card needs a display name and a description. Nothing was sent.");
    }

    // 4) Who it goes to: every donor actively funding this student. Until the
    //    old awards are copied into scholarships, a student whose only record
    //    is an award still reaches that award's donor.
    const { data: scholarships } = await serviceClient
      .from("scholarships")
      .select("donor_id")
      .eq("student_id", studentId)
      .eq("status", "active")
      .is("ended_at", null);

    let donorIds = [...new Set((scholarships ?? []).map((row) => row.donor_id).filter(Boolean))] as string[];

    if (!donorIds.length) {
      const { data: awards } = await serviceClient
        .from("scholarship_awards")
        .select("donor_id, period_end")
        .eq("student_id", studentId)
        .order("period_end", { ascending: false });
      const latest = (awards ?? []).find((award) => award.donor_id)?.donor_id;
      if (latest) donorIds = [latest];
    }

    if (!donorIds.length) return fail(409, "No donor funds this student yet, so there's nobody to send the card to.");

    const { data: donors } = await serviceClient
      .from("donors")
      .select("id, name, contact, invited_email, preferred_language, wants_email_updates")
      .in("id", donorIds);

    const recipients: Recipient[] = [];
    const skipped: string[] = [];

    for (const donor of donors ?? []) {
      const name = donor.name ?? "A donor";
      if (donor.wants_email_updates === false && !overrideEmail) {
        skipped.push(`${name} has turned off emails`);
        continue;
      }
      const email =
        overrideEmail ||
        ((donor.contact as { email?: string } | null)?.email ?? donor.invited_email ?? "").trim().toLowerCase();
      if (!email) {
        skipped.push(`${name} has no email address`);
        continue;
      }
      const language: Language = overrideLanguage ?? (donor.preferred_language === "th" ? "th" : "en");
      recipients.push({ donorId: donor.id, name, email, language });
      // An override address is one person, not one per donor.
      if (overrideEmail) break;
    }

    if (!recipients.length) {
      return fail(409, `Nobody could receive this card: ${skipped.join("; ")}. Nothing was sent.`);
    }

    // Nothing leaves unless every recipient can read what they're sent.
    const unreadable = recipients.filter((r) => !cards[r.language]);
    if (unreadable.length) {
      return fail(
        409,
        unreadable
          .map((r) => `${r.name} reads ${LANGUAGE_NAME[r.language]}, and the ${LANGUAGE_NAME[r.language]} version of this card is empty.`)
          .join(" ") + " Nothing was sent.",
      );
    }

    if (!RESEND_API_KEY) {
      return fail(
        503,
        "Email isn't set up yet. Download the card and send it yourself for now.",
      );
    }

    // 5) The photo, as a link the email client can load.
    const photoUrl = student.donor_photo_path
      ? serviceClient.storage.from("student-profiles").getPublicUrl(student.donor_photo_path).data.publicUrl
      : null;

    const delivered: Recipient[] = [];
    const failed: Recipient[] = [];

    for (const recipient of recipients) {
      const card = cards[recipient.language] as CardText;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: [recipient.email],
          subject: subjectFor(card, recipient.language),
          html: cardHtml(card, recipient.language, photoUrl),
        }),
      });

      if (response.ok) {
        delivered.push(recipient);
      } else {
        console.error("send-donor-card: provider error", recipient.email, response.status, await response.text());
        failed.push(recipient);
      }
    }

    if (!delivered.length) {
      return fail(502, "We couldn't send the card. Try again in a minute.");
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
      summary: `Donor card sent to ${delivered.map((r) => r.name).join(", ")}`,
      detail: {
        recipients: delivered.map((r) => ({ donor_id: r.donorId, email: r.email, language: r.language })),
        failed: failed.map((r) => ({ donor_id: r.donorId, email: r.email })),
        skipped,
      },
    });
    if (eventError) console.error("send-donor-card: event", eventError);

    return new Response(
      JSON.stringify({
        recipient: delivered.map((r) => r.name).join(", "),
        recipients: delivered.map((r) => ({ name: r.name, email: r.email, language: r.language })),
        failed: failed.map((r) => r.name),
        skipped,
        sentAt,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    console.error("send-donor-card: unexpected", error);
    return fail(500, "We couldn't finish that. Try again in a minute.");
  }
});
