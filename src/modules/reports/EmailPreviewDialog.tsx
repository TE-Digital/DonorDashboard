// src/modules/reports/EmailPreviewDialog.tsx
//
// The last gate before a report reaches a person.
//
// With no donor dashboard, this email is the delivery. There is no screen a
// donor can visit to read a corrected version, no notification, no second
// attempt that supersedes the first. So the preview is not a nicety — it is the
// final place a human can see what is about to be sent, and it shows the real
// thing rather than a summary of it.
//
// Deliberate choices:
//
//   * The email renders in an iframe at 375px, at every breakpoint. A donor
//     opens this on a phone; a preview at desktop width would show a layout
//     nobody receives.
//   * Where two donors read different languages, both are previewed and the
//     recipient switcher names them.
//   * A report can always be sent (task 1.14). Addresses can be added at the
//     top, each with its own language, and a funding donor with no address on
//     record can be given one here, saved to the donor unless the tick is
//     cleared. A donor still left without one is skipped, not a reason to stop.
//   * The primary button says the person's name — "Send to Khun Somchai" — not
//     "Confirm". The name is the fact that matters at the moment of sending.

import React, { useEffect, useMemo, useState } from "react";
import { Checkbox, SegmentedControl, Select, Text, TextInput } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabaseClient";
import { Badge, Banner, Button, Dialog, IconButton } from "../../design-system/lumen";
import { isEmail } from "../../design-system/fieldValidation";
import { notifyDeliveriesChanged } from "./reportDeliveries";
import { hasLanguage, renderReportEmail, subjectFor, type ReportEmailData, type ReportFrame } from "./reportEmailTemplate";
import { templateHasLanguage, type EmailTemplate } from "../sponsorship/emailTemplates";
import { exclusionKey, loadReportTemplates, templateFor, type ExclusionReason } from "../sponsorship/reportRecipients";
import styles from "./EmailPreviewDialog.module.scss";

type Language = "en" | "th";

export interface PreviewRecipient {
  donor_id: string;
  name: string | null;
  email: string | null;
  language: Language;
  subject: string;
  html: string;
  /** The report has no text in the language this donor reads. */
  missingLanguage: boolean;
}

/** Someone the function actually emailed. An added address has no donor. */
export interface SentRecipient {
  donor_id: string | null;
  name: string | null;
  email: string | null;
}

export interface SendOutcome {
  sent: SentRecipient[];
  /** Funding donors left without an address, so not sent to. */
  skipped: SentRecipient[];
  /** Donors sent to at a typed address that couldn't be saved to their record. */
  unsaved: string[];
}

export interface EmailPreviewDialogProps {
  reportId: string;
  opened: boolean;
  onClose: () => void;
  onSent: (outcome: SendOutcome) => void;
}

interface ExtraRecipient {
  email: string;
  language: Language;
}

interface TypedAddress {
  email: string;
  save: boolean;
}

const LANGUAGE_NAME: Record<Language, string> = { en: "English", th: "Thai" };
const LANGUAGE_OPTIONS = [
  { value: "en", label: "EN" },
  { value: "th", label: "ไทย" },
];

/** A donor connected to the student who won't get this report, and why. */
interface ExcludedDonor {
  donor_id: string;
  name: string | null;
  reason: ExclusionReason;
}

/** What the admin chose for one donor at send. */
interface Choice {
  templateId: string | null;
  language: Language;
}

const frameOf = (template: EmailTemplate | null, language: Language): ReportFrame | null =>
  template ? { subject: template.subject[language], intro: template.intro[language], closing: template.closing[language] } : null;

export const EmailPreviewDialog: React.FC<EmailPreviewDialogProps> = ({
  reportId,
  opened,
  onClose,
  onSent,
}) => {
  const { t } = useTranslation();
  const [previews, setPreviews] = useState<PreviewRecipient[]>([]);
  const [versions, setVersions] = useState<Record<Language, boolean>>({ en: true, th: true });
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  const [extras, setExtras] = useState<ExtraRecipient[]>([]);
  const [draft, setDraft] = useState("");
  const [draftLanguage, setDraftLanguage] = useState<Language>("en");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [typed, setTyped] = useState<Record<string, TypedAddress>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Per donor: which template and language this send uses. The report data
  // comes with the preview so a change re-renders here, with the same renderer
  // the function sends with.
  const [reportData, setReportData] = useState<ReportEmailData | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [excluded, setExcluded] = useState<ExcludedDonor[]>([]);

  useEffect(() => {
    if (!opened) return;

    setLoading(true);
    setError(null);
    setPreviewFailed(false);
    setActive(0);
    setExtras([]);
    setDraft("");
    setDraftLanguage("en");
    setDraftError(null);
    setTyped({});
    setTouched({});
    setChoices({});
    setExcluded([]);
    setReportData(null);

    void (async () => {
      const [{ data, error: invokeError }, reportTemplates] = await Promise.all([
        supabase.functions.invoke("report-email", { body: { reportId, preview: true } }),
        loadReportTemplates(),
      ]);
      setTemplates(reportTemplates);

      if (invokeError) {
        // The function returns its reason in the body; the SDK surfaces only a
        // generic message, so the body is read explicitly. A vague failure here
        // sends somebody to the logs for something the screen already knows.
        const detail = await invokeError.context?.json?.().catch(() => null);
        setError(detail?.error ?? "We couldn't build the preview. Check your connection and try again.");
        setPreviewFailed(true);
        setLoading(false);
        return;
      }

      const loaded = (data?.previews ?? []) as PreviewRecipient[];
      setPreviews(loaded);
      setReportData((data?.data ?? null) as ReportEmailData | null);
      setExcluded((data?.excluded ?? []) as ExcludedDonor[]);
      // Each donor starts in their own language with the default template.
      setChoices(
        Object.fromEntries(
          loaded.map((p) => [p.donor_id, { language: p.language, templateId: templateFor(reportTemplates, p.language)?.id ?? null }]),
        ),
      );
      // An older function doesn't say which versions exist. Assume both, and
      // let the function's own check refuse a send in an empty language.
      setVersions({ en: data?.languages?.en ?? true, th: data?.languages?.th ?? true });
      setLoading(false);
    })();
  }, [opened, reportId]);

  /** One donor's email as this send will make it: chosen language and template. */
  const effective = (p: PreviewRecipient) => {
    const choice = choices[p.donor_id] ?? { language: p.language, templateId: null };
    const template = templates.find((tpl) => tpl.id === choice.templateId) ?? null;
    const frame = template && templateHasLanguage(template, choice.language) ? frameOf(template, choice.language) : null;
    return {
      language: choice.language,
      template,
      changed: choice.language !== p.language,
      subject: reportData ? subjectFor(reportData, choice.language, frame) : p.subject,
      html: reportData ? renderReportEmail(reportData, choice.language, p.name, frame) : p.html,
      missingLanguage: reportData ? !hasLanguage(reportData, choice.language) : p.missingLanguage,
      templateGap: Boolean(template && !templateHasLanguage(template, choice.language)),
    };
  };
  const setChoice = (donorId: string, patch: Partial<Choice>) =>
    setChoices((prev) => ({ ...prev, [donorId]: { ...(prev[donorId] ?? { language: "en", templateId: null }), ...patch } }));

  // Donors with no address on record, and what's been typed for each.
  const addressless = useMemo(() => previews.filter((p) => !p.email?.trim()), [previews]);
  const typedFor = (donorId: string) => typed[donorId] ?? { email: "", save: true };
  const typedProblem = (donorId: string): string | null => {
    const value = typedFor(donorId).email.trim();
    if (!value) return null;
    return isEmail(value) ? null : "That doesn't look like a complete email address.";
  };
  const given = addressless.filter((p) => typedFor(p.donor_id).email.trim() && !typedProblem(p.donor_id));
  const stillSkipped = addressless.filter((p) => !typedFor(p.donor_id).email.trim());
  const typedInvalid = addressless.some((p) => typedProblem(p.donor_id));

  const donorsWithAddress = previews.filter((p) => p.email?.trim());
  const reaching = [...donorsWithAddress, ...given];
  // Only someone this send will reach can block on a missing language.
  const blocked = reaching.filter((p) => effective(p).missingLanguage);
  const templateBlocked = reaching.filter((p) => effective(p).templateGap);
  const total = reaching.length + extras.length;
  const current = previews[active];

  const knownAddresses = new Set(
    [
      ...donorsWithAddress.map((p) => p.email ?? ""),
      ...given.map((p) => typedFor(p.donor_id).email),
      ...extras.map((e) => e.email),
    ].map((e) => e.trim().toLowerCase()),
  );

  const addExtra = () => {
    const email = draft.trim().toLowerCase();
    if (!email) {
      setDraftError("Type an email address first.");
      return;
    }
    if (!isEmail(email)) {
      setDraftError("That doesn't look like a complete email address.");
      return;
    }
    if (knownAddresses.has(email)) {
      setDraftError("That address is already getting this report.");
      return;
    }
    if (!versions[draftLanguage]) {
      setDraftError(
        `The ${LANGUAGE_NAME[draftLanguage]} version is empty. Write it first, or send this address the ${
          LANGUAGE_NAME[draftLanguage === "en" ? "th" : "en"]
        } one.`,
      );
      return;
    }
    setExtras((prev) => [...prev, { email, language: draftLanguage }]);
    setDraft("");
    setDraftError(null);
  };

  const send = async () => {
    if (sending || blocked.length > 0 || templateBlocked.length > 0 || typedInvalid || total === 0) return;

    setSending(true);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke("report-email", {
      body: {
        reportId,
        extraRecipients: extras,
        donorAddresses: given.map((p) => ({
          donorId: p.donor_id,
          email: typedFor(p.donor_id).email.trim(),
          saveToDonor: typedFor(p.donor_id).save,
        })),
        choices: previews.map((p) => ({
          donorId: p.donor_id,
          templateId: choices[p.donor_id]?.templateId ?? null,
          language: choices[p.donor_id]?.language ?? p.language,
        })),
      },
    });

    setSending(false);

    if (invokeError) {
      const detail = await invokeError.context?.json?.().catch(() => null);
      setError(detail?.error ?? "We couldn't send this report. Check your connection and try again.");
      return;
    }

    if ((data?.failed ?? []).length > 0) {
      setError(`Some messages didn't send: ${(data.failed as string[]).join(" · ")}`);
      return;
    }

    // The sidebar's Waiting to send count changes with every send.
    notifyDeliveriesChanged();
    // The function reports who it actually emailed. On a re-send that leaves
    // out anyone who already had it, so the page is told what happened rather
    // than what the preview listed.
    onSent({
      sent: (data?.sent ?? []) as SentRecipient[],
      skipped: stillSkipped.map((p) => ({ donor_id: p.donor_id, name: p.name, email: null })),
      unsaved: (data?.unsaved ?? []) as string[],
    });
    onClose();
  };

  const sendLabel = (() => {
    if (sending) return "Sending…";
    if (total === 0) return "Add someone to send to";
    if (total === 1 && reaching.length === 1) return `Send to ${reaching[0].name ?? "this donor"}`;
    if (total === 1) return `Send to ${extras[0].email}`;
    return `Send to ${total} people`;
  })();

  return (
    <Dialog
      open={opened}
      onClose={() => (sending ? undefined : onClose())}
      width={720}
      title="Send this report"
      description="This is the email exactly as it will arrive. There is no other copy a donor can read."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="send"
            onClick={send}
            disabled={sending || loading || blocked.length > 0 || templateBlocked.length > 0 || typedInvalid || total === 0}
          >
            {sendLabel}
          </Button>
        </>
      }
    >
      {loading ? (
        <Text size="sm" c="dimmed">
          Building the preview…
        </Text>
      ) : previewFailed ? (
        <Banner tone="danger" title="We couldn't build the preview">
          {error}
        </Banner>
      ) : (
        <>
          {error && (
            <Banner tone="danger" title="Nothing was sent">
              {error}
            </Banner>
          )}

          <section className={styles.add}>
            {/* Only the email box is labelled. The language switch and Add sit
                beside it, outside the label, so a click on them stays theirs. */}
            <div className={styles.addRow}>
              <TextInput
                className={styles.addInput}
                type="email"
                label="Add recipients"
                description="Anyone else who should get this report. Each address gets the language you pick."
                placeholder="name@example.com"
                value={draft}
                error={draftError}
                onChange={(event) => {
                  setDraft(event.currentTarget.value);
                  if (draftError) setDraftError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addExtra();
                  }
                }}
              />
              <div className={styles.addControls}>
                <SegmentedControl
                  aria-label="Language for this address"
                  data={LANGUAGE_OPTIONS}
                  value={draftLanguage}
                  onChange={(value) => {
                    setDraftLanguage(value as Language);
                    if (draftError) setDraftError(null);
                  }}
                />
                <Button variant="secondary" icon="plus" onClick={addExtra}>
                  Add address
                </Button>
              </div>
            </div>

            {extras.length > 0 && (
              <ul className={styles.extras} aria-label="Added addresses">
                {extras.map((extra) => (
                  <li key={extra.email} className={styles.extra}>
                    <span className={styles.extraEmail}>{extra.email}</span>
                    <Badge tone="neutral">{extra.language === "th" ? "ไทย" : "EN"}</Badge>
                    <IconButton
                      icon="x"
                      label={`Remove ${extra.email}`}
                      onClick={() => setExtras((prev) => prev.filter((e) => e.email !== extra.email))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {addressless.length > 0 && (
            <section className={styles.missing} aria-label="Donors with no email address">
              {addressless.map((p) => {
                const value = typedFor(p.donor_id);
                const problem = touched[p.donor_id] ? typedProblem(p.donor_id) : null;
                const name = p.name ?? "This donor";
                return (
                  <div key={p.donor_id} className={styles.missingRow}>
                    <TextInput
                      type="email"
                      label={`Email for ${name}`}
                      description="We don't have an email address for them. Add one here, or they won't get this report."
                      placeholder="name@example.com"
                      value={value.email}
                      error={problem}
                      onBlur={() => setTouched((prev) => ({ ...prev, [p.donor_id]: true }))}
                      onChange={(event) => {
                        const email = event.currentTarget.value;
                        setTyped((prev) => ({ ...prev, [p.donor_id]: { ...value, email } }));
                      }}
                    />
                    <Checkbox
                      checked={value.save}
                      label={`Save this address to ${name}'s donor page`}
                      onChange={(event) => {
                        const save = event.currentTarget.checked;
                        setTyped((prev) => ({ ...prev, [p.donor_id]: { ...value, save } }));
                      }}
                    />
                  </div>
                );
              })}
            </section>
          )}

          {blocked.length > 0 && (
            <Banner tone="warning" title="A version is missing">
              {blocked
                .map((p) => `${p.name ?? "A donor"} gets ${LANGUAGE_NAME[effective(p).language]}, and that version is empty.`)
                .join(" ")}{" "}
              Write it before sending. Nobody is sent the other language instead.
            </Banner>
          )}

          {templateBlocked.length > 0 && (
            <Banner tone="warning" title={t("sponsorship.recipients.templateGapTitle")}>
              {templateBlocked
                .map((p) =>
                  t("sponsorship.recipients.templateGap", {
                    name: p.name ?? t("donorCard.aDonor"),
                    template: effective(p).template?.name ?? "",
                    language: t(`donorCard.languageNames.${effective(p).language}`),
                  }),
                )
                .join(" ")}
            </Banner>
          )}

          {excluded.length > 0 && (
            <section aria-labelledby="report-not-sending">
              <h3 id="report-not-sending" style={{ margin: "0 0 var(--sp-1)", fontSize: "var(--fs-sm)", fontWeight: 600 }}>
                {t("sponsorship.recipients.notSending")}
              </h3>
              <ul style={{ margin: 0, paddingLeft: "var(--sp-4)", fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
                {excluded.map((row) => (
                  <li key={row.donor_id}>
                    <span style={{ color: "var(--text-heading)" }}>{row.name ?? t("donorCard.aDonor")}</span>
                    {": "}
                    {t(exclusionKey(row.reason))}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {previews.length === 0 && extras.length === 0 && (
            <Banner tone="warning" title="Nobody to send to yet">
              No donor who funds this student gets report emails. Add an address above to send it.
            </Banner>
          )}

          {previews.length > 1 && (
            <div className={styles.recipients} role="tablist" aria-label="Recipients">
              {previews.map((preview, index) => (
                <button
                  key={preview.donor_id}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  className={`${styles.recipient} ${index === active ? styles.recipientActive : ""}`}
                  onClick={() => setActive(index)}
                >
                  {preview.name ?? "A donor"}
                  <Badge tone="neutral">{effective(preview).language === "th" ? "ไทย" : "EN"}</Badge>
                </button>
              ))}
            </div>
          )}

          {current && (
            <>
              {/* This donor's template and language for this send. Defaults are
                  the donor's own language and the default template; a change is
                  marked so it's a decision, not an accident. */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-3)", alignItems: "flex-end" }}>
                {templates.length > 0 && (
                  <Select
                    label={t("sponsorship.recipients.template")}
                    allowDeselect={false}
                    style={{ minWidth: 220, flex: "1 1 220px" }}
                    data={templates.map((tpl) => ({
                      value: tpl.id,
                      label: templateHasLanguage(tpl, effective(current).language)
                        ? tpl.name
                        : t("sponsorship.welcome.templateNoLanguage", {
                            name: tpl.name,
                            language: t(`donorCard.languageNames.${effective(current).language}`),
                          }),
                    }))}
                    value={choices[current.donor_id]?.templateId ?? null}
                    onChange={(value) => value && setChoice(current.donor_id, { templateId: value })}
                  />
                )}
                <div>
                  <Text size="sm" fw={500} mb={4} id="report-language-label">
                    {t("sponsorship.recipients.language")}
                  </Text>
                  <SegmentedControl
                    aria-labelledby="report-language-label"
                    aria-describedby={effective(current).changed ? "report-language-changed" : undefined}
                    data={LANGUAGE_OPTIONS}
                    value={effective(current).language}
                    onChange={(value) => setChoice(current.donor_id, { language: value as Language })}
                  />
                </div>
                {effective(current).changed && (
                  <span id="report-language-changed">
                    <Badge tone="warning">
                      {t("sponsorship.recipients.changedFrom", {
                        language: t(`donorCard.languageNames.${current.language}`),
                      })}
                    </Badge>
                  </span>
                )}
              </div>

              <dl className={styles.meta}>
                <div>
                  <dt>To</dt>
                  <dd>
                    {current.name ?? "A donor"} ·{" "}
                    {current.email ?? (typedFor(current.donor_id).email.trim() || "no address yet")}
                  </dd>
                </div>
                <div>
                  <dt>Subject</dt>
                  <dd lang={effective(current).language}>{effective(current).subject}</dd>
                </div>
                <div>
                  <dt>Language</dt>
                  <dd>{effective(current).language === "th" ? "ไทย (Thai)" : "English"}</dd>
                </div>
              </dl>

              <div className={styles.phone}>
                <iframe
                  className={styles.frame}
                  // Rendered at phone width at every breakpoint, because that is
                  // where it will be read.
                  title={`Email preview for ${current.name ?? "this donor"}`}
                  srcDoc={effective(current).html}
                  sandbox=""
                />
              </div>
            </>
          )}
        </>
      )}
    </Dialog>
  );
};

export default EmailPreviewDialog;
