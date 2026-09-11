// src/modules/sponsorship/EmailTemplatesPage.tsx
//
// Settings → Email templates.
//
// Where the organisation writes how it greets and signs off to donors, in
// English and Thai, for the welcome email and for reports. The student part of
// each email is not here and cannot be: templates frame what the system
// inserts, so nobody editing a greeting can drop a teacher's words.
//
// A template missing one language can be saved, and is marked; it just cannot
// be chosen for a donor who reads that language. The default of each kind is
// the one preselected when sending, and cannot be deleted.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Menu, Textarea, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import {
  FormDrawer,
  FormFeedback,
  FormSection,
  InlineMessage,
  LoadingState,
  PageHeader,
  formatDate,
  useDocumentTitle,
} from "../../design-system";
import { LanguageTabs, type TextLanguage } from "../../design-system/components/LanguageTabs";
import { Badge, Button, Dialog, EmptyState, Icon, IconButton } from "../../design-system/lumen";
import {
  PLACEHOLDERS,
  deleteEmailTemplate,
  fillPlaceholders,
  loadEmailTemplates,
  makeDefaultTemplate,
  saveEmailTemplate,
  templateHasLanguage,
  unknownPlaceholders,
  type EmailTemplate,
  type Placeholder,
  type TemplateField,
  type TemplateInput,
  type TemplateKind,
} from "./emailTemplates";
import styles from "./EmailTemplatesPage.module.scss";

const KINDS: TemplateKind[] = ["welcome", "report"];

const blank = (kind: TemplateKind): TemplateInput => ({
  kind,
  name: "",
  description: "",
  subject: { en: "", th: "" },
  intro: { en: "", th: "" },
  closing: { en: "", th: "" },
});

const toInput = (template: EmailTemplate): TemplateInput => ({
  kind: template.kind,
  name: template.name,
  description: template.description ?? "",
  subject: { ...template.subject },
  intro: { ...template.intro },
  closing: { ...template.closing },
});

// ---------------------------------------------------------------- editor

interface EditorProps {
  opened: boolean;
  template: EmailTemplate | null;
  kind: TemplateKind;
  onClose: () => void;
  onSaved: () => void;
}

const TemplateEditor: React.FC<EditorProps> = ({ opened, template, kind, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [input, setInput] = useState<TemplateInput>(blank(kind));
  const [language, setLanguage] = useState<TextLanguage>("en");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Where "Insert field" puts its placeholder: the last field somebody was in.
  const lastField = useRef<{ field: TemplateField; element: HTMLInputElement | HTMLTextAreaElement } | null>(null);

  useEffect(() => {
    if (!opened) return;
    setInput(template ? toInput(template) : blank(kind));
    setLanguage("en");
    setError(null);
    setNameError(null);
    lastField.current = null;
  }, [opened, template, kind]);

  const original = useMemo(() => JSON.stringify(template ? toInput(template) : blank(kind)), [template, kind]);
  const dirty = JSON.stringify(input) !== original;

  const written: Record<TextLanguage, boolean> = {
    en: templateHasLanguage(input, "en"),
    th: templateHasLanguage(input, "th"),
  };

  const setPart = (field: TemplateField, value: string) =>
    setInput((prev) => ({ ...prev, [field]: { ...prev[field], [language]: value } }));

  const insert = (placeholder: Placeholder) => {
    const target = lastField.current ?? { field: "intro" as TemplateField, element: null as never };
    const token = `{${placeholder}}`;
    const current = input[target.field][language];
    const element = target.element as HTMLInputElement | HTMLTextAreaElement | null;
    const at = element?.selectionStart ?? current.length;
    const end = element?.selectionEnd ?? at;
    setPart(target.field, current.slice(0, at) + token + current.slice(end));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(at + token.length, at + token.length);
    });
  };

  const sample = {
    donor_name: language === "th" ? "สมชาย" : "Somchai",
    student_name: language === "th" ? "มะลิ" : "Mali",
    school_name: language === "th" ? "โรงเรียนบ้านห้วย" : "Ban Huai School",
    grade_level: "P5",
    report_period: language === "th" ? "ภาคเรียนที่ 1" : "semester",
    organisation: "iCare",
  };

  const unknown = [
    ...unknownPlaceholders(input.subject[language]),
    ...unknownPlaceholders(input.intro[language]),
    ...unknownPlaceholders(input.closing[language]),
  ];

  const save = async () => {
    if (!input.name.trim()) {
      setNameError(t("templates.editor.nameRequired"));
      document.getElementById("template-name")?.focus();
      return;
    }
    if (!written.en && !written.th) {
      setError(t("templates.editor.needOneLanguage"));
      return;
    }
    setNameError(null);
    setSaving(true);
    setError(null);
    const result = await saveEmailTemplate(input, template?.id);
    setSaving(false);
    if (!result.ok) {
      setError(t(`templates.errors.${result.reason ?? "failed"}`));
      return;
    }
    notifications.show({
      title: t("templates.savedTitle"),
      message: t("templates.savedMessage", { name: input.name.trim() }),
      color: "green",
      icon: <Icon name="check" size={16} />,
      withBorder: true,
    });
    onSaved();
    onClose();
  };

  const fieldProps = (field: TemplateField) => ({
    lang: language,
    value: input[field][language],
    onFocus: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      lastField.current = { field, element: event.currentTarget };
    },
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setPart(field, event.currentTarget.value),
  });

  const studentBlock = t(input.kind === "welcome" ? "templates.preview.welcomeBlock" : "templates.preview.reportBlock");

  return (
    <FormDrawer
      opened={opened}
      onClose={onClose}
      busy={saving}
      dirty={dirty}
      size={880}
      title={template ? t("templates.editor.editTitle", { name: template.name }) : t(`templates.editor.newTitle.${kind}`)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? t("common.saving") : template ? t("common.saveChanges") : t("templates.editor.create")}
          </Button>
        </>
      }
    >
      {error && <FormFeedback tone="error">{error}</FormFeedback>}

      <div className={styles.editor}>
        <div className={styles.form}>
          <FormSection title={t("templates.editor.about")}>
            <TextInput
              id="template-name"
              label={t("templates.editor.name")}
              value={input.name}
              error={nameError ?? undefined}
              onChange={(event) => setInput((prev) => ({ ...prev, name: event.currentTarget.value }))}
            />
            <TextInput
              label={t("templates.editor.description")}
              value={input.description}
              onChange={(event) => setInput((prev) => ({ ...prev, description: event.currentTarget.value }))}
            />
          </FormSection>

          <FormSection
            title={t("templates.editor.words")}
            actions={
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <span>
                    <Button variant="secondary" size="sm" icon="plus">
                      {t("templates.editor.insertField")}
                    </Button>
                  </span>
                </Menu.Target>
                <Menu.Dropdown>
                  {PLACEHOLDERS.map((placeholder) => (
                    <Menu.Item key={placeholder} onClick={() => insert(placeholder)}>
                      {t(`templates.placeholders.${placeholder}`)}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            }
          >
            <LanguageTabs
              idPrefix="template"
              value={language}
              onChange={setLanguage}
              written={written}
              label={t("templates.editor.languageLabel")}
              missingLabel={t("donorCard.notWritten")}
            />

            <div id="template-panel" role="tabpanel" aria-labelledby={`template-tab-${language}`} className={styles.parts}>
              <TextInput label={t("templates.editor.subject")} {...fieldProps("subject")} />
              <Textarea label={t("templates.editor.intro")} minRows={4} autosize {...fieldProps("intro")} />
              <div className={styles.fixedBlock} aria-hidden="true">
                {studentBlock}
              </div>
              <Textarea label={t("templates.editor.closing")} minRows={3} autosize {...fieldProps("closing")} />
              {unknown.length > 0 && (
                <InlineMessage tone="warning">
                  {t("templates.editor.unknownPlaceholders", { names: unknown.map((name) => `{${name}}`).join(", ") })}
                </InlineMessage>
              )}
            </div>
          </FormSection>
        </div>

        {/* The same words with a sample student, so the admin reads the letter rather than the fields. */}
        <aside className={styles.preview} aria-label={t("templates.preview.label")} lang={language}>
          <span className={styles.previewLabel}>{t("templates.preview.label")}</span>
          <p className={styles.previewSubject}>{fillPlaceholders(input.subject[language], sample) || t("templates.preview.noSubject")}</p>
          <div className={styles.previewBody}>
            <p>{fillPlaceholders(input.intro[language], sample)}</p>
            <p className={styles.previewBlock}>{studentBlock}</p>
            <p>{fillPlaceholders(input.closing[language], sample)}</p>
          </div>
        </aside>
      </div>
    </FormDrawer>
  );
};

// ---------------------------------------------------------------- page

export const EmailTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t("templates.title"));

  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editing, setEditing] = useState<{ template: EmailTemplate | null; kind: TemplateKind } | null>(null);
  const [deleting, setDeleting] = useState<EmailTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const read = await loadEmailTemplates();
    setTemplates(read.data);
    setAvailable(read.available);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const fail = (reason?: string) =>
    notifications.show({
      title: t("templates.errorTitle"),
      message: t(`templates.errors.${reason ?? "failed"}`),
      color: "red",
      icon: <Icon name="circle-alert" size={16} />,
      withBorder: true,
    });

  const makeDefault = async (template: EmailTemplate) => {
    setBusy(true);
    const result = await makeDefaultTemplate(template);
    setBusy(false);
    if (!result.ok) return fail(result.reason);
    await load();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    const result = await deleteEmailTemplate(deleting);
    setBusy(false);
    if (!result.ok) return fail(result.reason);
    notifications.show({
      title: t("templates.deletedTitle"),
      message: t("templates.deletedMessage", { name: deleting.name }),
      color: "green",
      icon: <Icon name="check" size={16} />,
      withBorder: true,
    });
    setDeleting(null);
    await load();
  };

  if (loading) return <LoadingState />;

  return (
    <div className={styles.page}>
      <PageHeader title={t("templates.title")} />

      {!available && <InlineMessage tone="warning">{t("templates.notSetUp")}</InlineMessage>}

      {KINDS.map((kind) => {
        const rows = templates.filter((template) => template.kind === kind);
        return (
          <section key={kind} className={styles.group} aria-labelledby={`templates-${kind}`}>
            <div className={styles.groupHead}>
              <h2 id={`templates-${kind}`} className={styles.groupTitle}>
                {t(`templates.kinds.${kind}`)}
              </h2>
              <Button
                variant="secondary"
                icon="plus"
                disabled={!available}
                onClick={() => setEditing({ template: null, kind })}
              >
                {t(`templates.new.${kind}`)}
              </Button>
            </div>

            {rows.length === 0 ? (
              <EmptyState icon="mail" title={t(`templates.empty.${kind}`)} />
            ) : (
              <ul className={styles.list}>
                {rows.map((template) => (
                  <li key={template.id} className={styles.row}>
                    <button type="button" className={styles.rowMain} onClick={() => setEditing({ template, kind })}>
                      <span className={styles.rowName}>
                        {template.name}
                        {template.isDefault && <Badge tone="info">{t("templates.default")}</Badge>}
                      </span>
                      {template.description && <span className={styles.rowDescription}>{template.description}</span>}
                      <span className={styles.rowMeta}>
                        {(["en", "th"] as TextLanguage[]).map((code) => (
                          <span key={code} lang={code}>
                            {templateHasLanguage(template, code)
                              ? t(`templates.languageReady.${code}`)
                              : t(`templates.languageMissing.${code}`)}
                          </span>
                        ))}
                        {template.updatedAt && (
                          <span>{t("templates.edited", { date: formatDate(template.updatedAt) })}</span>
                        )}
                      </span>
                    </button>
                    <span className={styles.rowActions}>
                      {!template.isDefault && (
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void makeDefault(template)}>
                          {t("templates.makeDefault")}
                        </Button>
                      )}
                      {!template.isDefault && (
                        <IconButton
                          icon="trash-2"
                          label={t("templates.delete", { name: template.name })}
                          onClick={() => setDeleting(template)}
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <TemplateEditor
        opened={Boolean(editing)}
        template={editing?.template ?? null}
        kind={editing?.kind ?? "welcome"}
        onClose={() => setEditing(null)}
        onSaved={() => void load()}
      />

      {deleting && (
        <Dialog
          open
          onClose={busy ? undefined : () => setDeleting(null)}
          title={t("templates.deleteTitle", { name: deleting.name })}
          description={t("templates.deleteBody")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)} disabled={busy}>
                {t("common.cancel")}
              </Button>
              <Button variant="danger" onClick={() => void confirmDelete()} disabled={busy}>
                {t("templates.deleteConfirm")}
              </Button>
            </>
          }
        />
      )}
    </div>
  );
};

export default EmailTemplatesPage;
