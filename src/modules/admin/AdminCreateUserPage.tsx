// src/modules/admin/AdminCreateUserPage.tsx
import React, { useState } from "react";
import {
  Stack,
  Text,
  TextInput,
  Group,
  Button,
  Switch,
  Alert,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../auth/AuthContext";
import {
  LoadingState,
} from "../../design-system";

type UiRole = "admin" | "teacher" | "donor" | "agent";

const ALL_ROLES: UiRole[] = ["admin", "teacher", "donor", "agent"];

export const AdminCreateUserPage: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [roles, setRoles] = useState<Record<UiRole, boolean>>({
    admin: false,
    teacher: false,
    donor: false,
    agent: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleToggleRole = (role: UiRole, checked: boolean) => {
    setRoles((prev) => ({ ...prev, [role]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const selectedRoles = ALL_ROLES.filter((r) => roles[r]);

    if (!fullName || !email) {
      setSubmitting(false);
      setError("Full name and email are required.");
      return;
    }

    if (selectedRoles.length === 0) {
      setSubmitting(false);
      setError("Select at least one role.");
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      setSubmitting(false);
      setError("VITE_SUPABASE_URL is not configured.");
      return;
    }

    // Typed as a plain string map: without the annotation the ternary widens
    // to a union whose second branch has no `Authorization` key, which does
    // not satisfy fetch's HeadersInit.
    const authHeader: Record<string, string> =
      session?.access_token != null
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader,
          },
          body: JSON.stringify({
            email,
            full_name: fullName,
            phone: phone || null,
            roles: selectedRoles,
          }),
        }
      );

      if (!response.ok) {
        const txt = await response.text();
        console.error("admin-create-user function error:", txt);

        setError(
          "User could NOT be created. The server returned an error. See console for details."
        );

        notifications.show({
          title: "User not created",
          message: "The server rejected the request.",
          color: "red",
        });
        return;
      }

      setMessage("User created successfully. Invitation email sent.");
      notifications.show({
        title: "User created",
        message: "The user has been created and invited via email.",
        color: "green",
      });
    } catch (err: any) {
      console.error("Unexpected error calling admin-create-user", err);
      setError(
        err?.message ?? "Unexpected error: Could not reach the server."
      );

      notifications.show({
        title: "Network error",
        message:
          "Failed to reach the server. Function may not be deployed or reachable.",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <LoadingState variant="overlay" visible={submitting} />

      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <Text fw={700} size="lg">
            Create user
          </Text>

          {message && (
            <Alert color="green" variant="light">
              {message}
            </Alert>
          )}

          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}

          <TextInput
            label="Full name"
            placeholder="Jane Doe"
            required
            value={fullName}
            onChange={(e) => setFullName(e.currentTarget.value)}
          />

          <TextInput
            label="Email"
            placeholder="user@example.com"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />

          <TextInput
            label="Phone"
            placeholder="+66 ..."
            value={phone}
            onChange={(e) => setPhone(e.currentTarget.value)}
          />

          {/* FIXED ROLE SECTION */}
          <Stack gap="xs">
            <Text fw={600}>Roles</Text>

            <Group gap="lg" wrap="wrap">
              {ALL_ROLES.map((role) => (
                <Switch
                  key={role}
                  size="md"
                  label={role.charAt(0).toUpperCase() + role.slice(1)}
                  checked={roles[role]}
                  onChange={(e) =>
                    handleToggleRole(role, e.currentTarget.checked)
                  }
                  styles={{
                    body: {
                      display: "flex",
                      alignItems: "center",
                    },
                  }}
                />
              ))}
            </Group>
          </Stack>
	         <Group justify="space-between" mt="xl">
 	 <Button
  	  variant="subtle"
   	 type="button"
   	 onClick={() => navigate("/admin/users")}
 	 >
    Cancel
  </Button>
  <Button type="submit" loading={submitting}>
    Create & Send Invite
  </Button>
</Group>
        </Stack>
      </form>
    </div>
  );
};


