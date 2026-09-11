// src/modules/admin/AdminUsersRolesPage.tsx
//
// The access ledger: every account, what it may do, and whether it can get in.
//
// This page is not a second directory. People are created where their work is —
// a teacher in Teachers, a donor in Donors — and land here afterwards. What
// happens here is authority: granting a role, taking access away, giving it
// back, and finding the account that has not been used in a year.
//
// Roles are edited in a panel rather than by ticking a grid, because a click
// that silently grants admin is a click nobody meant to make. See
// RoleEditorDrawer for why.

import React, { useEffect, useState } from "react";
import { supabase, Profile } from "../../lib/supabaseClient";
import { Anchor, Stack, Text } from "@mantine/core";
import {
  ContactCell,
  LoadingState,
  PageHeader,
  TableSection,
  formatDate,
  formatDateTime,
  type TableKpi,
} from "../../design-system";
import { Badge, Button as LumenButton, type DataColumn } from "../../design-system/lumen";
import { AccessBadge, AccessMenu } from "./AccessActions";
import {
  ACCESS_META,
  ACCESS_RANK,
  accessStateOf,
  loadAccessMap,
  type AccessMap,
  type AccessState,
} from "./userAccess";
import { ALL_ROLES, ROLE_META, RoleEditorDrawer, type UiRole } from "./RoleEditorDrawer";
import styles from "./AdminDirectory.module.scss";

// `email` is already on Profile — redeclaring it here as optional made this
// interface incompatible with the one it extends.
interface UserWithRoles extends Profile {
  roles: UiRole[];
}

/** The role the table is narrowed to, or everyone. */
type RoleFilter = UiRole | "all" | "none";

/** How long ago, in the words an admin would use. */
const relativeDate = (iso: string | null | undefined): string => {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never";

  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} months ago`;
  return `${Math.floor(months / 12)} years ago`;
};

export const AdminUsersRolesPage: React.FC = () => {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  /** Who can actually sign in. Roles say what a person may do; this says whether they can. */
  const [access, setAccess] = useState<AccessMap>({ byUser: {}, available: false, error: null });
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [editing, setEditing] = useState<UserWithRoles | null>(null);

  const load = async () => {
    setLoading(true);

    setAccess(await loadAccessMap());

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, email, created_at, person_roles(role)")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Error loading users", error);
      setLoading(false);
      return;
    }

    const mapped: UserWithRoles[] =
      (data ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        phone: p.phone,
        email: p.email,
        created_at: p.created_at,
        // The legacy `profiles.role` column is deliberately not carried over —
        // person_roles is the source of truth for authorisation.
        roles: (p.person_roles ?? []).map((r: any) => r.role as UiRole),
      })) ?? [];

    setUsers(mapped);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stateOf = React.useCallback(
    (user: UserWithRoles): AccessState =>
      access.available ? accessStateOf(access.byUser[user.id]) : "unknown",
    [access],
  );

  /** What the table shows: everyone, narrowed to the role in focus. */
  const visible = React.useMemo(() => {
    if (roleFilter === "all") return users;
    if (roleFilter === "none") return users.filter((u) => u.roles.length === 0);
    return users.filter((u) => u.roles.includes(roleFilter));
  }, [users, roleFilter]);

  if (loading) {
    return <LoadingState />;
  }

  const kpis: TableKpi[] = (() => {
    const counts = (role: UiRole) => users.filter((u) => u.roles.includes(role)).length;
    const state = (want: AccessState) =>
      access.available ? users.filter((u) => accessStateOf(access.byUser[u.id]) === want).length : 0;

    const neverIn = access.available
      ? users.filter((u) => {
          const s = accessStateOf(access.byUser[u.id]);
          return s === "none" || s === "invited" || s === "stale";
        }).length
      : 0;
    const revoked = state("revoked");

    return [
      { label: "Accounts", value: users.length, footnote: "with a profile", mark: "accounts" },
      { label: "Admins", value: counts("admin"), footnote: "full access", mark: "admins" },
      {
        label: "Never signed in",
        value: access.available ? neverIn : "Unknown",
        footnote: access.available ? "invited or without an account" : "we can't read sign ins right now",
        mark: neverIn ? "overdue" : "ontrack",
      },
      {
        label: "Access removed",
        value: access.available ? revoked : "Unknown",
        footnote: revoked ? "can't sign in" : "nobody blocked",
        mark: "accounts",
      },
    ];
  })();

  const columns: DataColumn<UserWithRoles>[] = [
    {
      key: "full_name",
      label: "User",
      width: 240,
      render: (u) => (
        <Stack gap={2}>
          <Text size="sm" fw={500}>
            {u.full_name || "(no name)"}
          </Text>
          {u.email ? (
            <Anchor size="xs" c="dimmed" href={`mailto:${u.email}`} onClick={(e) => e.stopPropagation()}>
              {u.email}
            </Anchor>
          ) : (
            <Text size="xs" c="dimmed">
              no email
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "contact",
      label: "Contact",
      width: 90,
      sortable: false,
      filterable: false,
      render: (u) => (
        <ContactCell email={u.email} phone={u.phone} owner={u.full_name || "This user"} />
      ),
    },
    {
      // One cell, not four columns of checkboxes. It says what this person may
      // do; changing it opens the editor, where the change is read back before
      // it is written.
      key: "roles",
      label: "Roles",
      width: 260,
      filterValue: (u) =>
        u.roles.length ? u.roles.map((r) => ROLE_META[r].label).sort().join(", ") : "No role",
      render: (u) => (
        <span className={styles.roleChips}>
          {u.roles.length ? (
            u.roles.map((role) => (
              <Badge key={role} tone={role === "admin" ? "info" : "neutral"}>
                {ROLE_META[role].label}
              </Badge>
            ))
          ) : (
            <Badge tone="warning" dot>
              No role
            </Badge>
          )}
        </span>
      ),
    },
    {
      // Roles answer "what may this person do?". This column answers the
      // question that comes first: can they get in at all?
      key: "access",
      label: "Access",
      width: 150,
      filterValue: (u) => ACCESS_META[stateOf(u)].label,
      sortValue: (u) => ACCESS_RANK[stateOf(u)],
      render: (u) => (
        <AccessBadge
          state={stateOf(u)}
          inviteCount={access.byUser[u.id]?.invite_count}
        />
      ),
    },
    {
      // Already loaded with the access map and, until now, thrown away. It is
      // the one fact that ages an account: a year of silence is a question.
      key: "last_sign_in",
      label: "Last signed in",
      width: 140,
      filterValue: (u) => access.byUser[u.id]?.last_sign_in_at ?? "",
      render: (u) => {
        const at = access.byUser[u.id]?.last_sign_in_at ?? null;
        if (!access.available) return <Text size="sm" c="dimmed">Unknown</Text>;
        return (
          <span title={at ? formatDateTime(at) : "This account has never been used"}>
            {at ? (
              <Text size="sm">{relativeDate(at)}</Text>
            ) : (
              <Text size="sm" c="dimmed">
                Never
              </Text>
            )}
          </span>
        );
      },
    },
    {
      key: "created_at",
      label: "Created",
      width: 120,
      muted: true,
      render: (u) => formatDate(u.created_at),
    },
    {
      key: "actions",
      label: "",
      width: 60,
      align: "right",
      sortable: false,
      filterable: false,
      render: (u) => (
        <AccessMenu
          userId={u.id}
          name={u.full_name || "this user"}
          email={u.email}
          access={access.byUser[u.id]}
          available={access.available}
          onChanged={() => void load()}
        />
      ),
    },
  ];

  const FILTERS: Array<{ value: RoleFilter; label: string }> = [
    { value: "all", label: "Everyone" },
    ...ALL_ROLES.map((role) => ({ value: role as RoleFilter, label: ROLE_META[role].label })),
    { value: "none", label: "No role" },
  ];

  return (
    <Stack className={styles.page}>
      <PageHeader
        title="Users and roles"
        subtitle="Who can sign in, and what each account is allowed to do."
      />

      <TableSection
        kpis={kpis}
        columns={columns}
        rows={visible}
        controls={
          <span className={styles.roleChips}>
            {FILTERS.map((filter) => (
              <LumenButton
                key={filter.value}
                variant={roleFilter === filter.value ? "secondary" : "ghost"}
                onClick={() => setRoleFilter(filter.value)}
              >
                {filter.label}
              </LumenButton>
            ))}
          </span>
        }
        onRowClick={(u) => setEditing(u)}
        emptyTitle={roleFilter === "all" ? "No accounts yet" : "Nobody with that role"}
        emptyDescription={
          roleFilter === "all"
            ? "Accounts appear here once somebody is invited from Teachers or Donors."
            : "Choose another role, or Everyone, to see the rest of the directory."
        }
        emptyIcon="users"
      />

      <RoleEditorDrawer
        opened={editing !== null}
        onClose={() => setEditing(null)}
        userId={editing?.id ?? null}
        name={editing?.full_name || "this user"}
        email={editing?.email ?? null}
        roles={editing?.roles ?? []}
        onSaved={() => void load()}
      />
    </Stack>
  );
};

export default AdminUsersRolesPage;
