// supabase/functions/donor-renew-request/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);

// Email provider: Resend
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const DEFAULT_FROM_EMAIL = Deno.env.get("DONOR_RENEW_FROM_EMAIL") ??
  "no-reply@example.com";

serve(async (req) => {
  // Preflight for CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const name = (body?.name ?? "").toString().trim();
    const email = (body?.email ?? "").toString().trim();
    const message = (body?.message ?? "").toString().trim();
    const grantTypeId = body?.grantTypeId
      ? String(body.grantTypeId)
      : null;

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: name, email, message.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    if (!RESEND_API_KEY) {
      console.error("donor-renew-request: RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({
          error:
            "Email sending is not configured. Please contact the administrator.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // 1) Load branding settings to get donor_contact_email
    const { data: branding, error: brandingError } = await supabase
      .from("branding_settings")
      .select("donor_contact_email, hero_title")
      .eq("id", "global")
      .maybeSingle();

    if (brandingError) {
      console.error("donor-renew-request: brandingError", brandingError);
      return new Response(
        JSON.stringify({ error: "Could not load branding settings." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const recipient = branding?.donor_contact_email;
    if (!recipient) {
      console.error(
        "donor-renew-request: donor_contact_email not configured in branding_settings.",
      );
      return new Response(
        JSON.stringify({
          error:
            "Donor contact email is not configured. Please contact the administrator.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const orgName = branding?.hero_title ?? "Scholarship program";

    // 2) Optional grant type lookup
    let grantTypeName: string | null = null;
    if (grantTypeId) {
      const { data: gt, error: gtError } = await supabase
        .from("grant_types")
        .select("name")
        .eq("id", grantTypeId)
        .maybeSingle();

      if (gtError) {
        console.error("donor-renew-request: grant_types lookup error", gtError);
      } else if (gt?.name) {
        grantTypeName = String(gt.name);
      }
    }

    // 3) Build email content
    const subject = `Existing donor: renewal / next-steps request from ${name}`;
    const plainGrantType = grantTypeName
      ? `Preferred grant type: ${grantTypeName}\n\n`
      : "";

    const plainBody = [
      `Existing donor renewal / next-steps request for ${orgName}`,
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      grantTypeName ? `Preferred grant type: ${grantTypeName}` : null,
      "",
      "Message:",
      message,
    ]
      .filter(Boolean)
      .join("\n");

    const htmlBody = `
      <h2>Existing donor renewal / next-steps request for ${orgName}</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${
        grantTypeName
          ? `<p><strong>Preferred grant type:</strong> ${grantTypeName}</p>`
          : ""
      }
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, "<br />")}</p>
    `;

    // 4) Send email via Resend
    const fromEmail = DEFAULT_FROM_EMAIL;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject,
        text: plainBody,
        html: htmlBody,
        reply_to: email, // so you can reply directly to donor
      }),
    });

    if (!resendRes.ok) {
      const errorText = await resendRes.text();
      console.error(
        "donor-renew-request: Resend error",
        resendRes.status,
        errorText,
      );
      return new Response(
        JSON.stringify({
          error:
            "Could not send your request email. Please try again or contact us directly.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // 5) Success response
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("donor-renew-request: unexpected error", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
