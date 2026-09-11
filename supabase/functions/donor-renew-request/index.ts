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

    const name = (body?.name ?? "").toString().trim();
    const email = (body?.email ?? "").toString().trim();
    const message = (body?.message ?? "").toString().trim();
    const grantTypeId = body?.grantTypeId
      ? String(body.grantTypeId)
      : null;

    // optionally allow overrides later, but default to donor renewal
    const contactType =
      (body?.contactType as string | undefined)?.trim() ||
      "donor_renewal";
    const source =
      (body?.source as string | undefined)?.trim() ||
      "donor-dashboard";

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({
          error: "Add your name, email and a message before sending.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // Optional: validate grant_type_id actually exists
    let grant_type_id: string | null = null;
    if (grantTypeId) {
      const { data: gt, error: gtError } = await supabase
        .from("grant_types")
        .select("id")
        .eq("id", grantTypeId)
        .maybeSingle();

      if (gtError) {
        console.error(
          "donor-renew-request: grant_types lookup error",
          gtError,
        );
      } else if (gt?.id) {
        grant_type_id = gt.id as string;
      }
    }

    // Store the request in DB
    const { error: insertError } = await supabase
      .from("contact_requests")
      .insert({
        contact_type: contactType,
        name,
        email,
        message,
        grant_type_id,
        source,
        // extra: body.extra ?? null,  // if you ever want to pass more stuff
      });

    if (insertError) {
      console.error("donor-renew-request: insertError", insertError);
      return new Response(
        JSON.stringify({
          error:
            "We couldn't send your request. Check your connection and try again.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // Success: frontend sees ok: true and can show "we’ll contact you" message
    return new Response(
      JSON.stringify({
        ok: true,
        message:
          "We've got your request and will be in touch soon.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (err) {
    console.error("donor-renew-request: unexpected error", err);
    return new Response(
      JSON.stringify({ error: "We couldn't send your request. Check your connection and try again." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
