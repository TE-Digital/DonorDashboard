// src/i18n/index.ts
//
// The application in two languages.
//
// The people writing reports in this product work in rural Thai schools, and
// until now every label, button and error message they read was hardcoded
// English JSX across seventy-seven files. The software asking a teacher to
// describe a child's term was doing it in a language many of them read slowly.
//
// Three decisions worth knowing before adding a string:
//
// 1. **Keys are structural, not English.** `students.table.emptyTitle`, never
//    "No students found". Rewording the English copy must not silently orphan
//    the Thai, and it does exactly that when the English text is the key.
//
// 2. **Thai has no plural forms.** i18next's `_one` / `_other` suffixes exist
//    in `en` and are simply absent in `th`, where one string covers both. This
//    is why the plural handling is left to i18next rather than to `${n === 1 ?
//    "" : "s"}` scattered through the pages.
//
// 3. **The choice lives in localStorage, per browser.** Not on the profile: a
//    teacher who signs in on the school's shared computer should not change
//    the language for whoever used it before them. The cost is that a new
//    device starts in English, which is a trade we made deliberately.

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import th from "./locales/th.json";

export const SUPPORTED_LANGUAGES = [
  // Each written in its own script. "Thai" in English is a label about a
  // language; "ไทย" is the language saying its own name, and the person who
  // needs this control is the one who cannot read the first version.
  { code: "en", label: "English", short: "EN" },
  { code: "th", label: "ไทย", short: "ไทย" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const STORAGE_KEY = "icare.language";

export const isLanguageCode = (value: unknown): value is LanguageCode =>
  SUPPORTED_LANGUAGES.some((language) => language.code === value);

/**
 * The language this browser last chose.
 *
 * Wrapped in try/catch because localStorage throws outright in a Safari private
 * window rather than returning null, and a language preference is not worth
 * taking the whole application down for.
 */
export const storedLanguage = (): LanguageCode => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguageCode(saved)) return saved;
  } catch {
    // No storage available. English it is.
  }
  return "en";
};

export const rememberLanguage = (code: LanguageCode) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // The switch still works for this session; it just will not be remembered.
  }
};

/**
 * Screen readers announce Thai with English phonetics unless the document says
 * otherwise, so the lang attribute moves with the language. Set here rather
 * than in a component so it is correct on first paint, not after a render.
 */
export const applyDocumentLanguage = (code: LanguageCode) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = code;
  }
};

const initial = storedLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    th: { translation: th },
  },
  lng: initial,
  // A key missing from Thai shows the English rather than the raw key. A
  // half-translated screen is usable; `students.table.emptyTitle` on screen is
  // not, and translation catalogues are always half-finished at some point.
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

applyDocumentLanguage(initial);

export const changeLanguage = async (code: LanguageCode) => {
  await i18n.changeLanguage(code);
  rememberLanguage(code);
  applyDocumentLanguage(code);
};

export default i18n;
