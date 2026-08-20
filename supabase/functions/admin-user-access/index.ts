// supabase/functions/admin-user-access/index.ts
//
// Everything an admin can do to somebody else's sign-in, in one admin-gated
// place: send the invite again, send a password link, copy a link to hand over
// another way, take access away, give it back.
//
// The browser never holds the service role, so none of this can be done from a
// page. It also means the audit trail in public.user_access_events is written
// by the same code that performs the action, and cannot be forged by a client.
//
// Actions
//   resend_invite — mails the invite again. An account that is already
//                   registered cannot be re-invited, so that case falls back to
//                   a password link, which is what the person actually needs.
//   send_reset    — mails a password link to somebody who already signed in.
//   invite_link   — returns a link WITHOUT mailing it, for handing over on LINE
//                   or in person. The link is a credential; see the note below.
//   revoke        — blocks sign-in without deleting the person or their data.
//   restore       — lifts the block.
//
// invite_link returns a single-use link that signs the holder in. It is
// deliberately not logged, not stored, and the response is not cached. The
// event row records that a link was copied, never the link itself.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") ?? Deno.env.get("FRONTEND_URL") ?? "http://localhost:5173";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  ...corsHeaders,
};

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Action = "resend_invite" | "send_reset" | "invite_link" | "revoke" | "restore";

const ACTIONS: Action[] = ["resend_invite", "send_reset", "invite_link", "revoke", "restore"];

/** Long enough to be permanent in practice, reversible in one call. */
const FOREVER = "876000h";

/**
 * "A user with this email address has already been registered."
 *
 * Auth says this for a second invite to a known address, whether or not that
 * person ever signed in. Every account created by admin-create-user is known,
 * so this is the normal path for a resend, not an error worth showing anybody.
 */
const alreadyRegistered = (error: { message?: string; status?: number } | null): boolean => {
  const message = (error?.message ?? "").toLowerCase();
  return message.includes("already been registered") || message.includes("already registered");
};

const fail = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: jsonHeaders });

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status: 200, headers: jsonHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "Method not allowed");

  try {
    // 1) Who is calling
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !caller) return fail(401, "Unauthorized");

    const { data: callerRoles, error: rolesError } = await serviceClient
      .from("person_roles")
      .select("role")
      .eq("user_id", caller.id);

    if (rolesError) {
      console.error("admin-user-access: rolesError", rolesError);
      return fail(500, "Could not check the caller's role.");
    }

    if (!(callerRoles ?? []).some((r) => r.role === "admin")) return fail(403, "Forbidden");

    // 2) What they asked for
    const body = await req.json().catch(() => ({}));
    const userId = body?.userId as string | undefined;
    const action = body?.action as Action | undefined;
    const redirectTo = (body?.redirectTo as string | undefined) || `${SITE_URL}/reset-password`;

    if (!userId) return fail(400, "userId is required.");
    if (!action || !ACTIONS.includes(action)) return fail(400, "Unknown action.");

    // 3) The target account
    const { data: target, error: targetError } = await serviceClient.auth.admin.getUserById(userId);

    if (targetError || !target?.user) return fail(404, "That user does not exist.");

    const email = target.user.email;
    if (!email && action !== "revoke" && action !== "restore") {
      return fail(400, "That user has no email address, so nothing can be sent.");
    }

    // An account is "registered" once the person has set a password or signed
    // in. Supabase refuses a second invite for those, so they get a password
    // link instead — same outcome for the person, one fewer dead end for the
    // admin.
    const registered = Boolean(target.user.confirmed_at || target.user.last_sign_in_at);

    let channel: "email" | "clipboard" = "email";
    let actionLink: string | null = null;
    let performed: Action = action;
    let note: string | null = null;

    switch (action) {
      case "resend_invite": {
        if (!registered) {
          const { error } = await serviceClient.auth.admin.inviteUserByEmail(email!, {
            redirectTo,
          });

          if (!error) {
            note = "Invite email sent again.";
            break;
          }

          // Supabase refuses to invite an address it already knows, which is
          // every account created here. That is not a failure the admin can do
          // anything about, so it becomes the link the person actually needs.
          if (!alreadyRegistered(error)) {
            console.error("admin-user-access: inviteUserByEmail", error);
            return fail(502, "The invite email could not be sent. Try again in a minute.");
          }
        }
        // A password link does the same job for somebody whose address is
        // already registered: one click, they set a password, they are in.
        const { error } = await callerClient.auth.resetPasswordForEmail(email!, { redirectTo });
        if (error) {
          console.error("admin-user-access: resetPasswordForEmail", error);
          return fail(502, "The email could not be sent. Try again in a minute.");
        }
        performed = "send_reset";
        note = "This address is already registered, so a password link was sent instead of an invite.";
        break;
      }

      case "send_reset": {
        const { error } = await callerClient.auth.resetPasswordForEmail(email!, { redirectTo });
        if (error) {
          console.error("admin-user-access: resetPasswordForEmail", error);
          return fail(502, "The email could not be sent. Try again in a minute.");
        }
        note = "Password link sent.";
        break;
      }

      case "invite_link": {
        const link = async (type: "invite" | "recovery") =>
          await serviceClient.auth.admin.generateLink({
            type,
            email: email!,
            options: { redirectTo },
          });

        let { data, error } = registered ? await link("recovery") : await link("invite");

        // Same story as a resend: an invite link cannot be minted for an
        // address auth already holds, and a recovery link does the job.
        if (error && alreadyRegistered(error)) ({ data, error } = await link("recovery"));

        if (error || !data?.properties?.action_link) {
          console.error("admin-user-access: generateLink", error);
          return fail(502, "The link could not be created. Try again in a minute.");
        }
        actionLink = data.properties.action_link;
        channel = "clipboard";
        note = "One-time sign-in link created and copied by an admin. The link itself is not recorded.";
        break;
      }

      case "revoke": {
        const { error } = await serviceClient.auth.admin.updateUserById(userId, {
          ban_duration: FOREVER,
        });
        if (error) {
          console.error("admin-user-access: revoke", error);
          return fail(502, "Access could not be removed. Try again in a minute.");
        }
        channel = "email"; // nothing was sent; the column stays null below
        note = "Sign-in blocked.";
        break;
      }

      case "restore": {
        const { error } = await serviceClient.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });
        if (error) {
          console.error("admin-user-access: restore", error);
          return fail(502, "Access could not be restored. Try again in a minute.");
        }
        note = "Sign-in allowed again.";
        break;
      }
    }

    const sentSomething = performed === "resend_invite" || performed === "send_reset" || performed === "invite_link";

    // 4) Record it. A failure here must not tell the admin the action failed —
    //    the email has already gone out.
    if (sentSomething) {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("invite_count")
        .eq("id", userId)
        .maybeSingle();

      const { error: profileError } = await serviceClient
        .from("profiles")
        .update({
          last_invite_at: new Date().toISOString(),
          invite_count: ((profile?.invite_count as number | null) ?? 0) + 1,
        })
        .eq("id", userId);

      if (profileError) console.error("admin-user-access: profile update", profileError);
    }

    const { error: eventError } = await serviceClient.from("user_access_events").insert({
      user_id: userId,
      actor_id: caller.id,
      action: performed,
      channel: sentSomething ? channel : null,
      note,
    });

    if (eventError) console.error("admin-user-access: event insert", eventError);

    return ok({ action: performed, note, actionLink });
  } catch (error) {
    console.error("admin-user-access: unexpected", error);
    return fail(500, "Something went wrong. Try again in a minute.");
  }
});
