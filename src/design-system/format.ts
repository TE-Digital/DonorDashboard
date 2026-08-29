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

/**
 * The currencies a record may be written in.
 *
 * Four money forms asked for this as free text — three characters typed by
 * hand, next to the amount they qualify. "thb", "Bhat" and an empty string all
 * used to be acceptable answers.
 */
export const CURRENCY_OPTIONS = [
  { value: "THB", label: "THB — Thai baht" },
  { value: "USD", label: "USD — US dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — Pound sterling" },
  { value: "AUD", label: "AUD — Australian dollar" },
  { value: "SGD", label: "SGD — Singapore dollar" },
] as const;

/**
 * The options for one record, including whatever it is already stored as.
 *
 * A row written before this was a list can hold "Bhat" or "thb". A Select whose
 * value is not among its options renders blank, and blank is then written back
 * on the next save — the record silently loses its currency because somebody
 * opened it. The stored value is carried as its own option instead, marked, so
 * an admin can see it and choose the real one.
 */
export const currencyOptionsFor = (
  stored: string | null | undefined,
): Array<{ value: string; label: string }> => {
  const options = CURRENCY_OPTIONS.map((option) => ({ ...option }));
  const value = (stored ?? "").trim();
  if (!value) return options;
  if (options.some((option) => option.value === value)) return options;
  return [...options, { value, label: `${value} — as recorded, not a known currency` }];
};

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

/**
 * A stored `yyyy-mm-dd` as a Date, for a `DateInput` to hold.
 *
 * Parsed as local midnight rather than through `new Date("2026-08-28")`, which
 * ISO-parses to UTC and lands on the previous day for anyone west of Greenwich.
 * A birthdate that shifts by a day depending on who opens the record is the kind
 * of bug nobody reports and everybody distrusts.
 */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match) {
    const [, year, month, day] = match;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return toDate(value);
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
