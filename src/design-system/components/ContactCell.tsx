// src/design-system/components/ContactCell.tsx
//
// How a person is reached, as icons that put the value on the clipboard.
//
// A directory table used to spend 370px on an email column and a phone column.
// Nobody reads an address off a screen — they copy it into LINE, into their
// phone, into a mail client. So the columns collapse into one 90px cell of
// icons: click the envelope, the address is on the clipboard; click the
// handset, the number is.
//
// Feedback lands twice, deliberately. The icon itself turns green for a
// moment, on the exact control that was clicked, and a notification names what
// was copied — because a clipboard is invisible, and "did that work?" is the
// one question a silent copy always leaves behind.
//
// The notification carries the value itself. An admin copying three numbers in
// a row can see which one they are holding without pasting it somewhere first.

import React from "react";
import { notifications } from "@mantine/notifications";
import { Icon } from "../lumen";
import styles from "./ContactCell.module.scss";

export type ContactKind = "email" | "phone" | "line" | "link";

interface ChannelMeta {
  icon: string;
  /** "Copy email address" — the accessible name and the tooltip. */
  verb: string;
  /** "Email address copied" — the notification title. */
  copied: string;
  /** Shown in place of the value when there is none. */
  missing: string;
}

const CHANNELS: Record<ContactKind, ChannelMeta> = {
  email: {
    icon: "mail",
    verb: "Copy email address",
    copied: "Email address copied",
    missing: "No email address",
  },
  phone: {
    icon: "phone",
    verb: "Copy phone number",
    copied: "Phone number copied",
    missing: "No phone number",
  },
  line: {
    icon: "message-circle",
    verb: "Copy LINE ID",
    copied: "LINE ID copied",
    missing: "No LINE ID",
  },
  link: {
    icon: "link",
    verb: "Copy link",
    copied: "Link copied",
    missing: "No link",
  },
};

/**
 * One clipboard notification at a time.
 *
 * Copying an email and then a phone number a second later should leave the
 * phone number on screen, not a stack of two receipts racing each other out.
 */
const TOAST_ID = "clipboard-copy";

/**
 * Writes to the clipboard, falling back to the old selection trick.
 *
 * navigator.clipboard exists only in a secure context. A staff laptop opening
 * the dashboard over plain http on the office network is not one, and losing
 * copy there would be a silent failure on exactly the machines that need it.
 */
export const copyToClipboard = async (value: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the textarea below.
  }

  try {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const done = document.execCommand("copy");
    document.body.removeChild(field);
    return done;
  } catch {
    return false;
  }
};

export interface CopyFeedback {
  /** The notification heading, e.g. "Email address copied". */
  title: string;
  /** The value now on the clipboard. Shown so it can be checked at a glance. */
  value: string;
  /** Whose value it is, e.g. "Araya Sukjai". */
  owner?: string | null;
  /** Replaces the value line when the value must not be shown (a sign-in link). */
  redacted?: string;
}

/** The receipt for anything copied anywhere in the product. */
export const showCopyFeedback = ({ title, value, owner, redacted }: CopyFeedback) => {
  notifications.hide(TOAST_ID);
  notifications.show({
    id: TOAST_ID,
    title,
    color: "green",
    icon: <Icon name="check" size={16} />,
    autoClose: 3000,
    withBorder: true,
    message: (
      <>
        <div className={styles.toastValue}>{redacted ?? value}</div>
        {owner && <div className={styles.toastOwner}>{owner}</div>}
      </>
    ),
  });
};

export const showCopyFailure = () => {
  notifications.hide(TOAST_ID);
  notifications.show({
    id: TOAST_ID,
    title: "Nothing was copied",
    message: "Your browser blocked the clipboard. Select the value and copy it by hand.",
    color: "red",
    icon: <Icon name="circle-alert" size={16} />,
    autoClose: 5000,
    withBorder: true,
  });
};

export interface CopyIconButtonProps {
  kind: ContactKind;
  value?: string | null;
  /** Named in the notification, so a copied number is traceable to a person. */
  owner?: string | null;
  /** Overrides the tooltip, e.g. "Copy guardian's phone number". */
  label?: string;
  /** Hides the value in the notification. For links that grant sign-in. */
  redacted?: string;
  onCopied?: (value: string) => void;
}

/** One icon: hover to read the value, click to copy it. */
export const CopyIconButton: React.FC<CopyIconButtonProps> = ({
  kind,
  value,
  owner,
  label,
  redacted,
  onCopied,
}) => {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const meta = CHANNELS[kind];
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return (
      <span className={styles.missing} title={meta.missing} aria-label={meta.missing}>
        <Icon name={meta.icon} size={15} />
      </span>
    );
  }

  const handle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // The row underneath opens the record. Copying is not that.
    event.stopPropagation();

    const done = await copyToClipboard(trimmed);

    if (!done) {
      showCopyFailure();
      return;
    }

    showCopyFeedback({ title: meta.copied, value: trimmed, owner, redacted });
    onCopied?.(trimmed);

    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1200);
  };

  // The tooltip carries the value, so an admin can read an address without
  // copying it, and can tell two similar numbers apart before they click.
  const tooltip = `${label ?? meta.verb} · ${trimmed}`;

  return (
    <button
      type="button"
      className={`${styles.button} ${copied ? styles.copied : ""}`}
      onClick={handle}
      title={tooltip}
      aria-label={tooltip}
    >
      <Icon name={copied ? "check" : meta.icon} size={15} />
    </button>
  );
};

export interface ContactCellProps {
  email?: string | null;
  phone?: string | null;
  line?: string | null;
  /** Named in every notification this cell raises. */
  owner?: string | null;
  /**
   * Which channels get an icon, in order. Passing a channel the record has no
   * value for still reserves its place, so icons line up down the column.
   */
  channels?: ContactKind[];
  /** Labels for a record where "phone" is not the person's own, e.g. a guardian. */
  labels?: Partial<Record<ContactKind, string>>;
}

/**
 * The contact column of a directory table: one icon per channel, each of them
 * a copy button. Replaces a separate email column and phone column.
 */
export const ContactCell: React.FC<ContactCellProps> = ({
  email,
  phone,
  line,
  owner,
  channels = ["email", "phone"],
  labels,
}) => {
  const value: Record<ContactKind, string | null | undefined> = {
    email,
    phone,
    line,
    link: null,
  };

  // A span, not a div: this cell also sits inside the paragraph of metadata
  // under a person's name on their record.
  return (
    <span className={styles.row}>
      {channels.map((kind) => (
        <CopyIconButton
          key={kind}
          kind={kind}
          value={value[kind]}
          owner={owner}
          label={labels?.[kind]}
        />
      ))}
    </span>
  );
};

export default ContactCell;
