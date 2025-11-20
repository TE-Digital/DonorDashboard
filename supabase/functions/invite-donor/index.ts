// supabase/functions/invite-donor/index.ts
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

serve(async (req) => {
  // CORS preflight
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
    const donorId = body?.donorId as string | undefined;
    const explicitEmail = body?.email as string | undefined;
    const preferredLanguage =
      (body?.preferredLanguage as string | undefined) ?? "en";

    if (!donorId) {
      return new Response(JSON.stringify({ error: "donorId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 1) Load donor (no profile_id here)
    const { data: donor, error: donorError } = await supabase
      .from("donors")
      .select("id, contact, user_id, is_dashboard_enabled")
      .eq("id", donorId)
      .maybeSingle();

    if (donorError) {
      console.error("invite-donor: error loading donor", donorError);
      return new Response(JSON.stringify({ error: "Error loading donor" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!donor) {
      return new Response(JSON.stringify({ error: "Donor not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2) Determine email (body.email overrides contact.email)
    const contact = (donor.contact ?? {}) as { email?: string | null };
    const email =
      explicitEmail?.trim().toLowerCase() ||
      contact.email?.trim().toLowerCase() ||
      null;

    if (!email) {
      return new Response(
        JSON.stringify({
          error: "Donor has no email in contact information.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // 3) See if a profile already exists for this email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("invite-donor: profileError", profileError);
      return new Response(
        JSON.stringify({ error: "Error loading profile for this email." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    let authUserId: string;

    if (profile) {
      // Existing user → reuse its id
      authUserId = profile.id;
    } else {
      // 4) No user yet → create + send invite email
      const { data: inviteResult, error: inviteError } =
        await supabase.auth.admin.inviteUserByEmail(email, {
          data: {
            preferredLanguage,
            role: "donor",
          },
        });

      if (inviteError || !inviteResult || !inviteResult.user) {
        console.error("invite-donor: inviteUserByEmail error", inviteError);
        return new Response(
          JSON.stringify({ error: "Failed to create/invite user." }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      authUserId = inviteResult.user.id;
    }

    const nowIso = new Date().toISOString();

    // 5) Update donor row: link to user + track invitation
    const { error: updateError } = await supabase
      .from("donors")
      .update({
        user_id: authUserId,
        is_dashboard_enabled: true,
        invited_at: nowIso,
        invited_email: email,
      })
      .eq("id", donorId);

    if (updateError) {
      console.error("invite-donor: updateError", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to link donor to profile." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // 6) Ensure DONOR role in person_roles
    const { data: existingRoleRows, error: roleError } = await supabase
      .from("person_roles")
      .select("id")
      .eq("user_id", authUserId)
      .eq("role", "donor");

    if (!roleError && (!existingRoleRows || existingRoleRows.length === 0)) {
      const { error: insertRoleError } = await supabase
        .from("person_roles")
        .insert({ user_id: authUserId, role: "donor" });

      if (insertRoleError) {
        console.error("invite-donor: insertRoleError", insertRoleError);
        // not fatal
      }
    } else if (roleError) {
      console.error("invite-donor: roleError", roleError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Donor linked (and invited if needed).",
        language: preferredLanguage,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (err) {
    console.error("invite-donor unexpected error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
