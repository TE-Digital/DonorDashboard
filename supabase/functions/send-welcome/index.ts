// supabase/functions/send-welcome/index.ts
//
// Sends the welcome email for one sponsorship: one donor, one student, once.
//
// The browser shows a preview and refuses to send when something is missing,
// but that is a courtesy. The checks that matter are here, re-read from the
// database every time: the family's consent, a published profile, an active
// sponsorship, a donor who still wants emails, and words in the language the
// admin chose. The admin's edits for this email (the description and a note)
// are the only things taken from the request.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  renderWelcomeEmail,
  renderWelcomeEmailText,
  welcomeSubject,
  type WelcomeEmailData,
  type WelcomeLanguage,
} from "./template.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = Deno.env.get("DONOR_CARD_FROM") ?? "iCare Thailand <no-reply@icare.or.th>";
const ORGANISATION = Deno.env.get("ORGANISATION_NAME") ?? "iCare";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders };

const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fail = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers: jsonHeaders });

const LANGUAGE_NAME: Record<WelcomeLanguage, string> = { en: "English", th: "Thai" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "We couldn't process that request.");

  try {
    // 1) The caller must be an admin.
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: auth, error: authError } = await caller.auth.getUser();
    if (authError || !auth.user) return fail(401, "You need to sign in again before you can do that.");
    const { data: roles } = await service.from("person_roles").select("role").eq("user_id", auth.user.id);
    if (!(roles ?? []).some((row) => row.role === "admin")) return fail(403, "Only admins can send this.");

    const body = await req.json().catch(() => ({}));
    const scholarshipId = body?.scholarshipId as string | undefined;
    const templateId = body?.templateId as string | undefined;
    const language: WelcomeLanguage = body?.language === "th" ? "th" : "en";
    const description = String(body?.description ?? "").trim();
    const note = String(body?.note ?? "").trim() || null;
    if (!scholarshipId || !templateId) return fail(400, "We're missing some details needed to send this. Close this and try again.");

    // 2) The relationship, re-read.
    const { data: sponsorship } = await service
      .from("scholarships")
      .select("id, student_id, donor_id, status, welcome_sent_at")
      .eq("id", scholarshipId)
      .maybeSingle();
    if (!sponsorship) return fail(404, "We couldn't find this donor's support.");
    if (sponsorship.status !== "active") return fail(409, "This support isn't active, so there's nobody to welcome.");
    if (sponsorship.welcome_sent_at) return fail(409, "The welcome for this donor has already been sent.");

    // 3) The student: the donor card and where they study. Named columns only.
    const base = "id, name, nickname, grade_level, school_id, consent_status, donor_profile_status, donor_display_name, donor_description, donor_photo_path";
    let studentRead = await service
      .from("students")
      .select(`${base}, donor_display_name_th, donor_description_th`)
      .eq("id", sponsorship.student_id)
      .maybeSingle();
    if (studentRead.error?.code === "42703") {
      studentRead = await service.from("students").select(base).eq("id", sponsorship.student_id).maybeSingle();
    }
    const student = studentRead.data as Record<string, string | null> | null;
    if (!student) return fail(404, "We couldn't find this student.");
    if (student.consent_status !== "approved") return fail(409, "The family's consent isn't approved. Nothing was sent.");
    if (student.donor_profile_status !== "published") return fail(409, "This donor profile isn't published yet. Nothing was sent.");

    const name = (language === "th" ? student.donor_display_name_th : student.donor_display_name)?.trim();
    if (!name || !description) {
      return fail(409, `The ${LANGUAGE_NAME[language]} name or description for this student is empty. Nothing was sent.`);
    }

    const { data: school } = student.school_id
      ? await service.from("schools").select("name, name_th").eq("id", student.school_id).maybeSingle()
      : { data: null };

    // 4) The donor.
    const { data: donor } = await service
      .from("donors")
      .select("id, name, contact, invited_email, wants_email_updates")
      .eq("id", sponsorship.donor_id)
      .maybeSingle();
    if (!donor) return fail(404, "We couldn't find this donor.");
    if (donor.wants_email_updates === false) return fail(409, `${donor.name ?? "This donor"} has turned off emails. Nothing was sent.`);
    const email = ((donor.contact as { email?: string } | null)?.email ?? donor.invited_email ?? "").trim().toLowerCase();
    if (!email) return fail(409, `${donor.name ?? "This donor"} has no email address. Nothing was sent.`);

    // 5) The template, in the chosen language.
    const { data: template } = await service
      .from("email_templates")
      .select("id, kind, subject_en, subject_th, intro_en, intro_th, closing_en, closing_th, deleted_at")
      .eq("id", templateId)
      .maybeSingle();
    if (!template || template.kind !== "welcome" || template.deleted_at) return fail(409, "That welcome template isn't available.");
    const subjectText = (language === "th" ? template.subject_th : template.subject_en)?.trim();
    const introText = (language === "th" ? template.intro_th : template.intro_en)?.trim();
    const closingText = (language === "th" ? template.closing_th : template.closing_en)?.trim();
    if (!subjectText || !introText || !closingText) {
      return fail(409, `That template has no ${LANGUAGE_NAME[language]} version. Nothing was sent.`);
    }

    const { data: branding } = await service
      .from("branding_settings")
      .select("donor_contact_email, primary_color")
      .eq("id", "global")
      .maybeSingle();

    const photoUrl = student.donor_photo_path
      ? service.storage.from("student-profiles").getPublicUrl(student.donor_photo_path).data.publicUrl
      : null;

    const data: WelcomeEmailData = {
      donorName: donor.name,
      studentName: name,
      schoolName: language === "th" ? school?.name_th || school?.name || null : school?.name || null,
      gradeLevel: student.grade_level,
      photoUrl,
      description,
      note,
      organisationName: ORGANISATION,
      contactEmail: branding?.donor_contact_email ?? null,
      primaryColor: branding?.primary_color ?? null,
      subject: subjectText,
      intro: introText,
      closing: closingText,
    };
    const subject = welcomeSubject(data);

    const record = {
      scholarship_id: sponsorship.id,
      donor_id: donor.id,
      student_id: sponsorship.student_id,
      template_id: template.id,
      language,
      email,
      subject,
      description_text: description,
      admin_note: note,
      created_by: auth.user.id,
    };

    if (!RESEND_API_KEY) {
      await service.from("sponsorship_welcomes").insert({ ...record, send_error: "Email is not set up on the server." });
      return fail(503, "Email isn't set up yet, so the welcome wasn't sent. Ask whoever looks after the system to set it up.");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [email],
        reply_to: branding?.donor_contact_email ?? undefined,
        subject,
        html: renderWelcomeEmail(data, language),
        text: renderWelcomeEmailText(data, language),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("send-welcome: provider error", response.status, detail);
      await service.from("sponsorship_welcomes").insert({ ...record, send_error: `Provider ${response.status}` });
      return fail(502, "We couldn't send the welcome. Try again in a minute.");
    }

    const sentAt = new Date().toISOString();
    await service.from("sponsorship_welcomes").insert({ ...record, sent_at: sentAt });
    const { error: stampError } = await service
      .from("scholarships")
      .update({ welcome_sent_at: sentAt })
      .eq("id", sponsorship.id);
    if (stampError) console.error("send-welcome: stamp", stampError);

    const { error: eventError } = await service.from("student_events").insert({
      student_id: sponsorship.student_id,
      actor_id: auth.user.id,
      kind: "scholarship_changed",
      summary: `Welcome email sent to ${donor.name ?? email}`,
      detail: { scholarship_id: sponsorship.id, email, language, template_id: template.id },
    });
    if (eventError) console.error("send-welcome: event", eventError);

    return new Response(JSON.stringify({ sentAt, email }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error("send-welcome: unexpected", error);
    return fail(500, "We couldn't finish that. Try again in a minute.");
  }
});
