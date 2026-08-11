// src/modules/auth/AcceptInvitePage.tsx
import React, { useEffect, useState } from "react";
import {
  Card,
  Stack,
  Text,
  TextInput,
  Button,
  PasswordInput,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "./AuthContext"; // adjust path if needed
import { LoadingState } from "../../design-system";
import classes from "./AuthSurface.module.scss";

export const AcceptInvitePage: React.FC = () => {
  const navigate = useNavigate();
  const { session, refreshProfile } = useAuth(); // or whatever your context exposes

  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Make sure Supabase has had a chance to hydrate the session from the URL
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError(
          "Could not find a valid invite session. Please try the link again or contact support."
        );
      }
      setChecking(false);
    };
    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || password.length < 8) {
      setError("Please choose a password with at least 8 characters.");
      return;
    }
    if (password !== password2) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      console.error(updateError);
      setError("Could not set password. Please try again.");
      setSaving(false);
      return;
    }

    // Optional: refresh profile in your AuthContext, if you have one
    try {
      await refreshProfile?.();
    } catch {
      // ignore
    }

    setSaving(false);
    // Redirect donor to their dashboard (adjust route as needed)
    navigate("/donor");
  };

  if (checking) {
    return (
      <Card
        withBorder
        shadow="sm"
        radius="md"
        p="lg"
        className={`${classes.card} ${classes.inviteCard}`}
      >
        <LoadingState variant="overlay" />
        <Text size="sm">Checking your invite link…</Text>
      </Card>
    );
  }

  return (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      p="lg"
      className={`${classes.card} ${classes.inviteCard}`}
      style={{ maxWidth: 420, margin: "40px auto" }}
    >
      <Stack gap="md">
        <Text fw={600}>Welcome – set your password</Text>
        <Text size="sm" c="dimmed">
          Your email has been verified. Please choose a password to complete your
          account setup.
        </Text>

        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}

        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <PasswordInput
              label="New password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Confirm password"
              value={password2}
              onChange={(e) => setPassword2(e.currentTarget.value)}
              required
            />

            <Button type="submit" loading={saving} mt="sm" fullWidth>
              Save password and continue
            </Button>
          </Stack>
        </form>
      </Stack>
    </Card>
  );
};
