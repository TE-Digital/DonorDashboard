// src/design-system/countries.ts
//
// Countries, for a record that needs to know where somebody is.
//
// There is no hand-kept list here. The phone library already knows every
// country it can validate and each one's dialling code, and the browser names
// them. A list checked into the repo would be one more thing to go stale, and
// it would disagree with the phone check the day somebody forgot to update it.

import {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  type CountryCode,
} from "libphonenumber-js";

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

/** "United Kingdom" for "GB". Falls back to the code where the browser can't name it. */
export const countryName = (code: string): string => {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
};

/** "+44" for "GB", or null for a code the phone check doesn't know. */
export const callingCode = (code: string | null | undefined): string | null =>
  code && isSupportedCountry(code) ? `+${getCountryCallingCode(code as CountryCode)}` : null;

export interface CountryOption {
  value: string;
  label: string;
}

let options: CountryOption[] | null = null;

/**
 * Every country, as "Thailand · +66", with Thailand first.
 *
 * Thailand first because nearly every donor record starts there; the rest are
 * alphabetical by name. The dialling code is in the label so typing "+44" in
 * the search finds the United Kingdom.
 */
export const countryOptions = (): CountryOption[] => {
  if (options) return options;
  const all = getCountries()
    .map((code) => ({ value: code, label: `${countryName(code)} · ${callingCode(code)}` }))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
  const thailand = all.find((option) => option.value === "TH");
  options = thailand ? [thailand, ...all.filter((option) => option !== thailand)] : all;
  return options;
};
