// src/i18n/errors.ts
//
// Turns whatever went wrong into a sentence a person can act on.
//
// Supabase, PostgREST and fetch all fail with messages written for developers:
// policy names, column names, "Failed to fetch". Shown on screen, they teach
// people that error messages are noise. So the raw error is logged for whoever
// debugs it, and the screen gets what happened plus what to try (VOICE.md R11).

import i18n from "./index";

export type FriendlyErrorKey =
  | "errors.generic"
  | "errors.save"
  | "errors.load"
  | "errors.create"
  | "errors.delete"
  | "errors.send"
  | "errors.network"
  | "errors.permission";

type ErrorLike = { code?: unknown; message?: unknown; status?: unknown };

const messageOf = (err: unknown): string => {
  if (typeof err === "string") return err;
  const message = (err as ErrorLike | null)?.message;
  return typeof message === "string" ? message : "";
};

// 42501 is Postgres "insufficient privilege"; RLS refusals arrive either with
// that code or only as a message, depending on which client path raised them.
const isDenied = (err: unknown): boolean => {
  const code = (err as ErrorLike | null)?.code;
  const status = (err as ErrorLike | null)?.status;
  const message = messageOf(err).toLowerCase();
  return (
    code === "42501" ||
    status === 401 ||
    status === 403 ||
    message.includes("row-level security") ||
    message.includes("permission denied")
  );
};

const isNetwork = (err: unknown): boolean => {
  const message = messageOf(err).toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("load failed")
  );
};

/**
 * Logs `err` and returns a message for the screen, in the current language.
 *
 * `key` is the fallback that fits the action ("errors.save" after a save).
 * Refusals and dropped connections get their own message whatever the action,
 * because the fix is different: ask an admin, or check the connection.
 */
export function toFriendlyError(
  err: unknown,
  key: FriendlyErrorKey = "errors.generic",
  context?: string,
): string {
  console.error(context ?? key, err);
  if (isDenied(err)) return i18n.t("errors.permission");
  if (isNetwork(err)) return i18n.t("errors.network");
  return i18n.t(key);
}
