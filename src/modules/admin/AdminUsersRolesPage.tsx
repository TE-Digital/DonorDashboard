// src/modules/admin/AdminUsersRolesPage.tsx
import React, { useEffect, useState } from "react";
import { supabase, Profile } from "../../lib/supabaseClient";
import {
  Card,
  Stack,
  Text,
  Group,
  Button,
  Anchor,
  Badge,
  ActionIcon,
  Table,
  Loader,
  Checkbox,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { IconPencil } from "@tabler/icons-react";

type UiRole = "admin" | "teacher" | "donor" | "agent";

interface UserWithRoles extends Profile {
  roles: UiRole[];
  email?: string | null;
}

const ALL_ROLES: UiRole[] = ["admin", "teacher", "donor", "agent"];

export const AdminUsersRolesPage: React.FC = () => {
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
        role: p.role, // legacy column, not used in UI
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
    return <Loader />;
  }

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Text fw={700} size="lg">
          Users &amp; roles
        </Text>
        {saving && (
          <Badge color="blue" variant="light">
            Saving…
          </Badge>
        )}
      </Group>

      <Card withBorder shadow="xs" radius="md">
        {users.length === 0 ? (
          <Text size="sm" c="dimmed">
            No users found.
          </Text>
        ) : (
          <Table
            striped
            highlightOnHover
            verticalSpacing="xs"
            horizontalSpacing="md"
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>User</Table.Th>
                <Table.Th>Phone</Table.Th>
                <Table.Th>Created</Table.Th>
                {ALL_ROLES.map((r) => (
                  <Table.Th
                    key={r}
                    style={{ textTransform: "capitalize", textAlign: "center" }}
                  >
                    {r}
                  </Table.Th>
                ))}
                <Table.Th style={{ width: 60, textAlign: "center" }}>
                  Edit
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((u) => (
                <Table.Tr key={u.id}>
                  {/* User + email */}
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="sm" fw={500}>
                        {u.full_name || "(no name)"}
                      </Text>
                      {u.email ? (
                        <Anchor
                          size="xs"
                          c="dimmed"
                          href={`mailto:${u.email}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {u.email}
                        </Anchor>
                      ) : (
                        <Text size="xs" c="dimmed">
                          no email
                        </Text>
                      )}
                    </Stack>
                  </Table.Td>

                  {/* Phone */}
                  <Table.Td>
                    <Text size="sm">{u.phone || "—"}</Text>
                  </Table.Td>

                  {/* Created */}
                  <Table.Td>
                    <Text size="sm">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString()
                        : "—"}
                    </Text>
                  </Table.Td>

                  {/* Roles */}
                  {ALL_ROLES.map((role) => (
                    <Table.Td key={role} style={{ textAlign: "center" }}>
                      <Checkbox
                        size="xs"
                        checked={u.roles.includes(role)}
                        onChange={(e) =>
                          toggleRole(u.id, role, e.currentTarget.checked)
                        }
                      />
                    </Table.Td>
                  ))}

                  {/* Edit profile */}
                  <Table.Td style={{ textAlign: "center" }}>
                    <ActionIcon
                      component={Link}
                      to={`/profile?userId=${u.id}`}
                      variant="subtle"
                      aria-label="Edit profile"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Group justify="flex-end">
        <Button component={Link} to="/admin/users/new" size="sm" variant="outline">
          Create user
        </Button>
      </Group>
    </Stack>
  );
};

export default AdminUsersRolesPage;



