// src/design-system/components/LanguageTabs.tsx
//
// "Which language am I writing now", for any text a donor reads in English or
// Thai: the donor card, email templates, and anything after them.
//
// A tablist rather than two stacked pairs of fields. Side by side they compete
// for attention, and the only question on screen is which version is being
// written. The empty version says so in words, not only in amber, because that
// is the state somebody has to notice before anything is sent.

import React from "react";
import styles from "./LanguageTabs.module.scss";

export type TextLanguage = "en" | "th";

export interface LanguageTabsProps {
  value: TextLanguage;
  onChange: (value: TextLanguage) => void;
  /** Whether each language has been written. Drives the "missing" marker. */
  written: Record<TextLanguage, boolean>;
  /** Accessible name for the tablist, e.g. "Language of the card". */
  label: string;
  /** The marker under an unwritten language, e.g. "Not written yet". */
  missingLabel: string;
  /** Languages that cannot be chosen yet, e.g. before a migration. */
  disabled?: Partial<Record<TextLanguage, boolean>>;
  /** id prefix, so each tab can point at the panel it controls. */
  idPrefix: string;
}

const LANGUAGES: Array<{ code: TextLanguage; name: string }> = [
  // Each written in its own script: the person who needs "ไทย" may not read "Thai".
  { code: "en", name: "English" },
  { code: "th", name: "ไทย" },
];

export const LanguageTabs: React.FC<LanguageTabsProps> = ({
  value,
  onChange,
  written,
  label,
  missingLabel,
  disabled,
  idPrefix,
}) => {
  const refs = React.useRef<Record<TextLanguage, HTMLButtonElement | null>>({ en: null, th: null });

  // Arrow keys move between tabs, as a tablist promises a keyboard user.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const enabled = LANGUAGES.filter((l) => !disabled?.[l.code]);
    const index = enabled.findIndex((l) => l.code === value);
    const next = enabled[(index + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length];
    if (!next) return;
    event.preventDefault();
    onChange(next.code);
    refs.current[next.code]?.focus();
  };

  return (
    <div className={styles.tabs} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {LANGUAGES.map(({ code, name }) => {
        const selected = value === code;
        return (
          <button
            key={code}
            ref={(node) => {
              refs.current[code] = node;
            }}
            id={`${idPrefix}-tab-${code}`}
            type="button"
            role="tab"
            lang={code}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            disabled={disabled?.[code]}
            className={`${styles.tab} ${selected ? styles.active : ""}`}
            onClick={() => onChange(code)}
          >
            {name}
            {!written[code] && <span className={styles.missing}>{missingLabel}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageTabs;
