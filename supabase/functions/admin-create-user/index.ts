import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Site URL so we can redirect to /reset-password
const SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:5173";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getCallerClient(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const callerSupabase = getCallerClient(req);

    // 1) Caller from JWT
    const {
      data: { user: caller },
      error: callerError,
    } = await callerSupabase.auth.getUser();

    if (callerError || !caller) {
      console.error("callerError", callerError);
      return new Response("Your session has ended. Sign in again to continue.", {
        status: 401,
        headers: corsHeaders,
      });
    }

    // 2) Check admin role
    const { data: callerRoles, error: rolesError } = await serviceClient
      .from("person_roles")
      .select("role")
      .eq("user_id", caller.id);

    if (rolesError) {
      console.error("rolesError", rolesError);
      return new Response("We couldn't check your access. Try again in a minute.", {
        status: 500,
        headers: corsHeaders,
      });
    }

    const isAdmin = (callerRoles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response("Only admins can add people. Ask an admin to do this for you.", {
        status: 403,
        headers: corsHeaders,
      });
    }

    // 3) Parse body
    const body = await req.json();
    const {
      email,
      full_name,
      phone,
      roles,
    }: {
      email: string;
      full_name: string;
      phone?: string;
      roles?:
        | ("admin" | "teacher" | "donor" | "agent")[]
        | Record<"admin" | "teacher" | "donor" | "agent", boolean>;
    } = body;

    if (!email || !full_name) {
      return new Response("Add an email address and a name to invite this person.", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 4) Normalise roles
    const ALLOWED_ROLES = ["admin", "teacher", "donor", "agent"] as const;
    let roleArray: ("admin" | "teacher" | "donor" | "agent")[] = [];

    if (Array.isArray(roles)) {
      roleArray = roles;
    } else if (roles && typeof roles === "object") {
      roleArray = ALLOWED_ROLES.filter((r) => (roles as any)[r]);
    }

    // 5) Invite user
    const { data: inviteData, error: inviteError } =
      await serviceClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name },
        redirectTo: `${SITE_URL}/reset-password`,
      });

    if (inviteError || !inviteData?.user) {
      console.error("inviteError", inviteError);
      return new Response(
        "We couldn't send the invite. Try again in a minute.",
        { status: 500, headers: corsHeaders },
      );
    }

    const newUser = inviteData.user;

    // 6) Upsert profile row WITH email ✅
    const { error: profileError } = await serviceClient
      .from("profiles")
      .upsert(
        {
          id: newUser.id,
          full_name,
          phone: phone ?? null,
          email: email, // 👈 ensure profiles.email is always set
        },
        { onConflict: "id" },
      );

    if (profileError) {
      console.error("profileError", profileError);
      return new Response(
        "We couldn't finish setting up this account. Try again in a minute.",
        { status: 500, headers: corsHeaders },
      );
    }

    // 7) Insert roles into person_roles
    if (roleArray.length > 0) {
      const roleRows = roleArray.map((r) => ({
        user_id: newUser.id,
        role: r,
      }));

      const { error: rolesInsertError } = await serviceClient
        .from("person_roles")
        .insert(roleRows);

      if (rolesInsertError) {
        console.error("rolesInsertError", rolesInsertError);
        return new Response(
          "We couldn't finish setting up this account. Try again in a minute.",
          { status: 500, headers: corsHeaders },
        );
      }
    }

    // 8) Done
    return new Response(
      JSON.stringify({
        user: {
          id: newUser.id,
          email: newUser.email,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      },
    );
  } catch (err) {
    console.error("Unexpected function error", err);
    return new Response("We couldn't finish that. Try again in a minute.", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
