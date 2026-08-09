// src/lib/supabaseRelations.ts
//
// Helpers for a single, recurring supabase-js typing problem.
//
// When a `.select()` embeds a related table — `grant_types ( name )`,
// `student ( id, name, school ( name ) )` — supabase-js cannot tell a
// to-one relation from a to-many one without generated database types, so it
// widens EVERY embed to an array. At runtime a to-one embed comes back as a
// plain object (or null), which is why the raw result never assigns to the
// hand-written row interfaces in the pages.
//
// These helpers make the mismatch explicit and greppable instead of scattering
// `as unknown as Foo` through the pages. If generated types are ever added via
// `supabase gen types typescript`, every call site here becomes deletable.

/**
 * Normalises an embedded to-one relation to a single value.
 *
 * supabase-js types it as `T[]`; PostgREST returns `T | null`. Both shapes are
 * handled, so this is safe whichever way the inference lands.
 */
export function toOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Normalises an embedded to-many relation to an array.
 * A to-many embed with no rows can come back as null rather than [].
 */
export function toMany<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Asserts the shape of a `.select()` result whose embeds this module cannot
 * narrow structurally.
 *
 * This is a genuine assertion, not a check — the caller is promising that the
 * select list matches `T`. Keep the `select()` string and `T` next to each
 * other so a drift is visible in review.
 */
export function asRows<T>(data: unknown): T[] {
  return (data ?? []) as unknown as T[];
}

/** Single-row variant of `asRows`, for `.single()` / `.maybeSingle()`. */
export function asRow<T>(data: unknown): T {
  return data as unknown as T;
}
