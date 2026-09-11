// src/design-system/format.ts
//
// One place that turns raw values into the strings the UI shows.
//
// Pages must not call toLocaleDateString() / toLocaleString() directly: those
// follow the browser locale, so the same date renders as "3/12/2026" for one
// user and "12/03/2026" for another, and the two are indistinguishable.
// Everything here is locale-stable and translation-safe.
//
// Dates and empty values follow the interface language (docs/VOICE.md §7):
// Thai gets Thai month names and range words. The year stays Western for now.

import i18n, { type LanguageCode } from "../i18n";

/** Display currency for the organization. */
export const CURRENCY = "THB" as const;

/**
 * The currencies a record may be written in.
 *
 * Four money forms asked for this as free text: three characters typed by
 * hand, next to the amount they qualify. "thb", "Bhat" and an empty string all
 * used to be acceptable answers.
 */
export const CURRENCY_OPTIONS = [
  { value: "THB", label: "Thai baht (THB)" },
  { value: "USD", label: "US dollar (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "GBP", label: "Pound sterling (GBP)" },
  { value: "AUD", label: "Australian dollar (AUD)" },
  { value: "SGD", label: "Singapore dollar (SGD)" },
] as const;

/**
 * The options for one record, including whatever it is already stored as.
 *
 * A row written before this was a list can hold "Bhat" or "thb". A Select whose
 * value is not among its options renders blank, and blank is then written back
 * on the next save, so the record silently loses its currency because somebody
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
  return [...options, { value, label: `${value} (as recorded, not a known currency)` }];
};

const CURRENCY_SYMBOL = "฿";

type DateLike = string | number | Date | null | undefined;

/**
 * The language to format in. Read at call time rather than captured, so a page
 * re-rendered after the switch picks up the new language without passing it.
 */
const currentLanguage = (): LanguageCode =>
  (i18n.resolvedLanguage ?? i18n.language) === "th" ? "th" : "en";

const EMPTY_TEXT: Record<LanguageCode, string> = {
  en: "Not recorded",
  th: "ยังไม่ได้บันทึก",
};

/**
 * What a missing value says. Words, never a lone dash: a dash in a table cell
 * reads as "zero" to some people and "broken" to others (VOICE.md R6).
 */
export function emptyValue(lang: LanguageCode = currentLanguage()): string {
  return EMPTY_TEXT[lang];
}

function toDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTHS: Record<LanguageCode, readonly string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  th: [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ],
};

// Thai dates keep the Western year for now (VOICE.md §7). Buddhist Era years
// come in a later release; add them here, in one place, when they do.
const displayYear = (d: Date): number => d.getFullYear();

const dayMonth = (d: Date, lang: LanguageCode): string =>
  `${d.getDate()} ${MONTHS[lang][d.getMonth()]}`;

/**
 * `12 Mar 2026` / `12 มี.ค. 2569`. Unambiguous in every locale, unlike
 * 03/12/2026.
 */
export function formatDate(value: DateLike, lang: LanguageCode = currentLanguage()): string {
  const d = toDate(value);
  if (!d) return emptyValue(lang);
  return `${dayMonth(d, lang)} ${displayYear(d)}`;
}

/**
 * `12 Mar 2026, 14:05` / `12 มี.ค. 2569 14:05 น.` 24-hour, so no AM/PM to
 * translate.
 */
export function formatDateTime(value: DateLike, lang: LanguageCode = currentLanguage()): string {
  const d = toDate(value);
  if (!d) return emptyValue(lang);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return lang === "th"
    ? `${formatDate(d, lang)} ${hh}:${mm} น.`
    : `${formatDate(d, lang)}, ${hh}:${mm}`;
}

const RANGE_WORDS: Record<LanguageCode, { to: string; from: string; until: string }> = {
  en: { to: "to", from: "From", until: "Until" },
  th: { to: "ถึง", from: "ตั้งแต่", until: "ถึง" },
};

/**
 * `1 Jan to 30 Jun 2026`, `12 Mar 2026 to 11 Mar 2027`, `From 12 Mar 2026`.
 *
 * Joined with a word, never a dash (VOICE.md R3), so a screen reader says the
 * range the way a person would. Either end may be missing. The year is written
 * once when both ends share it.
 */
export function formatDateRange(
  from: DateLike,
  to: DateLike,
  lang: LanguageCode = currentLanguage(),
): string {
  const a = toDate(from);
  const b = toDate(to);
  const words = RANGE_WORDS[lang];
  if (!a && !b) return emptyValue(lang);
  if (!b) return `${words.from} ${formatDate(a, lang)}`;
  if (!a) return `${words.until} ${formatDate(b, lang)}`;
  const start =
    a.getFullYear() === b.getFullYear() ? dayMonth(a, lang) : formatDate(a, lang);
  return `${start} ${words.to} ${formatDate(b, lang)}`;
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

/** `4,200`. Grouped, never rounded. Use in tables. */
export function formatNumber(
  value: number | null | undefined,
  fractionDigits = 0
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return emptyValue();
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
  if (value === null || value === undefined || Number.isNaN(value)) return emptyValue();
  return `${CURRENCY_SYMBOL}${formatNumber(value, fractionDigits)}`;
}

/** `12.5%`. One decimal, per the spec. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return emptyValue();
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
