// src/modules/admin/AccessActions.tsx
//
// Account access, where an admin already is: on the row.
//
// Sending a teacher their invitation again is a thirty-second job that used to
// need a detour through Users & roles. Here it is a menu at the end of the
// row — the same menu on the directory and on the teacher's own page, so the
// answer to "how do I resend that?" is the same wherever the admin is looking.
//
// Three rules hold this together:
//   1. The badge says what is true now; the menu offers only what makes sense
//      for that state. An active account is never offered an invitation.
//   2. Anything with a consequence is confirmed in plain words first — taking
//      access away, and copying a link that signs somebody in.
//   3. Every outcome is a notification that names the person, because the
//      row itself does not visibly change when an email goes out.

import React from "react";
import { Menu, Modal, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { copyToClipboard, showCopyFailure, showCopyFeedback } from "../../design-system";
import { Badge, Button, Icon, IconButton } from "../../design-system/lumen";
import { useAuth } from "../auth/AuthContext";
import {
  ACCESS_META,
  ACTION_COPY,
  AccessActionError,
  accessStateOf,
  actionsFor,
  runAccessAction,
  type AccessAction,
  type AccessRow,
  type AccessState,
} from "./userAccess";

/* -------------------------------------------------------------- The badge */

export interface AccessBadgeProps {
  state: AccessState;
  /** Adds "· 3 sent" so a repeatedly-invited account is visible at a glance. */
  inviteCount?: number | null;
}

export const AccessBadge: React.FC<AccessBadgeProps> = ({ state, inviteCount }) => {
  const meta = ACCESS_META[state];
  const chased = (state === "stale" || state === "invited") && (inviteCount ?? 0) > 1;

  return (
    <span title={meta.hint}>
      <Badge tone={meta.tone} dot>
        {chased ? `${meta.label} · ${inviteCount} sent` : meta.label}
      </Badge>
    </span>
  );
};

/* --------------------------------------------------------------- The menu */

export interface AccessMenuProps {
  userId: string;
  /** Named in every confirmation and every notification. */
  name: string;
  email?: string | null;
  access: AccessRow | null | undefined;
  /** True once the state is known. False hides the menu rather than guessing. */
  available: boolean;
  /** Re-reads the directory after something changed. */
  onChanged?: () => void;
  /** A full-width button instead of an icon, for a detail page. */
  variant?: "icon" | "buttons";
}

export const AccessMenu: React.FC<AccessMenuProps> = ({
  userId,
  name,
  email,
  access,
  available,
  onChanged,
  variant = "icon",
}) => {
  const { session } = useAuth();
  const [pending, setPending] = React.useState<AccessAction | null>(null);
  const [confirming, setConfirming] = React.useState<AccessAction | null>(null);

  const state = available ? accessStateOf(access) : "unknown";
  const actions = actionsFor(state);
  const person = name || "this person";

  const perform = async (action: AccessAction) => {
    setConfirming(null);
    setPending(action);

    try {
      const result = await runAccessAction(userId, action, session?.access_token);
      const copy = ACTION_COPY[result.action] ?? ACTION_COPY[action];

      if (result.actionLink) {
        const done = await copyToClipboard(result.actionLink);
        if (!done) {
          showCopyFailure();
          return;
        }
        // The link itself is a credential. The receipt confirms what is on the
        // clipboard without printing it on screen for the room to read.
        showCopyFeedback({
          title: copy.done,
          value: result.actionLink,
          owner: person,
          redacted: "Single use sign in link · expires",
        });
      } else {
        notifications.show({
          title: copy.done,
          message: copy.message.replace("{name}", person),
          color: "green",
          icon: <Icon name="check" size={16} />,
          autoClose: 4000,
          withBorder: true,
        });
      }

      // The server may have done something other than what was asked — a
      // resend on an already-active account becomes a password link. Saying so
      // is the difference between a helpful fallback and a silent surprise.
      if (result.action !== action && result.note) {
        notifications.show({
          title: "Sent as a password link",
          message: result.note,
          color: "blue",
          icon: <Icon name="info" size={16} />,
          autoClose: 6000,
          withBorder: true,
        });
      }

      onChanged?.();
    } catch (error) {
      notifications.show({
        title: "Nothing was sent",
        message:
          error instanceof AccessActionError
            ? error.message
            : "We couldn't send that. Check your connection and try again in a minute.",
        color: "red",
        icon: <Icon name="circle-alert" size={16} />,
        autoClose: 6000,
        withBorder: true,
      });
    } finally {
      setPending(null);
    }
  };

  const start = (action: AccessAction) => {
    const copy = ACTION_COPY[action];
    if (copy.confirm) {
      setConfirming(action);
      return;
    }
    void perform(action);
  };

  const confirmCopy = confirming ? ACTION_COPY[confirming] : null;

  const confirmDialog = (
    <Modal
      opened={Boolean(confirming)}
      onClose={() => setConfirming(null)}
      title={confirmCopy?.confirm?.title}
      size="sm"
    >
      <Text size="sm" style={{ textWrap: "pretty" }}>
        {confirmCopy?.confirm?.body}
      </Text>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
        <Button variant="ghost" onClick={() => setConfirming(null)}>
          Cancel
        </Button>
        <Button
          variant={confirming === "revoke" ? "danger" : "primary"}
          onClick={() => confirming && void perform(confirming)}
        >
          {confirmCopy?.confirm?.commit}
        </Button>
      </div>
    </Modal>
  );

  if (!available) {
    return (
      <span title={ACCESS_META.unknown.hint}>
        <IconButton icon="ellipsis" label="Account actions are unavailable" disabled />
      </span>
    );
  }

  if (variant === "buttons") {
    return (
      <>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {actions.map((action, index) => (
            <Button
              key={action}
              variant={index === 0 ? "primary" : action === "revoke" ? "danger" : "secondary"}
              icon={ACTION_COPY[action].icon}
              disabled={pending !== null}
              onClick={() => start(action)}
            >
              {pending === action ? "Working…" : ACTION_COPY[action].label}
            </Button>
          ))}
          {email && (
            <Button
              variant="ghost"
              icon="mail"
              onClick={async () => {
                const done = await copyToClipboard(email);
                if (done) {
                  showCopyFeedback({ title: "Email address copied", value: email, owner: person });
                } else {
                  showCopyFailure();
                }
              }}
            >
              Copy sign in address
            </Button>
          )}
        </div>
        {confirmDialog}
      </>
    );
  }

  return (
    // The row underneath opens the record, so every click in here is stopped
    // before it gets there.
    <span onClick={(event) => event.stopPropagation()} style={{ display: "inline-flex" }}>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <span>
            <IconButton
              icon="ellipsis"
              label={`Account actions for ${person}`}
              active={pending !== null}
            />
          </span>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{ACCESS_META[state].label}</Menu.Label>

          {actions.length === 0 && (
            // A dead control with no reason is a dead end, so the menu says why
            // it is empty rather than showing nothing.
            <Menu.Item disabled>This person can't sign in yet</Menu.Item>
          )}

          {actions.map((action) => (
            <Menu.Item
              key={action}
              leftSection={<Icon name={ACTION_COPY[action].icon} size={15} />}
              color={action === "revoke" ? "red" : undefined}
              disabled={pending !== null}
              onClick={() => start(action)}
            >
              {pending === action ? "Working…" : ACTION_COPY[action].label}
            </Menu.Item>
          ))}

          {email && (
            <>
              <Menu.Divider />
              <Menu.Item
                leftSection={<Icon name="mail" size={15} />}
                onClick={async () => {
                  const done = await copyToClipboard(email);
                  if (done) {
                    showCopyFeedback({ title: "Email address copied", value: email, owner: person });
                  } else {
                    showCopyFailure();
                  }
                }}
              >
                Copy sign in address
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>
      {confirmDialog}
    </span>
  );
};

export default AccessMenu;
