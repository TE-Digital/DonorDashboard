// src/modules/admin/AdminUsersRolesPage.tsx
import React, { useEffect, useState } from "react";
import { supabase, Profile } from "../../lib/supabaseClient";
import { Anchor, Checkbox, Stack, Text } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { ContactCell, LoadingState, PageHeader, TableSection, type TableKpi } from "../../design-system";
import { Badge, Button as LumenButton, type DataColumn } from "../../design-system/lumen";
import { AccessBadge, AccessMenu } from "./AccessActions";
import { ACCESS_META, accessStateOf, loadAccessMap, type AccessMap } from "./userAccess";

type UiRole = "admin" | "teacher" | "donor" | "agent";

// `email` is already on Profile — redeclaring it here as optional made this
// interface incompatible with the one it extends.
interface UserWithRoles extends Profile {
  roles: UiRole[];
}

const ALL_ROLES: UiRole[] = ["admin", "teacher", "donor", "agent"];

export const AdminUsersRolesPage: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  /** Who can actually sign in. Roles say what a person may do; this says whether they can. */
  const [access, setAccess] = useState<AccessMap>({ byUser: {}, available: false, error: null });
  const [saving, setSaving] = useState(false);

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

  const toggleRole = async (userId: string, role: UiRole, checked: boolean) => {
    setSaving(true);

    if (checked) {
      // add role
      const { error } = await supabase
        .from("person_roles")
        .upsert(
          { user_id: userId, role },
          { onConflict: "user_id,role", ignoreDuplicates: true }
        );

      if (error) {
        console.error("Error adding role", error);
      }
    } else {
      // remove role
      const { error } = await supabase
        .from("person_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);

      if (error) {
        console.error("Error removing role", error);
      }
    }

    await load();
    setSaving(false);
  };

  if (loading) {
    return <LoadingState />;
  }

  const kpis: TableKpi[] = (() => {
    const counts = (role: UiRole) => users.filter((u) => u.roles.includes(role)).length;
    const noRole = users.filter((u) => u.roles.length === 0).length;
    return [
      { label: "Accounts", value: users.length, footnote: "with a profile", mark: "accounts" },
      { label: "Admins", value: counts("admin"), footnote: "full access", mark: "admins" },
      { label: "Teachers", value: counts("teacher"), footnote: "submit reports", mark: "teachers" },
      {
        label: "Without a role",
        value: noRole,
        footnote: noRole ? "cannot sign in anywhere" : "everyone assigned",
        mark: noRole ? "overdue" : "ontrack",
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
      // Roles answer "what may this person do?". This column answers the
      // question that comes first: can they get in at all?
      key: "access",
      label: "Sign-in",
      width: 150,
      filterValue: (u) => ACCESS_META[accessStateOf(access.byUser[u.id])].label,
      render: (u) => (
        <AccessBadge
          state={access.available ? accessStateOf(access.byUser[u.id]) : "unknown"}
          inviteCount={access.byUser[u.id]?.invite_count}
        />
      ),
    },
    {
      key: "created_at",
      label: "Created",
      width: 120,
      muted: true,
      render: (u) => (u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"),
    },
    // One column per role, each filterable on Yes/No so you can pull up
    // "everyone who is a teacher" from the header.
    ...ALL_ROLES.map<DataColumn<UserWithRoles>>((role) => ({
      key: `role_${role}`,
      label: role.charAt(0).toUpperCase() + role.slice(1),
      width: 96,
      align: "center",
      sortable: false,
      filterValue: (u) => (u.roles.includes(role) ? "Yes" : "No"),
      render: (u) => (
        <Checkbox
          size="xs"
          checked={u.roles.includes(role)}
          onChange={(e) => toggleRole(u.id, role, e.currentTarget.checked)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`${role} role for ${u.full_name ?? "user"}`}
        />
      ),
    })),
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

  return (
    <Stack>
      <PageHeader
        title="Users & roles"
        subtitle="Who can sign in, and what each account is allowed to do."
        actions={
          <>
            {saving && <Badge tone="info">Saving…</Badge>}
            <LumenButton variant="primary" icon="plus" onClick={() => navigate("/admin/users/new")}>Add user</LumenButton>
          </>
        }
      />

      <TableSection
        kpis={kpis}
        columns={columns}
        rows={users}
        emptyTitle="No users found"
        emptyDescription="Accounts appear here once someone is invited."
        emptyIcon="users"
      />
    </Stack>
  );
};

export default AdminUsersRolesPage;
