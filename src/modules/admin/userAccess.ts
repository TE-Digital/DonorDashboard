// src/modules/admin/userAccess.ts
//
// One definition of "can this person sign in, and what have we sent them?",
// shared by every directory and every detail page, so two screens never
// disagree about whether a teacher has an account.
//
// Sign in state is never stored in public.profiles. It lives in auth.users and
// is read through the admin_user_access_state() function added by
// supabase/migrations/20260820100000_user_access.sql — a copy would go stale
// the moment somebody accepted an invite, and a stale "Invited" badge is worse
// than none, because an admin acts on it.
//
// Actions go to the admin-user-access edge function, which holds the service
// role, checks the caller is an admin, and writes the audit trail. Nothing
// here can send an email on its own.
//
// Until the migration is applied the RPC does not exist. Screens then show
// "Unknown" rather than failing: a directory that will not load is a worse
// outcome than a directory with one column missing.

import { supabase } from "../../lib/supabaseClient";

/* --------------------------------------------------------------- The state */

export type AccessState = "active" | "invited" | "stale" | "revoked" | "none" | "unknown";

export interface AccessRow {
  user_id: string;
  invited_at: string | null;
  confirmed_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  last_invite_at: string | null;
  invite_count: number | null;
}

/**
 * After this long, an unaccepted invite is treated as one that never arrived.
 *
 * Supabase's own link expires far sooner. Seven days is not the link's life —
 * it is how long an admin should wait before assuming the email went to spam
 * and chasing the teacher on LINE instead.
 */
export const INVITE_STALE_DAYS = 7;

const daysSince = (iso: string | null): number | null => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
};

export const accessStateOf = (row: AccessRow | null | undefined): AccessState => {
  if (!row) return "unknown";

  // A ban in the future is a revoked account. Supabase writes a date far ahead
  // rather than a flag, and clears it by setting the date to the past.
  if (row.banned_until && new Date(row.banned_until).getTime() > Date.now()) return "revoked";

  if (row.confirmed_at || row.last_sign_in_at) return "active";

  if (row.invited_at || row.last_invite_at) {
    const age = daysSince(row.last_invite_at ?? row.invited_at);
    return age != null && age >= INVITE_STALE_DAYS ? "stale" : "invited";
  }

  return "none";
};

export type AccessTone = "success" | "info" | "warning" | "danger" | "neutral";

export interface AccessMeta {
  label: string;
  tone: AccessTone;
  /** One sentence, shown under the badge on a detail page and in a tooltip. */
  hint: string;
}

export const ACCESS_META: Record<AccessState, AccessMeta> = {
  active: {
    label: "Active",
    tone: "success",
    hint: "This person has signed in and can use the platform.",
  },
  invited: {
    label: "Invited",
    tone: "info",
    hint: "The invitation is sent. They have not set a password yet.",
  },
  stale: {
    label: "Invite not used",
    tone: "warning",
    hint: "The invitation is more than a week old and still unused. Send it again, or share the link another way.",
  },
  revoked: {
    label: "Access removed",
    tone: "danger",
    hint: "Sign in is blocked. The record and its history are untouched.",
  },
  none: {
    label: "No account",
    tone: "neutral",
    hint: "This person has no sign in yet. Send an invitation to create one.",
  },
  unknown: {
    label: "Unknown",
    tone: "neutral",
    hint: "We can't show this account's sign in state yet. That part is still being set up.",
  },
};

/** Sort order for the access column: what needs attention first. */
export const ACCESS_RANK: Record<AccessState, number> = {
  stale: 0,
  none: 1,
  invited: 2,
  revoked: 3,
  active: 4,
  unknown: 5,
};

/* ------------------------------------------------------------- Reading it */

export interface AccessMap {
  byUser: Record<string, AccessRow>;
  /** False when the migration is not applied. Screens then show "Unknown". */
  available: boolean;
  error: string | null;
}

const EMPTY_MAP: AccessMap = { byUser: {}, available: false, error: null };

/**
 * Sign in state for every user with a profile, in one call.
 *
 * Deliberately not filtered by id: a directory needs all of them, and the
 * function already answers nothing at all to a non-admin.
 */
export const loadAccessMap = async (): Promise<AccessMap> => {
  const { data, error } = await supabase.rpc("admin_user_access_state");

  if (error) {
    // 42883 / PGRST202: the function is not in the database yet.
    const missing =
      error.code === "42883" ||
      error.code === "PGRST202" ||
      (error.message ?? "").toLowerCase().includes("does not exist");

    if (!missing) console.error("Error loading account access", error);
    return { ...EMPTY_MAP, error: missing ? null : error.message };
  }

  const byUser: Record<string, AccessRow> = {};
  ((data ?? []) as AccessRow[]).forEach((row) => {
    byUser[row.user_id] = row;
  });

  return { byUser, available: true, error: null };
};

/* ------------------------------------------------------------- Changing it */

export type AccessAction = "resend_invite" | "send_reset" | "invite_link" | "revoke" | "restore";

export interface AccessActionResult {
  /** What the server actually did. A resend on an active account becomes a reset. */
  action: AccessAction;
  note: string | null;
  /** Present for invite_link only. A credential — never log it, never store it. */
  actionLink: string | null;
}

export class AccessActionError extends Error {}

/**
 * Runs one access action against the edge function.
 *
 * Throws {@link AccessActionError} with a sentence that can be shown to an
 * admin as-is. Supabase's own wording never reaches a screen.
 */
export const runAccessAction = async (
  userId: string,
  action: AccessAction,
  accessToken: string | null | undefined,
): Promise<AccessActionResult> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    // A deploy without the env var; say so in the console, not on screen (VOICE.md R11).
    console.error("admin-user-access: VITE_SUPABASE_URL is not configured");
    throw new AccessActionError("We couldn't reach the account service. Try again in a minute.");
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/admin-user-access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ userId, action }),
    });
  } catch (networkError) {
    console.error("admin-user-access: network", networkError);
    throw new AccessActionError("We couldn't connect. Check your internet connection and try again.");
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = (payload as { error?: string } | null)?.error;
    console.error("admin-user-access: failed", response.status, detail);
    throw new AccessActionError(detail || "That didn't go through. Try again in a minute.");
  }

  return {
    action: ((payload as any)?.action ?? action) as AccessAction,
    note: ((payload as any)?.note ?? null) as string | null,
    actionLink: ((payload as any)?.actionLink ?? null) as string | null,
  };
};

/* --------------------------------------------------- What each action says */

export interface ActionCopy {
  label: string;
  icon: string;
  /** The notification title when it works. */
  done: string;
  /** The notification body. `{name}` is replaced with the person's name. */
  message: string;
  /** Confirmed before it runs, with this question. */
  confirm?: { title: string; body: string; commit: string };
}

export const ACTION_COPY: Record<AccessAction, ActionCopy> = {
  resend_invite: {
    label: "Send invitation again",
    icon: "send",
    done: "Invitation sent",
    message: "{name} can set a password from the email. The link works once.",
  },
  send_reset: {
    label: "Send password link",
    icon: "key-round",
    done: "Password link sent",
    message: "{name} can set a new password from the email. The link works once.",
  },
  invite_link: {
    label: "Copy sign in link",
    icon: "link",
    done: "Sign in link copied",
    message: "Send it to {name} yourself. Anyone holding this link can sign in as them.",
    confirm: {
      title: "Copy a sign in link?",
      body: "The link signs in as this person, works once, and expires. Send it on a private channel such as LINE, and never in a group chat.",
      commit: "Copy the link",
    },
  },
  revoke: {
    label: "Remove access",
    icon: "shield-off",
    done: "Access removed",
    message: "{name} can no longer sign in. Their record and reports are untouched.",
    confirm: {
      title: "Remove access for this person?",
      body: "They are signed out and can't sign in again until access is restored. Nothing is deleted, and you can undo this from the same menu.",
      commit: "Remove access",
    },
  },
  restore: {
    label: "Restore access",
    icon: "shield-check",
    done: "Access restored",
    message: "{name} can sign in again with their existing password.",
  },
};

/** The actions worth offering for a given state, in the order they matter. */
export const actionsFor = (state: AccessState): AccessAction[] => {
  switch (state) {
    case "none":
      return ["resend_invite", "invite_link"];
    case "invited":
    case "stale":
      return ["resend_invite", "invite_link", "revoke"];
    case "active":
      return ["send_reset", "revoke"];
    case "revoked":
      return ["restore"];
    default:
      return [];
  }
};

/* --------------------------------------------------------- The audit trail */

export interface AccessEvent {
  id: string;
  action: AccessAction | "invite";
  channel: "email" | "clipboard" | null;
  note: string | null;
  created_at: string;
  /** The admin who did it. Null when that account has since been removed. */
  actor_name: string | null;
}

/** Past tense, for a history line. Present tense belongs on the buttons. */
export const EVENT_LABEL: Record<string, string> = {
  invite: "Invitation sent",
  resend_invite: "Invitation sent again",
  send_reset: "Password link sent",
  invite_link: "Sign in link copied",
  revoke: "Access removed",
  restore: "Access restored",
};

/**
 * The last few access actions taken on one person.
 *
 * Returns an empty list when the table is not there yet — a detail page with no
 * history reads as "nothing has happened", which is also true before the
 * migration is applied.
 */
export const loadAccessEvents = async (userId: string, limit = 6): Promise<AccessEvent[]> => {
  const shape = (rows: any[]): AccessEvent[] =>
    rows.map((row) => ({
      id: row.id,
      action: row.action,
      channel: row.channel ?? null,
      note: row.note ?? null,
      created_at: row.created_at,
      actor_name: row.actor?.full_name ?? null,
    }));

  const withActor = await supabase
    .from("user_access_events")
    .select("id, action, channel, note, created_at, actor:actor_id (full_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!withActor.error) return shape((withActor.data ?? []) as any[]);

  // The embed needs a foreign key PostgREST can see. Without it the history is
  // still worth showing, just without a name against each line.
  const plain = await supabase
    .from("user_access_events")
    .select("id, action, channel, note, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (plain.error) return [];

  return shape((plain.data ?? []) as any[]);
};
