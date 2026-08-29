// src/i18n/LanguageSwitch.tsx
//
// The control that changes the language of everything.
//
// Two rules shape it, and both come from the same observation: the person who
// most needs this control is the one who cannot read the interface it sits in.
//
// 1. **Each option is written in its own script.** "ไทย", not "Thai". A Thai
//    teacher scanning an English toolbar finds ไทย instantly and would have to
//    decode "Thai" first.
//
// 2. **It is never an unlabelled globe.** A globe icon is a symbol you have to
//    already know, and the accessible name of a globe is a word in whichever
//    language the app is currently failing to speak to you in. So: visible
//    text, and an accessible name carrying both languages, always.

import React from "react";
import { useTranslation } from "react-i18next";
import {
  SUPPORTED_LANGUAGES,
  changeLanguage,
  isLanguageCode,
  type LanguageCode,
} from "./index";
import styles from "./LanguageSwitch.module.scss";

export interface LanguageSwitchProps {
  /** Full-width labelled rows, for inside the mobile menu. */
  stacked?: boolean;
}

export const LanguageSwitch: React.FC<LanguageSwitchProps> = ({ stacked }) => {
  const { i18n } = useTranslation();
  const current = isLanguageCode(i18n.language) ? i18n.language : "en";

  const pick = (code: LanguageCode) => {
    if (code === current) return;
    void changeLanguage(code);
  };

  return (
    <div
      className={`${styles.root} ${stacked ? styles.stacked : ""}`}
      role="group"
      // Named in both languages, so the group announces itself to a reader of
      // either. This is the one string in the product that is deliberately not
      // translated — it is bilingual by design.
      aria-label="Language / ภาษา"
    >
      {SUPPORTED_LANGUAGES.map((language) => {
        const active = language.code === current;
        return (
          <button
            key={language.code}
            type="button"
            className={`${styles.option} ${active ? styles.active : ""}`}
            aria-pressed={active}
            lang={language.code}
            onClick={() => pick(language.code)}
          >
            {stacked ? language.label : language.short}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSwitch;
