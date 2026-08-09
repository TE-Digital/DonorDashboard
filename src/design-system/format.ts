// src/design-system/format.ts
//
// One place that turns raw values into the strings the UI shows.
//
// Pages must not call toLocaleDateString() / toLocaleString() directly: those
// follow the browser locale, so the same date renders as "3/12/2026" for one
// user and "12/03/2026" for another, and the two are indistinguishable.
// Everything here is locale-stable and translation-safe.

/** Display currency for the organization. */
export const CURRENCY = "THB" as const;
const CURRENCY_SYMBOL = "฿";

type DateLike = string | number | Date | null | undefined;

/** Empty-value placeholder, matching the neutral badge fallback in semantic.ts. */
export const EMPTY = "—";

function toDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * `12 Mar 2026` — unambiguous in every locale, unlike 03/12/2026.
 * Month names are the one translatable piece; they stay here so a future i18n
 * pass has a single list to swap.
 */
export function formatDate(value: DateLike): string {
  const d = toDate(value);
  if (!d) return EMPTY;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** `12 Mar 2026, 14:05` — 24-hour, so no AM/PM to translate. */
export function formatDateTime(value: DateLike): string {
  const d = toDate(value);
  if (!d) return EMPTY;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)}, ${hh}:${mm}`;
}

/** `12 Mar 2026 – 11 Mar 2027`. Either end may be missing. */
export function formatDateRange(from: DateLike, to: DateLike): string {
  const a = toDate(from);
  const b = toDate(to);
  if (!a && !b) return EMPTY;
  if (!b) return `${formatDate(a)} –`;
  if (!a) return `– ${formatDate(b)}`;
  return `${formatDate(a)} – ${formatDate(b)}`;
}

/** `yyyy-mm-dd`, for date inputs and Supabase date columns. Never for display. */
export function toDateInputValue(value: DateLike): string {
  const d = toDate(value);
  if (!d) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** `4,200` — grouped, never rounded. Use in tables. */
export function formatNumber(
  value: number | null | undefined,
  fractionDigits = 0
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** `฿4,200`. Amounts are whole baht unless a page has a reason otherwise. */
export function formatCurrency(
  value: number | null | undefined,
  fractionDigits = 0
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return `${CURRENCY_SYMBOL}${formatNumber(value, fractionDigits)}`;
}

/** `12.5%` — one decimal, per the spec. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return `${formatNumber(value, 1)}%`;
}

/**
 * Count label for a page title: "Students · 84".
 * Avoids the singular/plural switch, which does not exist in Thai.
 */
export function formatCount(label: string, count: number | null | undefined): string {
  if (count === null || count === undefined) return label;
  return `${label} · ${formatNumber(count)}`;
}
