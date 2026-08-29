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
// Three deliberate choices:
//
//   * The email renders in an iframe at 375px, at every breakpoint. A donor
//     opens this on a phone; a preview at desktop width would show a layout
//     nobody receives.
//   * Where two donors read different languages, both are previewed and the
//     recipient switcher names them. Sending is all-or-nothing.
//   * The primary button says the person's name — "Send to Khun Somchai" — not
//     "Confirm". The name is the fact that matters at the moment of sending.

import React, { useEffect, useMemo, useState } from "react";
import { Text } from "@mantine/core";
import { supabase } from "../../lib/supabaseClient";
import { Badge, Banner, Button, Dialog } from "../../design-system/lumen";
import styles from "./EmailPreviewDialog.module.scss";

export interface PreviewRecipient {
  donor_id: string;
  name: string | null;
  email: string | null;
  language: "en" | "th";
  subject: string;
  html: string;
  /** The report has no text in the language this donor reads. */
  missingLanguage: boolean;
}

export interface EmailPreviewDialogProps {
  reportId: string;
  opened: boolean;
  onClose: () => void;
  /** Fired after a successful send, so the page can move on. */
  onSent: (recipients: PreviewRecipient[]) => void;
}

export const EmailPreviewDialog: React.FC<EmailPreviewDialogProps> = ({
  reportId,
  opened,
  onClose,
  onSent,
}) => {
  const [previews, setPreviews] = useState<PreviewRecipient[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;

    setLoading(true);
    setError(null);
    setActive(0);

    void (async () => {
      const { data, error: invokeError } = await supabase.functions.invoke("report-email", {
        body: { reportId, preview: true },
      });

      if (invokeError) {
        // The function returns its reason in the body; the SDK surfaces only a
        // generic message, so the body is read explicitly. A vague failure here
        // sends somebody to the logs for something the screen already knows.
        const detail = await invokeError.context?.json?.().catch(() => null);
        setError(detail?.error ?? invokeError.message ?? "Could not build the preview.");
        setLoading(false);
        return;
      }

      setPreviews((data?.previews ?? []) as PreviewRecipient[]);
      setLoading(false);
    })();
  }, [opened, reportId]);

  const blocked = useMemo(() => previews.filter((p) => p.missingLanguage), [previews]);
  const current = previews[active];

  const send = async () => {
    if (sending || blocked.length > 0) return;

    setSending(true);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke("report-email", {
      body: { reportId },
    });

    setSending(false);

    if (invokeError) {
      const detail = await invokeError.context?.json?.().catch(() => null);
      setError(detail?.error ?? invokeError.message ?? "Could not send the email.");
      return;
    }

    if ((data?.failed ?? []).length > 0) {
      setError(`Some messages did not send: ${(data.failed as string[]).join(" · ")}`);
      return;
    }

    onSent(previews);
    onClose();
  };

  const sendLabel = (() => {
    if (sending) return "Sending…";
    if (previews.length === 1) return `Send to ${previews[0].name ?? "this donor"}`;
    return `Send to ${previews.length} donors`;
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
            disabled={sending || loading || blocked.length > 0 || previews.length === 0}
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
      ) : error ? (
        <Banner tone="danger" title="Could not send">
          {error}
        </Banner>
      ) : previews.length === 0 ? (
        <Banner tone="warning" title="Nobody to send to">
          No donor is funding this student, so this report has no recipient.
        </Banner>
      ) : (
        <>
          {blocked.length > 0 && (
            <Banner tone="warning" title="A version is missing">
              {blocked
                .map(
                  (p) =>
                    `${p.name ?? "A donor"} reads ${p.language === "th" ? "Thai" : "English"}, and that version is empty.`,
                )
                .join(" ")}{" "}
              Write it before sending — nobody is sent the other language instead.
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
                  <Badge tone="neutral">{preview.language === "th" ? "ไทย" : "EN"}</Badge>
                </button>
              ))}
            </div>
          )}

          {current && (
            <>
              <dl className={styles.meta}>
                <div>
                  <dt>To</dt>
                  <dd>
                    {current.name ?? "A donor"} · {current.email ?? "no address on record"}
                  </dd>
                </div>
                <div>
                  <dt>Subject</dt>
                  <dd lang={current.language}>{current.subject}</dd>
                </div>
                <div>
                  <dt>Language</dt>
                  <dd>{current.language === "th" ? "ไทย (Thai)" : "English"}</dd>
                </div>
              </dl>

              <div className={styles.phone}>
                <iframe
                  className={styles.frame}
                  // Rendered at phone width at every breakpoint, because that is
                  // where it will be read.
                  title={`Email preview for ${current.name ?? "this donor"}`}
                  srcDoc={current.html}
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
