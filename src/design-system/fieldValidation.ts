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
