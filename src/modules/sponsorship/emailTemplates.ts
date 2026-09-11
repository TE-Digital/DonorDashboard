// src/modules/sponsorship/emailTemplates.ts
//
// The organisation's own words around a donor email: a subject, an opening and
// a closing, in English and Thai.
//
// Templates frame; they never carry the student. The report or the welcome's
// student block is inserted between opening and closing by whoever renders the
// email, so no template can drop what a teacher wrote.

import { supabase } from "../../lib/supabaseClient";
import { isMissingRelation } from "../donor/donorMoney";
import type { TextLanguage } from "../../design-system/components/LanguageTabs";

export type TemplateKind = "welcome" | "report";

export interface EmailTemplate {
  id: string;
  kind: TemplateKind;
  name: string;
  description: string | null;
  subject: Record<TextLanguage, string>;
  intro: Record<TextLanguage, string>;
  closing: Record<TextLanguage, string>;
  isDefault: boolean;
  updatedAt: string | null;
  createdAt: string | null;
}

export type TemplateField = "subject" | "intro" | "closing";

/** The fields a template may use, filled at send time. Names are i18n keys under templates.placeholders. */
export const PLACEHOLDERS = [
  "donor_name",
  "student_name",
  "school_name",
  "grade_level",
  "report_period",
  "organisation",
] as const;

export type Placeholder = (typeof PLACEHOLDERS)[number];

const COLUMNS =
  "id, kind, name, description, subject_en, subject_th, intro_en, intro_th, closing_en, closing_th, is_default, created_at, updated_at";

const fromRow = (row: any): EmailTemplate => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  description: row.description ?? null,
  subject: { en: row.subject_en ?? "", th: row.subject_th ?? "" },
  intro: { en: row.intro_en ?? "", th: row.intro_th ?? "" },
  closing: { en: row.closing_en ?? "", th: row.closing_th ?? "" },
  isDefault: Boolean(row.is_default),
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
});

/** A language is usable only when all three of its parts are written. */
export const templateHasLanguage = (template: Pick<EmailTemplate, "subject" | "intro" | "closing">, language: TextLanguage) =>
  Boolean(template.subject[language].trim() && template.intro[language].trim() && template.closing[language].trim());

export interface TemplateRead {
  data: EmailTemplate[];
  available: boolean;
}

export const loadEmailTemplates = async (kind?: TemplateKind): Promise<TemplateRead> => {
  let query = supabase.from("email_templates").select(COLUMNS).is("deleted_at", null).order("name");
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) {
    if (!isMissingRelation(error)) console.error("Error loading email templates", error);
    return { data: [], available: !isMissingRelation(error) };
  }
  // Default first within each kind, then by name.
  const rows = (data ?? []).map(fromRow);
  rows.sort((a, b) => a.kind.localeCompare(b.kind) || Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
  return { data: rows, available: true };
};

export type TemplateFailure = "not_set_up" | "not_allowed" | "failed";

export interface TemplateSaveResult {
  ok: boolean;
  reason?: TemplateFailure;
  id?: string;
}

const failure = (error: { code?: string; message?: string }): TemplateSaveResult => {
  if (isMissingRelation(error)) return { ok: false, reason: "not_set_up" };
  if (error.code === "42501") return { ok: false, reason: "not_allowed" };
  console.error("Email template save failed", error);
  return { ok: false, reason: "failed" };
};

export interface TemplateInput {
  kind: TemplateKind;
  name: string;
  description: string;
  subject: Record<TextLanguage, string>;
  intro: Record<TextLanguage, string>;
  closing: Record<TextLanguage, string>;
}

const toRow = (input: TemplateInput) => ({
  kind: input.kind,
  name: input.name.trim(),
  description: input.description.trim() || null,
  subject_en: input.subject.en.trim() || null,
  subject_th: input.subject.th.trim() || null,
  intro_en: input.intro.en.trim() || null,
  intro_th: input.intro.th.trim() || null,
  closing_en: input.closing.en.trim() || null,
  closing_th: input.closing.th.trim() || null,
});

export const saveEmailTemplate = async (input: TemplateInput, id?: string): Promise<TemplateSaveResult> => {
  if (id) {
    const { error } = await supabase.from("email_templates").update(toRow(input)).eq("id", id);
    return error ? failure(error) : { ok: true, id };
  }
  const { data: session } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("email_templates")
    .insert({ ...toRow(input), created_by: session?.user?.id ?? null })
    .select("id")
    .single();
  return error ? failure(error) : { ok: true, id: (data as { id: string }).id };
};

/**
 * Makes one template the default for its kind. Two writes, in the order that
 * never leaves two defaults (the unique index would refuse): clear the old,
 * then set the new.
 */
export const makeDefaultTemplate = async (template: EmailTemplate): Promise<TemplateSaveResult> => {
  const clear = await supabase
    .from("email_templates")
    .update({ is_default: false })
    .eq("kind", template.kind)
    .eq("is_default", true)
    .is("deleted_at", null);
  if (clear.error) return failure(clear.error);
  const set = await supabase.from("email_templates").update({ is_default: true }).eq("id", template.id);
  return set.error ? failure(set.error) : { ok: true, id: template.id };
};

/** Soft delete. A kind's default cannot be deleted; the page never offers it. */
export const deleteEmailTemplate = async (template: EmailTemplate): Promise<TemplateSaveResult> => {
  if (template.isDefault) return { ok: false, reason: "failed" };
  const { error } = await supabase
    .from("email_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", template.id);
  return error ? failure(error) : { ok: true };
};

/** Fills {placeholders}. Unknown ones are left as written so a typo is visible, not silently blank. */
export const fillPlaceholders = (text: string, values: Partial<Record<Placeholder, string>>): string =>
  text.replace(/\{([a-z_]+)\}/g, (match, key: string) =>
    (PLACEHOLDERS as readonly string[]).includes(key) && values[key as Placeholder] != null
      ? (values[key as Placeholder] as string)
      : match,
  );

/** Placeholders written that the product does not know. Shown on the field so nobody sends "{studnet_name}". */
export const unknownPlaceholders = (text: string): string[] =>
  Array.from(text.matchAll(/\{([a-z_]+)\}/g))
    .map((m) => m[1])
    .filter((key) => !(PLACEHOLDERS as readonly string[]).includes(key));
