// src/modules/sponsorship/WelcomeEmailDialog.tsx
//
// The welcome a new donor receives about their student, read before it sends.
//
// On the left, the few things the admin decides: which template, which
// language (the donor's own by default, and marked when changed), the words
// about the student for this one email, and an optional note. On the right, the
// email itself at phone width, rendered by the same function that sends it.
//
// It will not send what the donor cannot read: a missing language, an empty
// description, a donor with no address or with emails turned off, each says
// which and where to fix it. "Skip welcome" is for when the admin has already
// welcomed them in person.

import React, { useEffect, useMemo, useState } from "react";
import { Select, Textarea } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { FormDrawer, FormFeedback, InlineMessage, formatDate } from "../../design-system";
import { Badge, Button, Dialog, Icon, Tabs } from "../../design-system/lumen";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { useBranding } from "../theme/BrandingContext";
import { studentPhotoUrl } from "../admin/studentProfile";
import { isMissingColumnError } from "../admin/teacherProfile";
import { logEvent } from "../admin/studentEvents";
import { loadEmailTemplates, templateHasLanguage, type EmailTemplate } from "./emailTemplates";
import { renderWelcomeEmail, welcomeSubject, type WelcomeLanguage } from "./welcomeEmailTemplate";
import type { Sponsorship } from "./sponsorships";
import styles from "./WelcomeEmailDialog.module.scss";

export interface WelcomeEmailDialogProps {
  row: Sponsorship | null;
  onClose: () => void;
  onDone: () => void;
}

interface Card {
  name: Record<WelcomeLanguage, string>;
  description: Record<WelcomeLanguage, string>;
  photoPath: string | null;
  grade: string | null;
  school: Record<WelcomeLanguage, string | null>;
  consentApproved: boolean;
  published: boolean;
}

interface DonorInfo {
  name: string;
  email: string | null;
  language: WelcomeLanguage;
  wantsEmails: boolean;
}

const loadCard = async (studentId: string): Promise<Card | null> => {
  const base =
    "grade_level, consent_status, donor_profile_status, donor_display_name, donor_description, donor_photo_path, schools(name, name_th)";
  let read = await supabase.from("students").select(`${base}, donor_display_name_th, donor_description_th`).eq("id", studentId).maybeSingle();
  if (read.error && isMissingColumnError(read.error)) {
    read = (await supabase.from("students").select(base).eq("id", studentId).maybeSingle()) as typeof read;
  }
  const row = read.data as any;
  if (!row) return null;
  return {
    name: { en: row.donor_display_name ?? "", th: row.donor_display_name_th ?? "" },
    description: { en: row.donor_description ?? "", th: row.donor_description_th ?? "" },
    photoPath: row.donor_photo_path ?? null,
    grade: row.grade_level ?? null,
    school: { en: row.schools?.name ?? null, th: row.schools?.name_th || row.schools?.name || null },
    consentApproved: row.consent_status === "approved",
    published: row.donor_profile_status === "published",
  };
};

export const WelcomeEmailDialog: React.FC<WelcomeEmailDialogProps> = ({ row, onClose, onDone }) => {
  const { t } = useTranslation();
  const { session } = useAuth();
  const branding = useBranding();
  const narrow = useMediaQuery("(max-width: 640px)");

  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<Card | null>(null);
  const [donor, setDonor] = useState<DonorInfo | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [language, setLanguage] = useState<WelcomeLanguage>("en");
  const [descriptions, setDescriptions] = useState<Record<WelcomeLanguage, string>>({ en: "", th: "" });
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [pane, setPane] = useState<"write" | "preview">("write");

  useEffect(() => {
    if (!row) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNote("");
    setPane("write");

    Promise.all([
      loadCard(row.studentId),
      supabase.from("donors").select("name, contact, invited_email, preferred_language, wants_email_updates").eq("id", row.donorId).maybeSingle(),
      loadEmailTemplates("welcome"),
    ]).then(([cardRead, donorRead, templateRead]) => {
      if (cardled(cancelled)) return;
      const d = donorRead.data as any;
      const info: DonorInfo | null = d
        ? {
            name: d.name ?? t("donorCard.aDonor"),
            email: (d.contact?.email ?? d.invited_email ?? "").trim() || null,
            language: d.preferred_language === "th" ? "th" : "en",
            wantsEmails: d.wants_email_updates !== false,
          }
        : null;
      setCard(cardRead);
      setDonor(info);
      setTemplates(templateRead.data);
      setTemplateId((templateRead.data.find((tpl) => tpl.isDefault) ?? templateRead.data[0])?.id ?? null);
      setLanguage(info?.language ?? "en");
      setDescriptions(cardRead?.description ?? { en: "", th: "" });
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  const template = templates.find((tpl) => tpl.id === templateId) ?? null;
  const donorName = donor?.name ?? row?.donorName ?? t("donorCard.aDonor");
  const studentName = card?.name[language] || card?.name.en || card?.name.th || "";
  const languageName = (code: WelcomeLanguage) => t(`donorCard.languageNames.${code}`);

  // Everything that would stop the send, first found first said.
  const blocker = (() => {
    if (!row || !card || !donor) return null;
    // The server refuses a second welcome too; say so before anyone presses send.
    if (row.welcomeSentAt) return t("sponsorship.welcome.alreadySentBlock", { date: formatDate(row.welcomeSentAt) });
    if (!card.consentApproved || !card.published) return t("sponsorship.welcome.notReady", { student: studentName || t("sponsorship.today.aStudent") });
    if (!donor.wantsEmails) return t("sponsorship.welcome.optedOut", { donor: donorName });
    if (!donor.email) return t("sponsorship.welcome.noEmail", { donor: donorName });
    if (!template) return t("sponsorship.welcome.noTemplate");
    if (!templateHasLanguage(template, language)) return t("sponsorship.welcome.templateMissingLanguage", { language: languageName(language) });
    if (!card.name[language].trim() || !descriptions[language].trim()) {
      return t("sponsorship.welcome.missingLanguage", {
        donor: donorName,
        language: languageName(language),
        student: studentName || card.name.en || card.name.th,
      });
    }
    return null;
  })();

  const html = useMemo(() => {
    if (!card || !template) return "";
    return renderWelcomeEmail(
      {
        donorName,
        studentName: studentName || "",
        schoolName: card.school[language],
        gradeLevel: card.grade,
        photoUrl: studentPhotoUrl(card.photoPath),
        description: descriptions[language],
        note: note.trim() || null,
        organisationName: "iCare",
        contactEmail: branding?.donor_contact_email ?? null,
        primaryColor: branding?.primary_color ?? null,
        subject: template.subject[language],
        intro: template.intro[language],
        closing: template.closing[language],
      },
      language,
    );
  }, [card, template, language, descriptions, note, donorName, studentName, branding]);

  const subject = card && template
    ? welcomeSubject({
        donorName,
        studentName,
        schoolName: card.school[language],
        gradeLevel: card.grade,
        photoUrl: null,
        description: "",
        note: null,
        organisationName: "iCare",
        contactEmail: null,
        primaryColor: null,
        subject: template.subject[language],
        intro: "",
        closing: "",
      })
    : "";

  if (!row) return null;

  const send = async () => {
    if (blocker || !template) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          scholarshipId: row.id,
          templateId: template.id,
          language,
          description: descriptions[language],
          note: note.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError((payload as { error?: string } | null)?.error ?? t("sponsorship.welcome.failed"));
        return;
      }
      notifications.show({
        title: t("sponsorship.welcome.sentTitle"),
        message: t("sponsorship.welcome.sentMessage", { donor: donorName }),
        color: "green",
        icon: <Icon name="check" size={16} />,
        withBorder: true,
      });
      onDone();
      onClose();
    } catch (requestError) {
      console.error("Error sending welcome", requestError);
      setError(t("sponsorship.welcome.failed"));
    } finally {
      setSending(false);
    }
  };

  const skip = async () => {
    setSending(true);
    const { error: skipError } = await supabase
      .from("scholarships")
      .update({ welcome_skipped_at: new Date().toISOString() })
      .eq("id", row.id);
    setSending(false);
    setConfirmSkip(false);
    if (skipError) {
      setError(t("sponsorship.welcome.failed"));
      return;
    }
    await logEvent(row.studentId, "scholarship_changed", `Welcome email skipped for ${donorName}`, { scholarship_id: row.id });
    notifications.show({
      title: t("sponsorship.welcome.skippedTitle"),
      message: t("sponsorship.welcome.skippedMessage", { donor: donorName }),
      color: "green",
      icon: <Icon name="check" size={16} />,
      withBorder: true,
    });
    onDone();
    onClose();
  };

  const controls = (
    <div className={styles.controls}>
      <Select
        label={t("sponsorship.welcome.template")}
        allowDeselect={false}
        data={templates.map((tpl) => ({
          value: tpl.id,
          label: templateHasLanguage(tpl, language) ? tpl.name : t("sponsorship.welcome.templateNoLanguage", { name: tpl.name, language: languageName(language) }),
        }))}
        value={templateId}
        onChange={setTemplateId}
      />
      <div className={styles.languageRow}>
        <Select
          label={t("sponsorship.welcome.language")}
          allowDeselect={false}
          data={[
            { value: "en", label: "English" },
            { value: "th", label: "ไทย" },
          ]}
          value={language}
          onChange={(value) => value && setLanguage(value as WelcomeLanguage)}
          aria-describedby={donor && language !== donor.language ? "welcome-language-changed" : undefined}
        />
        {donor && language !== donor.language && (
          <span id="welcome-language-changed" className={styles.changed}>
            <Badge tone="warning">{t("sponsorship.welcome.changedFrom", { language: languageName(donor.language) })}</Badge>
          </span>
        )}
      </div>
      <Textarea
        label={t("sponsorship.welcome.description", { student: studentName || t("sponsorship.today.aStudent") })}
        lang={language}
        minRows={4}
        autosize
        maxLength={600}
        value={descriptions[language]}
        onChange={(event) => {
          const value = event.currentTarget.value;
          setDescriptions((prev) => ({ ...prev, [language]: value }));
        }}
      />
      <span className={styles.hint}>{t("sponsorship.welcome.descriptionNote")}</span>
      <Textarea
        label={t("sponsorship.welcome.note")}
        placeholder={t("sponsorship.welcome.notePlaceholder")}
        lang={language}
        minRows={2}
        autosize
        value={note}
        onChange={(event) => setNote(event.currentTarget.value)}
      />
    </div>
  );

  const preview = (
    <div className={styles.preview}>
      <dl className={styles.meta}>
        <dt>{t("sponsorship.welcome.to")}</dt>
        <dd>{donor?.email ? `${donorName} · ${donor.email}` : donorName}</dd>
        <dt>{t("sponsorship.welcome.subject")}</dt>
        <dd lang={language}>{subject || t("templates.preview.noSubject")}</dd>
      </dl>
      <iframe
        className={styles.frame}
        title={t("sponsorship.welcome.previewTitle", { donor: donorName })}
        srcDoc={html}
        sandbox=""
      />
    </div>
  );

  return (
    <>
      <FormDrawer
        opened
        onClose={onClose}
        busy={sending}
        size={1040}
        title={t("sponsorship.welcome.title", { donor: donorName })}
        subtitle={row.welcomeSentAt ? t("sponsorship.welcome.alreadySent", { date: formatDate(row.welcomeSentAt) }) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmSkip(true)} disabled={sending || loading}>
              {t("sponsorship.welcome.skip")}
            </Button>
            <Button variant="primary" icon="send" onClick={() => void send()} disabled={sending || loading || Boolean(blocker)}>
              {sending ? t("common.sending") : t("sponsorship.welcome.send", { donor: donorName })}
            </Button>
          </>
        }
      >
        {loading ? (
          <InlineMessage tone="info">{t("sponsorship.welcome.loading")}</InlineMessage>
        ) : (
          <>
            {blocker && <InlineMessage tone="warning">{blocker}</InlineMessage>}
            {error && <FormFeedback tone="error">{error}</FormFeedback>}
            {narrow ? (
              <>
                <Tabs
                  value={pane}
                  onChange={(value) => setPane(value as "write" | "preview")}
                  tabs={[
                    { value: "write", label: t("sponsorship.welcome.writeTab") },
                    { value: "preview", label: t("sponsorship.welcome.previewTab") },
                  ]}
                />
                {pane === "write" ? controls : preview}
              </>
            ) : (
              <div className={styles.layout}>
                {controls}
                {preview}
              </div>
            )}
          </>
        )}
      </FormDrawer>

      {confirmSkip && (
        <Dialog
          open
          onClose={() => setConfirmSkip(false)}
          title={t("sponsorship.welcome.skipTitle", { donor: donorName })}
          description={t("sponsorship.welcome.skipBody")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmSkip(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" onClick={() => void skip()} disabled={sending}>
                {t("sponsorship.welcome.skip")}
              </Button>
            </>
          }
        />
      )}
    </>
  );
};

/** Named so the effect's early return reads as what it is. */
const cardled = (cancelled: boolean) => cancelled;

export default WelcomeEmailDialog;
