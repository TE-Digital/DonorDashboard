// src/modules/admin/AdminUsersRolesPage.tsx
import React, { useEffect, useState } from "react";
import { supabase, Profile } from "../../lib/supabaseClient";
import { Anchor, Checkbox, Stack, Text } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { LoadingState, PageHeader, TableSection, type TableKpi } from "../../design-system";
import { Badge, Button as LumenButton, type DataColumn } from "../../design-system/lumen";

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
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);

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
      { label: "Accounts", value: users.length, footnote: "with a profile", accent: "blue" },
      { label: "Admins", value: counts("admin"), footnote: "full access", accent: "teal" },
      { label: "Teachers", value: counts("teacher"), footnote: "submit reports", accent: "amber" },
      {
        label: "Without a role",
        value: noRole,
        footnote: noRole ? "cannot sign in anywhere" : "everyone assigned",
        accent: "plum",
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
    { key: "phone", label: "Phone", width: 140, render: (u) => u.phone || "—" },
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
  ];

  return (
    <Stack>
      <PageHeader
        title="Users & roles"
        subtitle="Who can sign in, and what each account is allowed to do."
        actions={saving ? <Badge tone="info">Saving…</Badge> : undefined}
      />

      <TableSection
        kpis={kpis}
        columns={columns}
        rows={users}
        searchKeys={["full_name", "email", "phone"]}
        emptyTitle="No users found"
        emptyDescription="Accounts appear here once someone is invited."
        emptyIcon="users"
        actions={
          <LumenButton variant="primary" icon="plus" onClick={() => navigate("/admin/users/new")}>
            Add user
          </LumenButton>
        }
      />
    </Stack>
  );
};

export default AdminUsersRolesPage;
