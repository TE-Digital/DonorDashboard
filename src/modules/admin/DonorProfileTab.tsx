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

import React from "react";
import { Select, Textarea, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { FormSection, InlineMessage } from "../../design-system";
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
  sendBlockedReason,
  studentPhotoUrl,
  type ConsentStatus,
  type DonorProfileStatus,
  type StudentRecord,
} from "./studentProfile";
import styles from "./DonorProfileTab.module.scss";

/**
 * Printed at the foot of the card. Branding carries colours and a logo, not a
 * legal name, and the name on a document about a child is not a thing to guess
 * from a hostname.
 */
const ORGANISATION = "iCare Thailand Foundation";

export interface DonorProfileTabProps {
  student: StudentRecord;
  /** Re-reads the record after anything here changes it. */
  onChanged: () => void;
}

export const DonorProfileTab: React.FC<DonorProfileTabProps> = ({ student, onChanged }) => {
  const branding = useBranding();
  const { session } = useAuth();

  const [displayName, setDisplayName] = React.useState(
    student.donor_display_name ?? student.nickname ?? "",
  );
  const [description, setDescription] = React.useState(student.donor_description ?? "");
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

  const state = {
    profileStatus,
    consent,
    card: { displayName, description, photoUrl },
    sentAt: student.donor_card_sent_at ?? null,
  };

  const blocked = sendBlockedReason(state);

  // The preview and the download are the same SVG. Not the same design — the
  // same string, shown here as an image and rasterised there.
  const svg = React.useMemo(
    () =>
      donorCardSvg(
        { displayName, description, photoUrl },
        {
          organisation: ORGANISATION,
          accent: branding?.primary_color ?? "#1c7ed6",
        },
        photoUrl,
      ),
    [displayName, description, photoUrl, branding],
  );

  const dirty =
    displayName !== (student.donor_display_name ?? student.nickname ?? "") ||
    description !== (student.donor_description ?? "") ||
    profileStatus !== ((student.donor_profile_status as DonorProfileStatus) ?? "draft") ||
    consent !== ((student.consent_status as ConsentStatus) ?? "pending");

  const save = async () => {
    setError(null);
    setSaving(true);

    const consentChanged = consent !== ((student.consent_status as ConsentStatus) ?? "pending");

    const { error: updateError } = await supabase
      .from("students")
      .update({
        donor_display_name: displayName.trim() || null,
        donor_description: description.trim() || null,
        donor_profile_status: profileStatus,
        consent_status: consent,
        ...(consentChanged ? { consent_recorded_at: new Date().toISOString() } : {}),
      })
      .eq("id", student.id);

    setSaving(false);

    if (updateError) {
      console.error("Error saving donor profile", updateError);
      setError("The donor profile did not save. Check your connection, then try again.");
      return;
    }

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
      title: "Donor profile saved",
      message: `${DONOR_PROFILE_META[profileStatus].label} · ${CONSENT_META[consent].label}`,
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
      setError("The photo could not be uploaded.");
      return;
    }

    const { error: linkError } = await supabase
      .from("students")
      .update({ donor_photo_path: path })
      .eq("id", student.id);

    if (linkError) {
      setError("The photo uploaded but could not be linked.");
      return;
    }

    setPhotoPath(path);
    await logEvent(student.id, "donor_profile_updated", "Donor card photo replaced");
    onChanged();
  };

  const download = async () => {
    if (blocked) return;
    setBusy("download");
    setError(null);

    // The photo is inlined first: a remote image taints the canvas the PNG is
    // drawn through, and the export would fail with nothing to show for it.
    const inlined = await inlinePhoto(photoUrl);
    const problem = await downloadCardPng(
      donorCardSvg(
        { displayName, description, photoUrl },
        {
          organisation: ORGANISATION,
          accent: branding?.primary_color ?? "#1c7ed6",
        },
        inlined,
      ),
      cardFileName(displayName),
    );

    setBusy(null);

    if (problem) {
      setError(problem);
      return;
    }

    await logEvent(student.id, "donor_card_downloaded", `Donor card downloaded for ${displayName}`);
    notifications.show({
      title: "Card downloaded",
      message: "The image is in your downloads folder.",
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
        setError((payload as { error?: string } | null)?.error ?? "The card was not sent.");
        return;
      }

      notifications.show({
        title: "Card sent",
        message: `Sent to ${(payload as { recipient?: string })?.recipient ?? "the donor"}.`,
        color: "green",
        icon: <Icon name="check" size={16} />,
        withBorder: true,
      });

      onChanged();
    } catch (requestError) {
      console.error("Error sending donor card", requestError);
      setError("The server could not be reached. Check your connection, then try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.layout}>
      <div className={styles.editor}>
        {/* Both gates, side by side, each saying what it is waiting for. */}
        <FormSection
          title="Status"
          actions={
            <Button variant="primary" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          }
        >
          <div className={styles.statusRow}>
            <div className={styles.statusCell}>
              <Select
                label="Profile status"
                allowDeselect={false}
                data={[
                  { value: "draft", label: "Draft" },
                  { value: "awaiting_review", label: "Awaiting review" },
                  { value: "published", label: "Published" },
                ]}
                value={profileStatus}
                onChange={(value) => value && setProfileStatus(value as DonorProfileStatus)}
              />
              <Badge tone={DONOR_PROFILE_META[profileStatus].tone} dot>
                {DONOR_PROFILE_META[profileStatus].label}
              </Badge>
            </div>

            <div className={styles.statusCell}>
              <Select
                label="Consent"
                allowDeselect={false}
                data={[
                  { value: "pending", label: "Pending" },
                  { value: "approved", label: "Approved" },
                  { value: "declined", label: "Declined" },
                ]}
                value={consent}
                onChange={(value) => value && setConsent(value as ConsentStatus)}
              />
              <Badge tone={CONSENT_META[consent].tone} dot>
                {CONSENT_META[consent].label}
              </Badge>
            </div>
          </div>

          {consent === "declined" && (
            <div className={styles.note}>
              <InlineMessage tone="error">
                The family has declined. Nothing about this student may be sent to a donor, and this
                card cannot be published.
              </InlineMessage>
            </div>
          )}
        </FormSection>

        <FormSection
          title="The card"
        >
          <TextInput
            label="Display name"
            placeholder="e.g. Nong Anucha"
            value={displayName}
            onChange={(event) => setDisplayName(event.currentTarget.value)}
          />

          <div className={styles.field}>
            <Textarea
              label="Donor-facing description"
              minRows={5}
              autosize
              maxLength={420}
              placeholder="What this student enjoys, what they are working towards, what the sponsorship changes."
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
            <span className={styles.counter}>{description.length} / 420</span>
          </div>

          <div className={styles.field}>
            <span className={styles.photoLabel}>Approved photo</span>
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
                {photoPath ? "Replace photo" : "Choose photo"}
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
                  Use the record photo
                </Button>
              )}
            </div>
            <span className={styles.photoHint}>
              The record photo and the donor photo are separate on purpose. Choosing one here does
              not change the other.
            </span>
          </div>
        </FormSection>
      </div>

      <aside className={styles.previewPane}>
        <div className={styles.previewHead}>
          <h2 className={styles.previewTitle}>What the donor receives</h2>
          <span className={styles.previewNote}>
            This image is exactly what downloads and what is emailed.
          </span>
        </div>

        <img className={styles.preview} src={svgDataUri(svg)} alt={`Donor card for ${displayName}`} />

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
            disabled={Boolean(blocked) || busy !== null || dirty}
            onClick={() => void download()}
          >
            {busy === "download" ? "Preparing…" : "Download"}
          </Button>
          <Button
            variant="primary"
            icon="send"
            disabled={Boolean(blocked) || busy !== null || dirty}
            onClick={() => void send()}
          >
            {busy === "send" ? "Sending…" : "Send to donor"}
          </Button>
        </div>

        {dirty && !blocked && (
          <span className={styles.previewNote}>
            Save your changes first — the card that sends is the saved one.
          </span>
        )}

        {student.donor_card_sent_at && (
          <span className={styles.previewNote}>
            Last sent {new Date(student.donor_card_sent_at).toLocaleString()}.
          </span>
        )}
      </aside>
    </div>
  );
};

export default DonorProfileTab;
