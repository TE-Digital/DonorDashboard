// src/design-system/fieldValidation.ts
//
// One vocabulary for "is this value usable?", shared by every form in the
// product.
//
// It started in the admin module for the school, teacher and student forms.
// Sixteen other forms were still answering a failed save with one sentence in a
// banner — on a twelve-field scholarship form, "fill in the required fields" is
// not an answer — so it moved here, where any module can reach it.
//
// Two things live here. The formats — an email, a Thai phone number — because
// the same address was being checked in one form and waved through in two
// others, and `type="email"` does nothing on a form whose submit calls
// preventDefault. And the shape of an answer: a map of field name to message,
// so a form can mark four empty fields at once instead of telling an admin
// about them one submit at a time.

import { getExampleNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";
import { countryName } from "./countries";

/** field name → what is wrong with it, in a sentence an admin can act on. */
export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

export const hasErrors = (errors: FieldErrors): boolean => Object.keys(errors).length > 0;

/**
 * "3 fields need attention" — the line above the form.
 *
 * The count, not the list: the messages are already on the fields, and
 * repeating them at the top is the same information twice.
 */
export const errorSummary = (errors: FieldErrors): string | null => {
  const count = Object.keys(errors).length;
  if (count === 0) return null;
  return count === 1
    ? "One field needs attention before this can be saved."
    : `${count} fields need attention before this can be saved.`;
};

/**
 * The first field with a problem, in the order the form asks for them.
 *
 * Focus goes here on a failed submit. Scrolling a message into view is not the
 * same thing: it leaves the keyboard where it was, and says nothing to a screen
 * reader.
 */
export const firstError = <K extends string>(errors: FieldErrors<K>, order: readonly K[]): K | null =>
  order.find((key) => errors[key]) ?? null;

/* ------------------------------------------------------------------ Email */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmail = (value: string): boolean => EMAIL.test(value.trim());

/* ------------------------------------------------------------------ Phone */

/**
 * A Thai number, typed the way people type them.
 *
 * Accepts 08x-xxx-xxxx and 02-xxx-xxxx with any spacing or dashes, and the
 * +66 international form. Deliberately not strict about the operator prefix:
 * this exists to catch "n/a" and a number three digits short, not to referee
 * which blocks the regulator has issued this year.
 */
const PHONE = /^(?:\+?66|0)\d{8,9}$/;

export const isPhone = (value: string): boolean => PHONE.test(value.replace(/[\s\-().]/g, ""));

/* --------------------------------------------------- International phone */

/**
 * Any country's number, for records where people aren't only in Thailand.
 *
 * Donors ring from the UK, Australia and Singapore; isPhone above would turn
 * every one of them away. These check against the donor's country when one is
 * recorded, and otherwise require the number to carry its own code, because a
 * bare "081 234 5678" means nothing without knowing where it's dialled.
 *
 * isPhone stays as it is: students and teachers are in Thailand.
 */
export type PhoneProblem = "needs-country-code" | "invalid" | null;

const asCountry = (country: string | null | undefined): CountryCode | undefined =>
  (country ?? undefined) as CountryCode | undefined;

export const phoneProblem = (value: string, country: string | null): PhoneProblem => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!country && !trimmed.startsWith("+")) return "needs-country-code";
  return parsePhoneNumberFromString(trimmed, asCountry(country))?.isValid() ? null : "invalid";
};

export const isInternationalPhone = (value: string, country: string | null): boolean =>
  value.trim() !== "" && phoneProblem(value, country) === null;

/** One stored form, E.164 ("+66812345678"), or null if the number isn't valid. */
export const normalisePhone = (value: string, country: string | null): string | null => {
  const parsed = parsePhoneNumberFromString(value.trim(), asCountry(country));
  return parsed?.isValid() ? parsed.number : null;
};

/**
 * How a stored number reads back in the field: the local form when it belongs
 * to the chosen country ("081 234 5678"), the international form otherwise.
 * Anything that doesn't parse is shown exactly as stored, so an admin fixing an
 * old number sees what is really there.
 */
export const displayPhone = (stored: string | null | undefined, country: string | null): string => {
  if (!stored) return "";
  const parsed = parsePhoneNumberFromString(stored, asCountry(country));
  if (!parsed?.isValid()) return stored;
  return country && parsed.country === country ? parsed.formatNational() : parsed.formatInternational();
};

/** The sentence under a phone field with this problem. */
export const phoneMessage = (problem: PhoneProblem, country: string | null): string | null => {
  if (problem === "needs-country-code") {
    return "Add the country code, for example +66 81 234 5678, or choose a country above.";
  }
  if (problem === "invalid") {
    if (!country) return "That doesn't look like a complete international number. Check the country code and the number.";
    const example = getExampleNumber(asCountry(country) as CountryCode, examples)?.formatNational();
    return example
      ? `That doesn't look like a complete phone number for ${countryName(country)}. Include the area code, for example ${example}.`
      : `That doesn't look like a complete phone number for ${countryName(country)}.`;
  }
  return null;
};

/* ------------------------------------------------------------------ Dates */

/** Nobody in this programme was born before this. A 1907 birthdate is a typo. */
export const EARLIEST_BIRTHDATE = new Date(1990, 0, 1);

export const today = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export type DateProblem = "unparseable" | "future" | "too-early" | null;

export const dateProblem = (
  value: string | null | undefined,
  options: { earliest?: Date | null } = {},
): DateProblem => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unparseable";

  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (day.getTime() > today().getTime()) return "future";
  if (options.earliest && day.getTime() < options.earliest.getTime()) return "too-early";

  return null;
};

/* ------------------------------------------------------------- Focusing it */

/**
 * The DOM id a form gives one of its fields.
 *
 * Focus crosses a component boundary here — the student fields are their own
 * component, rendered by two different forms — and a ref for every field in
 * three forms is a lot of plumbing for one moment. An id per field is enough,
 * and it is what the label's `for` needs anyway.
 */
export const fieldId = (form: string, field: string): string => `${form}-${field}`;

/** Puts the cursor in the first field with a problem, and scrolls it into view. */
export const focusField = (form: string, field: string | null): void => {
  if (!field) return;
  window.requestAnimationFrame(() => {
    const element = document.getElementById(fieldId(form, field));
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  });
};
