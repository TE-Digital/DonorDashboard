// src/modules/admin/DonorProfileTab.tsx
//
// What a donor is told about this student, and whether it may be told yet.
//
// Two independent gates, shown side by side because they fail for different
// reasons and are fixed by different people. **Consent** is the family's
// decision, recorded by whoever spoke to them. **Profile status** is the
// organisation's own readiness — somebody has written the description and
// somebody else has checked it. Send needs both, and when it is unavailable the
// screen says which one is missing rather than greying a button out in silence.
//
// The card holds three fields and nothing else. Not "the student record with
// most of it hidden" — its own display name, its own description, its own
// photo. The internal bio, the guardian, the phone, the village and every
// amount are unreachable from here, so no future edit can put them on a card by
// accident.
//
// The card exists in English and Thai. A donor reads the language they asked
// for or nothing: the tab names any donor whose language is still empty, and
// the server refuses the send for the same reason.

import React from "react";
import { Select, Textarea, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { FormSection, InlineMessage, formatDate } from "../../design-system";
import { LanguageTabs, type TextLanguage } from "../../design-system/components/LanguageTabs";
import { Badge, Button, Icon } from "../../design-system/lumen";
import { useBranding } from "../theme/BrandingContext";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import {
  cardFileName,
  donorCardSvg,
  downloadCardPng,
  inlinePhoto,
  svgDataUri,
} from "./donorCard";
import { logEvent } from "./studentEvents";
import {
  CONSENT_META,
  DONOR_PROFILE_META,
  cardTextComplete,
  sendBlockedReason,
  studentPhotoUrl,
  type ConsentStatus,
  type DonorProfileStatus,
  type StudentRecord,
} from "./studentProfile";
import { isMissingColumnError } from "./teacherProfile";
import styles from "./DonorProfileTab.module.scss";

/**
 * Printed at the foot of the card. Branding carries colours and a logo, not a
 * legal name, and the name on a document about a child is not a thing to guess
 * from a hostname.
 */
const ORGANISATION = "iCare Thailand Foundation";

const DESCRIPTION_LIMIT = 420;

type ByLanguage = Record<TextLanguage, string>;

interface Reader {
  name: string;
  language: TextLanguage;
}

export interface DonorProfileTabProps {
  student: StudentRecord;
  /** Re-reads the record after anything here changes it. */
  onChanged: () => void;
}

export const DonorProfileTab: React.FC<DonorProfileTabProps> = ({ student, onChanged }) => {
  const { t } = useTranslation();
  const branding = useBranding();
  const { session } = useAuth();

  const initialEnName = student.donor_display_name ?? student.nickname ?? "";
  const initialEnDescription = student.donor_description ?? "";

  const [names, setNames] = React.useState<ByLanguage>({ en: initialEnName, th: "" });
  const [descriptions, setDescriptions] = React.useState<ByLanguage>({ en: initialEnDescription, th: "" });
  const [savedTh, setSavedTh] = React.useState<{ name: string; description: string }>({ name: "", description: "" });
  const [thaiAvailable, setThaiAvailable] = React.useState(true);
  const [writing, setWriting] = React.useState<TextLanguage>("en");
  const [readers, setReaders] = React.useState<Reader[]>([]);

  const [profileStatus, setProfileStatus] = React.useState<DonorProfileStatus>(
    (student.donor_profile_status as DonorProfileStatus) ?? "draft",
  );
  const [consent, setConsent] = React.useState<ConsentStatus>(
    (student.consent_status as ConsentStatus) ?? "pending",
  );

  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState<"download" | "send" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const photoInput = React.useRef<HTMLInputElement>(null);
  const [photoPath, setPhotoPath] = React.useState<string | null>(student.donor_photo_path ?? null);

  const photoUrl = studentPhotoUrl(photoPath);

  // The Thai card and the donors who will read it. Read separately from the
  // student row: naming a column the database does not have yet would empty the
  // whole record, and the English card must keep working before the migration.
  React.useEffect(() => {
    let cancelled = false;

    supabase
      .from("students")
      .select("donor_display_name_th, donor_description_th")
      .eq("id", student.id)
      .maybeSingle()
      .then(({ data, error: readError }) => {
        if (cancelled) return;
        if (readError) {
          if (isMissingColumnError(readError)) setThaiAvailable(false);
          else console.error("Error loading the Thai donor card", readError);
          return;
        }
        const name = (data as { donor_display_name_th?: string | null } | null)?.donor_display_name_th ?? "";
        const description = (data as { donor_description_th?: string | null } | null)?.donor_description_th ?? "";
        setNames((prev) => ({ ...prev, th: name }));
        setDescriptions((prev) => ({ ...prev, th: description }));
        setSavedTh({ name, description });
      });

    supabase
      .from("student_donors")
      .select("donor_name, donor_language")
      .eq("student_id", student.id)
      .then(({ data }) => {
        if (cancelled) return;
        setReaders(
          (data ?? []).map((row: { donor_name: string | null; donor_language: string | null }) => ({
            name: row.donor_name ?? t("donorCard.aDonor"),
            language: row.donor_language === "th" ? "th" : "en",
          })),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [student.id, t]);

  const textFor = (language: TextLanguage) => ({
    displayName: names[language],
    description: descriptions[language],
  });

  const written: Record<TextLanguage, boolean> = {
    en: cardTextComplete(textFor("en")),
    th: cardTextComplete(textFor("th")),
  };

  const state = {
    profileStatus,
    consent,
    card: { ...textFor("en"), photoUrl },
    cardTh: thaiAvailable ? textFor("th") : null,
    sentAt: student.donor_card_sent_at ?? null,
  };

  const languageName = (language: TextLanguage) => t(`donorCard.languageNames.${language}`);

  // Donors who would receive a language nobody has written. Named one by one:
  // "the Thai version is missing" does not tell anybody who is waiting for it.
  const unreadable = readers.filter((reader) => !written[reader.language]);
  const readerProblem = unreadable.length
    ? unreadable
        .map((reader) => t("donorCard.readerMissing", { name: reader.name, language: languageName(reader.language) }))
        .join(" ")
    : null;

  const baseBlock = sendBlockedReason(state);
  const blocked = baseBlock ? t(baseBlock) : readerProblem;

  const branded = { organisation: ORGANISATION, accent: branding?.primary_color ?? "#1c7ed6" };

  // The preview and the download are the same SVG. Not the same design — the
  // same string, shown here as an image and rasterised there.
  const svg = React.useMemo(
    () => donorCardSvg({ ...textFor(writing), photoUrl }, branded, photoUrl),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [names, descriptions, writing, photoUrl, branding],
  );

  const dirty =
    names.en !== initialEnName ||
    descriptions.en !== initialEnDescription ||
    (thaiAvailable && (names.th !== savedTh.name || descriptions.th !== savedTh.description)) ||
    profileStatus !== ((student.donor_profile_status as DonorProfileStatus) ?? "draft") ||
    consent !== ((student.consent_status as ConsentStatus) ?? "pending");

  const save = async () => {
    setError(null);
    setSaving(true);

    const consentChanged = consent !== ((student.consent_status as ConsentStatus) ?? "pending");

    const { error: updateError } = await supabase
      .from("students")
      .update({
        donor_display_name: names.en.trim() || null,
        donor_description: descriptions.en.trim() || null,
        ...(thaiAvailable
          ? {
              donor_display_name_th: names.th.trim() || null,
              donor_description_th: descriptions.th.trim() || null,
            }
          : {}),
        donor_profile_status: profileStatus,
        consent_status: consent,
        ...(consentChanged ? { consent_recorded_at: new Date().toISOString() } : {}),
      })
      .eq("id", student.id);

    setSaving(false);

    if (updateError) {
      console.error("Error saving donor profile", updateError);
      setError(t("donorCard.errors.saveFailed"));
      return;
    }

    if (thaiAvailable) setSavedTh({ name: names.th.trim(), description: descriptions.th.trim() });

    await logEvent(
      student.id,
      "donor_profile_updated",
      `Donor profile saved · ${DONOR_PROFILE_META[profileStatus].label}`,
    );

    if (consentChanged) {
      await logEvent(
        student.id,
        "consent_updated",
        `Consent set to ${CONSENT_META[consent].label.toLowerCase()}`,
      );
    }

    notifications.show({
      title: t("donorCard.editor.savedTitle"),
      message: `${t(`donorCard.profileStatus.${profileStatus}`)} · ${t(`donorCard.consentBadge.${consent}`)}`,
      color: "green",
      icon: <Icon name="check" size={16} />,
      withBorder: true,
    });

    onChanged();
  };

  const uploadPhoto = async (file: File) => {
    setError(null);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    // Its own path. The record photo and the donor photo are different
    // decisions, and one must never silently become the other.
    const path = `donor-cards/${student.id}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("student-profiles")
      .upload(path, file, { cacheControl: "3600", upsert: true });

    if (uploadError) {
      console.error("Error uploading donor photo", uploadError);
      setError(t("donorCard.errors.photoFailed"));
      return;
    }

    const { error: linkError } = await supabase
      .from("students")
      .update({ donor_photo_path: path })
      .eq("id", student.id);

    if (linkError) {
      setError(t("donorCard.errors.photoLinkFailed"));
      return;
    }

    setPhotoPath(path);
    await logEvent(student.id, "donor_profile_updated", "Donor card photo replaced");
    onChanged();
  };

  const download = async () => {
    if (sendBlockedReason(state) || !written[writing]) return;
    setBusy("download");
    setError(null);

    // The photo is inlined first: a remote image taints the canvas the PNG is
    // drawn through, and the export would fail with nothing to show for it.
    const inlined = await inlinePhoto(photoUrl);
    const problem = await downloadCardPng(
      donorCardSvg({ ...textFor(writing), photoUrl }, branded, inlined),
      cardFileName(names.en || names[writing]),
    );

    setBusy(null);

    if (problem) {
      setError(problem);
      return;
    }

    await logEvent(
      student.id,
      "donor_card_downloaded",
      `Donor card downloaded in ${writing === "th" ? "Thai" : "English"} for ${names[writing]}`,
    );
    notifications.show({
      title: t("donorCard.editor.downloadedTitle"),
      message: t("donorCard.editor.downloadedMessage"),
      color: "green",
      icon: <Icon name="check" size={16} />,
      withBorder: true,
    });
    onChanged();
  };

  const send = async () => {
    if (blocked) return;
    setBusy("send");
    setError(null);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-donor-card`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ studentId: student.id }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError((payload as { error?: string } | null)?.error ?? t("donorCard.errors.sendFailed"));
        return;
      }

      notifications.show({
        title: t("donorCard.editor.sentTitle"),
        message: t("donorCard.editor.sentMessage", { names: (payload as { recipient?: string })?.recipient ?? t("donorCard.aDonor") }),
        color: "green",
        icon: <Icon name="check" size={16} />,
        withBorder: true,
      });

      onChanged();
    } catch (requestError) {
      console.error("Error sending donor card", requestError);
      setError(t("donorCard.errors.connection"));
    } finally {
      setBusy(null);
    }
  };

  const description = descriptions[writing];

  return (
    <div className={styles.layout}>
      <div className={styles.editor}>
        {/* Both gates, side by side, each saying what it is waiting for. */}
        <FormSection
          title={t("donorCard.editor.statusTitle")}
          actions={
            <Button variant="primary" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          }
        >
          <div className={styles.statusRow}>
            <div className={styles.statusCell}>
              <Select
                label={t("donorCard.editor.profileStatus")}
                allowDeselect={false}
                data={[
                  { value: "draft", label: t("donorCard.profileStatus.draft") },
                  { value: "awaiting_review", label: t("donorCard.profileStatus.awaiting_review") },
                  { value: "published", label: t("donorCard.profileStatus.published") },
                ]}
                value={profileStatus}
                onChange={(value) => value && setProfileStatus(value as DonorProfileStatus)}
              />
              <Badge tone={DONOR_PROFILE_META[profileStatus].tone} dot>
                {t(`donorCard.profileStatus.${profileStatus}`)}
              </Badge>
            </div>

            <div className={styles.statusCell}>
              <Select
                label={t("donorCard.editor.consent")}
                allowDeselect={false}
                data={[
                  { value: "pending", label: t("donorCard.consentOption.pending") },
                  { value: "approved", label: t("donorCard.consentOption.approved") },
                  { value: "declined", label: t("donorCard.consentOption.declined") },
                ]}
                value={consent}
                onChange={(value) => value && setConsent(value as ConsentStatus)}
              />
              <Badge tone={CONSENT_META[consent].tone} dot>
                {t(`donorCard.consentBadge.${consent}`)}
              </Badge>
            </div>
          </div>

          {consent === "declined" && (
            <div className={styles.note}>
              <InlineMessage tone="error">
                {t("donorCard.editor.declined")}
              </InlineMessage>
            </div>
          )}
        </FormSection>

        <FormSection title={t("donorCard.editor.cardTitle")}>
          <LanguageTabs
            idPrefix="donor-card"
            value={writing}
            onChange={setWriting}
            written={written}
            label={t("donorCard.languageLabel")}
            missingLabel={t("donorCard.notWritten")}
            disabled={{ th: !thaiAvailable }}
          />

          {!thaiAvailable && (
            <div className={styles.note}>
              <InlineMessage tone="info">{t("donorCard.thaiNotSetUp")}</InlineMessage>
            </div>
          )}

          <div id="donor-card-panel" role="tabpanel" aria-labelledby={`donor-card-tab-${writing}`}>
            <div className={styles.field}>
              <TextInput
                label={t("donorCard.displayName")}
                lang={writing}
                placeholder={writing === "th" ? "น้องอนุชา" : "Nong Anucha"}
                value={names[writing]}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setNames((prev) => ({ ...prev, [writing]: value }));
                }}
              />
            </div>

            <div className={styles.field}>
              <Textarea
                label={t("donorCard.description")}
                lang={writing}
                minRows={5}
                autosize
                maxLength={DESCRIPTION_LIMIT}
                placeholder={
                  writing === "th"
                    ? "สิ่งที่นักเรียนชอบ สิ่งที่กำลังตั้งใจทำ และทุนนี้ช่วยอะไรได้บ้าง"
                    : "What this student enjoys, what they are working towards, what the support changes."
                }
                value={description}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDescriptions((prev) => ({ ...prev, [writing]: value }));
                }}
              />
              <span className={styles.counter}>
                {description.length} / {DESCRIPTION_LIMIT}
              </span>
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.photoLabel}>{t("donorCard.editor.photo")}</span>
            <input
              ref={photoInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={styles.fileInput}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void uploadPhoto(file);
              }}
            />
            <div className={styles.photoButtons}>
              <Button variant="secondary" icon="upload" onClick={() => photoInput.current?.click()}>
                {photoPath ? t("donorCard.editor.replacePhoto") : t("donorCard.editor.choosePhoto")}
              </Button>
              {student.profile_photo_path && photoPath !== student.profile_photo_path && (
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await supabase
                      .from("students")
                      .update({ donor_photo_path: student.profile_photo_path })
                      .eq("id", student.id);
                    setPhotoPath(student.profile_photo_path ?? null);
                    await logEvent(student.id, "donor_profile_updated", "Donor card uses the record photo");
                    onChanged();
                  }}
                >
                  {t("donorCard.editor.useRecordPhoto")}
                </Button>
              )}
            </div>
            <span className={styles.photoHint}>
              {t("donorCard.editor.photoNote")}
            </span>
          </div>
        </FormSection>
      </div>

      <aside className={styles.previewPane}>
        <div className={styles.previewHead}>
          <h2 className={styles.previewTitle}>{t("donorCard.editor.previewTitle")}</h2>
          <span className={styles.previewNote}>
            {t("donorCard.showing", { language: languageName(writing) })}
          </span>
        </div>

        <img
          className={styles.preview}
          src={svgDataUri(svg)}
          alt={t("donorCard.editor.previewAlt", { name: names[writing] || names.en })}
          lang={writing}
        />

        {blocked && (
          <div className={styles.blocked}>
            <InlineMessage tone="warning">{blocked}</InlineMessage>
          </div>
        )}

        {error && (
          <div className={styles.blocked}>
            <InlineMessage tone="error">{error}</InlineMessage>
          </div>
        )}

        <div className={styles.actions}>
          <Button
            variant="secondary"
            icon="download"
            disabled={Boolean(sendBlockedReason(state)) || !written[writing] || busy !== null || dirty}
            onClick={() => void download()}
          >
            {busy === "download" ? t("donorCard.editor.preparing") : t("donorCard.editor.download")}
          </Button>
          <Button
            variant="primary"
            icon="send"
            disabled={Boolean(blocked) || busy !== null || dirty}
            onClick={() => void send()}
          >
            {busy === "send" ? t("common.sending") : t("donorCard.editor.send")}
          </Button>
        </div>

        {dirty && !blocked && (
          <span className={styles.previewNote}>
            {t("donorCard.editor.saveFirst")}
          </span>
        )}

        {student.donor_card_sent_at && (
          <span className={styles.previewNote}>
            {t("donorCard.editor.lastSent", { date: formatDate(student.donor_card_sent_at) })}
          </span>
        )}
      </aside>
    </div>
  );
};

export default DonorProfileTab;
