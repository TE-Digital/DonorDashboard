// src/modules/admin/donorRecord.ts
//
// One definition of a donor record: its fields, what makes them valid, and how
// they are written.
//
// The add-donor page and the edit page each carried their own copy of the same
// fields, with their own idea of what was required. This file owns the record;
// DonorForm owns the fields on screen.
//
// Three columns (donor_type, contact_person, country) arrive with
// 20260911100000_donor_records.sql. Until that runs, the base fields are still
// saved and the form says what it had to leave out, the same way the teacher
// form handles its own pending columns.

import { supabase } from "../../lib/supabaseClient";
import {
  displayPhone,
  isEmail,
  normalisePhone,
  phoneMessage,
  phoneProblem,
  type FieldErrors,
} from "../../design-system";
import { writeFailureMessage } from "./entityForm";
import { isMissingColumnError } from "./teacherProfile";

export type DonorType = "individual" | "organisation";
export type DonorLanguage = "en" | "th";

/** The form's shape: every value as the inputs hold it. */
export interface DonorDetailsInput {
  donorType: DonorType;
  name: string;
  /** Organisations only. Reports are addressed to this person. */
  contactPerson: string;
  agentId: string | null;
  email: string;
  /** ISO 3166-1 alpha-2, or null when nobody has recorded it. */
  country: string | null;
  phone: string;
  otherContact: string;
  address: string;
  preferredLanguage: DonorLanguage;
  /** Shown as "Send report emails". The column predates the label. */
  wantsEmailUpdates: boolean;
  wantsNewsletter: boolean;
  isDashboardEnabled: boolean;
  noteInternal: string;
}

// The defaults the old add-donor page used, so a donor created here is the same
// record a donor created there would have been.
export const EMPTY_DONOR_DETAILS: DonorDetailsInput = {
  donorType: "individual",
  name: "",
  contactPerson: "",
  agentId: null,
  email: "",
  country: null,
  phone: "",
  otherContact: "",
  address: "",
  preferredLanguage: "en",
  wantsEmailUpdates: true,
  wantsNewsletter: false,
  isDashboardEnabled: true,
  noteInternal: "",
};

export type DonorField = "name" | "contactPerson" | "email" | "phone";

/** The order the form asks, so focus lands on the first problem a person would meet. */
export const DONOR_FIELD_ORDER: readonly DonorField[] = ["name", "contactPerson", "email", "phone"];

/**
 * Plain words for the admin; the file that fixes it is named in the console,
 * for whoever applies it (docs/VOICE.md bans system speak in the UI).
 */
export const DONOR_FIELDS_PENDING_NOTE =
  "Donor type, contact person and country can't be saved yet. Ask whoever looks after the system to set this up, then open this donor and save again.";

const EXTENDED_COLUMNS = "donor_type, contact_person, country";

/**
 * Whether the donor-records columns exist yet.
 *
 * Asked before the form decides what to show: asking for a country and then
 * silently dropping it on save is worse than not asking.
 */
export const donorColumnsAvailable = async (): Promise<boolean> => {
  const { error } = await supabase.from("donors").select(EXTENDED_COLUMNS).limit(1);
  if (!error) return true;
  if (isMissingColumnError(error)) {
    console.warn(
      "donors is missing donor_type, contact_person and country. Apply supabase/migrations/20260911100000_donor_records.sql.",
    );
    return false;
  }
  // An unrelated failure (offline, a policy) must not strip fields from the
  // form; assume they exist and let the save report the real problem.
  console.error("Error probing donor columns", error);
  return true;
};

/**
 * The country a phone number is checked against.
 *
 * Without the country column the old rule applies: numbers are Thai. That is
 * what the old form accepted, so nobody loses a number they could enter before.
 */
export const phoneCountryFor = (values: DonorDetailsInput, extended: boolean): string | null =>
  extended ? values.country : "TH";

/**
 * Everything wrong with these values, by field.
 *
 * Email is required only for a new donor (decided 2026-09-11). An existing
 * donor saved without one can still be saved; the edit form warns instead.
 */
export const validateDonorDetails = (
  values: DonorDetailsInput,
  options: { extended: boolean; isNew: boolean },
): FieldErrors<DonorField> => {
  const errors: FieldErrors<DonorField> = {};
  const isOrganisation = options.extended && values.donorType === "organisation";

  if (!values.name.trim()) {
    errors.name = isOrganisation ? "Enter the organisation's name." : "Enter the donor's name.";
  }

  if (isOrganisation && !values.contactPerson.trim()) {
    errors.contactPerson = "Name the person reports go to.";
  }

  const email = values.email.trim();
  if (!email) {
    if (options.isNew) errors.email = "Enter an email address. This is where their reports are sent.";
  } else if (!isEmail(email)) {
    errors.email = "That does not look like a complete email address, for example name@example.com.";
  }

  const country = phoneCountryFor(values, options.extended);
  const problem = phoneProblem(values.phone, country);
  if (problem) errors.phone = phoneMessage(problem, country) ?? undefined;

  return errors;
};

/* ------------------------------------------------------------- Duplicates */

export interface DuplicateDonor {
  id: string;
  name: string | null;
}

/** LIKE treats _ and % as wildcards; an email containing either must match only itself. */
const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/**
 * Another donor already on this address, ignoring case and surrounding spaces.
 *
 * Two records on one address means one person receives the same report twice.
 * A failed lookup returns null: this is a guard against a mistake, and it must
 * not be the thing that stops an admin saving a real donor.
 */
export const findDonorByEmail = async (
  email: string,
  excludeId: string | null = null,
): Promise<DuplicateDonor | null> => {
  const trimmed = email.trim();
  if (!trimmed || !isEmail(trimmed)) return null;

  let query = supabase
    .from("donors")
    .select("id, name")
    .ilike("contact->>email", escapeLike(trimmed))
    .limit(1);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) {
    console.error("Error checking for a donor with this email", error);
    return null;
  }
  return (data?.[0] as DuplicateDonor | undefined) ?? null;
};

export const duplicateMessage = (donor: DuplicateDonor): string =>
  donor.name?.trim()
    ? `Another donor already uses this email: ${donor.name.trim()}.`
    : "Another donor already uses this email.";

/* ------------------------------------------------------------------ Writes */

const basePayload = (values: DonorDetailsInput, phoneCountry: string | null) => {
  const phone = values.phone.trim();
  return {
    name: values.name.trim() || null,
    contact: {
      email: values.email.trim().toLowerCase() || null,
      // Validation has already passed, so a typed number normalises. The raw
      // text is kept as a fallback rather than silently dropping a number.
      phone: phone ? normalisePhone(phone, phoneCountry) ?? phone : null,
      other_contact: values.otherContact.trim() || null,
      address: values.address.trim() || null,
      agent_id: values.agentId || null,
    },
    is_dashboard_enabled: values.isDashboardEnabled,
    wants_email_updates: values.wantsEmailUpdates,
    wants_newsletter: values.wantsNewsletter,
    preferred_language: values.preferredLanguage,
    note_internal: values.noteInternal.trim() || null,
  };
};

const extendedPayload = (values: DonorDetailsInput) => ({
  donor_type: values.donorType,
  contact_person:
    values.donorType === "organisation" ? values.contactPerson.trim() || null : null,
  country: values.country,
});

/** A stored donor row, as far as the form needs it. */
export interface DonorRow {
  name: string | null;
  contact: {
    email?: string | null;
    phone?: string | null;
    other_contact?: string | null;
    address?: string | null;
    agent_id?: string | null;
  } | null;
  preferred_language: string | null;
  wants_email_updates: boolean | null;
  wants_newsletter: boolean | null;
  is_dashboard_enabled: boolean | null;
  note_internal: string | null;
  donor_type?: string | null;
  contact_person?: string | null;
  country?: string | null;
}

/**
 * A stored donor as the form's values.
 *
 * The phone is shown the way it's dialled locally when it belongs to the
 * donor's country ("081 234 5678"), and exactly as stored when it doesn't
 * parse, so an admin fixing an old number sees what is really there.
 */
export const toDonorDetails = (row: DonorRow, extended: boolean): DonorDetailsInput => {
  const country = extended ? row.country ?? null : null;
  return {
    donorType: row.donor_type === "organisation" ? "organisation" : "individual",
    name: row.name ?? "",
    contactPerson: row.contact_person ?? "",
    agentId: row.contact?.agent_id ?? null,
    email: row.contact?.email ?? "",
    country,
    phone: displayPhone(row.contact?.phone ?? null, extended ? country : "TH"),
    otherContact: row.contact?.other_contact ?? "",
    address: row.contact?.address ?? "",
    preferredLanguage: row.preferred_language === "th" ? "th" : "en",
    wantsEmailUpdates: row.wants_email_updates ?? true,
    wantsNewsletter: row.wants_newsletter ?? false,
    isDashboardEnabled: row.is_dashboard_enabled ?? true,
    noteInternal: row.note_internal ?? "",
  };
};

export interface SaveDonorResult {
  id: string | null;
  /** False when donor type, contact person and country had to be left out. */
  extended: boolean;
  error: string | null;
}

/**
 * Creates a donor. The full record is tried first; if the new columns are not
 * in the database yet, the base fields are saved and the caller is told, so it
 * can say what was left out rather than claim a complete save.
 */
export const createDonor = async (
  values: DonorDetailsInput,
  extended: boolean,
): Promise<SaveDonorResult> => {
  const phoneCountry = phoneCountryFor(values, extended);
  const base = basePayload(values, phoneCountry);

  if (extended) {
    const { data, error } = await supabase
      .from("donors")
      .insert({ ...base, ...extendedPayload(values) })
      .select("id")
      .single();

    if (!error && data?.id) return { id: data.id as string, extended: true, error: null };
    if (!isMissingColumnError(error)) {
      console.error("Error creating donor", error);
      return { id: null, extended: true, error: writeFailureMessage(error, "donor") };
    }
  }

  const { data, error } = await supabase.from("donors").insert(base).select("id").single();
  if (error || !data?.id) {
    console.error("Error creating donor", error);
    return { id: null, extended: false, error: writeFailureMessage(error, "donor") };
  }
  return { id: data.id as string, extended: false, error: null };
};

const UPDATE_REFUSED = "Your account isn't allowed to change this donor. Ask an administrator.";

/**
 * Saves changes to a donor, with the same fallback as createDonor.
 *
 * The row is asked for back. A policy that refuses an update doesn't raise an
 * error; it just matches no rows, and the old edit page reported that as a
 * successful save. Zero rows back is treated as the refusal it is.
 */
export const updateDonor = async (
  id: string,
  values: DonorDetailsInput,
  extended: boolean,
): Promise<SaveDonorResult> => {
  const phoneCountry = phoneCountryFor(values, extended);
  const base = basePayload(values, phoneCountry);
  const failed = (error: { code?: string; message?: string } | null, keptExtended: boolean): SaveDonorResult => {
    console.error("Error updating donor", error);
    const denied = error?.code === "42501" || (error?.message ?? "").toLowerCase().includes("row-level security");
    return {
      id: null,
      extended: keptExtended,
      error: denied ? UPDATE_REFUSED : "We couldn't save these changes. Check your connection and try again.",
    };
  };

  if (extended) {
    const { data, error } = await supabase
      .from("donors")
      .update({ ...base, ...extendedPayload(values) })
      .eq("id", id)
      .select("id");
    if (!error) return data?.length ? { id, extended: true, error: null } : { id: null, extended: true, error: UPDATE_REFUSED };
    if (!isMissingColumnError(error)) return failed(error, true);
  }

  const { data, error } = await supabase.from("donors").update(base).eq("id", id).select("id");
  if (error) return failed(error, false);
  if (!data?.length) return { id: null, extended: false, error: UPDATE_REFUSED };
  return { id, extended: false, error: null };
};
