// src/modules/admin/RoleEditorDrawer.tsx
//
// Changing what somebody is allowed to do, deliberately.
//
// Roles used to be four columns of checkboxes that wrote to the database on the
// click. Three things were wrong with that. A stray click granted admin. A
// failed write only ever reached the browser console, so a grant that did not
// happen looked exactly like one that did. And nothing ever read back the
// change before it was made.
//
// So the row shows roles and this panel edits them: ticks are staged, the
// summary says what is about to change, Save writes them together, granting
// admin asks first, and a failure says so and restores the last known state.

import React from "react";
import { Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { supabase } from "../../lib/supabaseClient";
import { FormDrawer, InlineMessage } from "../../design-system";
import { Button, Checkbox } from "../../design-system/lumen";
import styles from "./AdminDirectory.module.scss";

export type UiRole = "admin" | "teacher" | "donor" | "agent";

export const ALL_ROLES: UiRole[] = ["admin", "teacher", "donor", "agent"];

/** What each role means, in the words an admin would use to explain it. */
export const ROLE_META: Record<UiRole, { label: string; summary: string }> = {
  admin: {
    label: "Admin",
    summary: "Everything: every student, every donor, every account on this page.",
  },
  teacher: {
    label: "Teacher",
    summary: "Their own students, and the reports they write about them.",
  },
  donor: {
    label: "Donor",
    summary: "The dashboard for the students they sponsor.",
  },
  agent: {
    label: "Agent",
    summary: "The donors they introduced, and those donors' students.",
  },
};

export interface RoleEditorDrawerProps {
  opened: boolean;
  onClose: () => void;
  userId: string | null;
  name: string;
  email: string | null;
  /** The roles this person holds now, as the table last read them. */
  roles: UiRole[];
  /** Reload the directory. Called after a save that changed something. */
  onSaved: () => void;
}

/**
 * What the database says this person holds, or null if it could not be asked.
 *
 * Used only after a partial failure, where the props are a snapshot from before
 * the write and half of it may have landed.
 */
const readRoles = async (userId: string): Promise<UiRole[] | null> => {
  const { data, error } = await supabase
    .from("person_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    console.error("Error re-reading roles", error);
    return null;
  }

  return (data ?? [])
    .map((row: { role: string }) => row.role as UiRole)
    .filter((role) => ALL_ROLES.includes(role));
};

export const RoleEditorDrawer: React.FC<RoleEditorDrawerProps> = ({
  opened,
  onClose,
  userId,
  name,
  email,
  roles,
  onSaved,
}) => {
  const [staged, setStaged] = React.useState<UiRole[]>(roles);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmAdmin, setConfirmAdmin] = React.useState(false);

  // Reopening on a different person starts from that person's roles, not from
  // whatever was left on screen last time.
  React.useEffect(() => {
    if (opened) {
      setStaged(roles);
      setError(null);
      setConfirmAdmin(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, userId]);

  const added = staged.filter((role) => !roles.includes(role));
  const removed = roles.filter((role) => !staged.includes(role));
  const dirty = added.length > 0 || removed.length > 0;

  const toggle = (role: UiRole) =>
    setStaged((current) =>
      current.includes(role) ? current.filter((r) => r !== role) : [...current, role],
    );

  const write = async () => {
    if (!userId || !dirty) return;

    setSaving(true);
    setError(null);

    // Both halves go through before anything is reported. A partial change is
    // still a change, so the directory is reloaded either way.
    const failed: string[] = [];
    const landed: string[] = [];

    if (added.length) {
      const { error: addError } = await supabase
        .from("person_roles")
        .upsert(
          added.map((role) => ({ user_id: userId, role })),
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
      const names = added.map((r) => ROLE_META[r].label).join(", ");
      if (addError) {
        console.error("Error adding roles", addError);
        failed.push(`${names} could not be granted`);
      } else {
        landed.push(`${names} granted`);
      }
    }

    if (removed.length) {
      const { error: removeError } = await supabase
        .from("person_roles")
        .delete()
        .eq("user_id", userId)
        .in("role", removed);
      const names = removed.map((r) => ROLE_META[r].label).join(", ");
      if (removeError) {
        console.error("Error removing roles", removeError);
        failed.push(`${names} could not be removed`);
      } else {
        landed.push(`${names} removed`);
      }
    }

    if (failed.length) {
      // Say what actually happened. Telling an admin "nothing has been saved"
      // when one half of the change did land is the same failure this panel
      // exists to fix, in the other direction: they walk away believing a role
      // was not granted when it was.
      const truth = await readRoles(userId);
      setStaged(truth ?? roles);
      setSaving(false);
      setError(
        landed.length
          ? `${landed.join(", ")}. But ${failed.join(", and ")} — the ticks below now show what the database holds. Try the rest again in a minute.`
          : `${failed.join(", and ")}. Nothing on this panel has been saved. Try again in a minute.`,
      );
      onSaved();
      return;
    }

    setSaving(false);

    notifications.show({
      title: "Roles updated",
      message: `${name} ${describe(added, removed)}`,
      color: "green",
    });

    onSaved();
    onClose();
  };

  const submit = () => {
    // The one grant worth stopping for. Everything else is reversible from this
    // same panel by somebody who still has access; handing out admin is how an
    // admin loses the ability to take it back.
    if (added.includes("admin")) {
      setConfirmAdmin(true);
      return;
    }
    void write();
  };

  return (
    <>
      <FormDrawer
        opened={opened}
        onClose={onClose}
        title={`Roles for ${name}`}
        subtitle={email ?? "No email address on this account"}
        size={460}
        busy={saving}
        dirty={dirty}
        status={dirty ? <Text size="xs" c="dimmed">{summaryLine(added, removed)}</Text> : null}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={!dirty || saving}>
              {saving ? "Saving…" : "Save roles"}
            </Button>
          </>
        }
      >
        <Stack gap="md">
          <InlineMessage tone="error">{error}</InlineMessage>

          <Stack gap="sm">
            {ALL_ROLES.map((role) => (
              <div key={role}>
                <Checkbox
                  checked={staged.includes(role)}
                  disabled={saving}
                  label={ROLE_META[role].label}
                  onChange={() => toggle(role)}
                />
                <Text size="xs" c="dimmed" ml={24}>
                  {ROLE_META[role].summary}
                </Text>
              </div>
            ))}
          </Stack>

          {dirty && (
            <div className={styles.roleSummary}>
              {added.map((role) => (
                <span key={`add-${role}`}>Gains {ROLE_META[role].label}</span>
              ))}
              {removed.map((role) => (
                <span key={`remove-${role}`}>Loses {ROLE_META[role].label}</span>
              ))}
            </div>
          )}

          {staged.length === 0 && (
            <InlineMessage tone="warning">
              With no role this account can still sign in, but there is nothing for it to open.
            </InlineMessage>
          )}
        </Stack>
      </FormDrawer>

      <Modal
        opened={confirmAdmin}
        onClose={() => setConfirmAdmin(false)}
        title="Give admin access?"
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            {name} will be able to see and change every student, donor, school and account —
            including this page, and including your own access.
          </Text>
          <Stack gap="xs">
            <Button
              variant="primary"
              onClick={() => {
                setConfirmAdmin(false);
                void write();
              }}
            >
              Give admin access
            </Button>
            <Button variant="ghost" onClick={() => setConfirmAdmin(false)}>
              Cancel
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </>
  );
};

/** "gains Admin and loses Teacher" — the sentence in the confirmation toast. */
const describe = (added: UiRole[], removed: UiRole[]): string => {
  const parts: string[] = [];
  if (added.length) parts.push(`now has ${list(added)}`);
  if (removed.length) parts.push(`no longer has ${list(removed)}`);
  return parts.join(", and ");
};

const summaryLine = (added: UiRole[], removed: UiRole[]): string => {
  const count = added.length + removed.length;
  return count === 1 ? "1 change to save" : `${count} changes to save`;
};

const list = (roles: UiRole[]): string =>
  roles
    .map((role) => ROLE_META[role].label)
    .join(" and ")
    .toLowerCase();

export default RoleEditorDrawer;
