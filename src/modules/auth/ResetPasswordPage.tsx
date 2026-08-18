import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  Container,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Image,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useBranding } from "../theme/BrandingContext";
import { color } from "../../design-system";
import classes from "./AuthSurface.module.scss";

type Mode = "checking" | "request" | "reset";

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const branding = useBranding();

  const [mode, setMode] = useState<Mode>("checking");

  // request-link state
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // reset-password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Decide which mode we are in:
  // - if a session exists -> let the user set a new password
  // - otherwise -> show "request reset link" form
  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error checking session on reset-password:", error);
        setMode("request");
        return;
      }

      if (data.session?.user) {
        // User arrived with recovery link or is logged in already
        setMode("reset");
        setEmail(data.session.user.email ?? "");
      } else {
        setMode("request");
      }
    };

    checkSession();
  }, []);

  // ---------- handlers ----------

  const handleRequestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setRequestError(null);
    setRequestMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error("resetPasswordForEmail error:", error);
        setRequestError(error.message ?? "Could not send reset email.");
      } else {
        setRequestMessage(
          "If this email exists in our system, a reset link has been sent. Please check your inbox."
        );
      }
    } finally {
      setSending(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetMessage(null);

    if (!newPassword) {
      setResetError("Please enter a new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    setUpdating(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error("updateUser error:", error);
        setResetError(error.message ?? "Could not update password.");
        return;
      }

      setResetMessage("Your password has been updated successfully.");
    } finally {
      setUpdating(false);
    }
  };

  // ---------- UI helpers ----------

  const renderHeader = () => (
    <Stack align="center" gap="xs" className={classes.header}>
      {branding.logo_url && (
        <Image
          src={branding.logo_url}
          height={80}
          fit="contain"
          alt={branding.hero_title ?? "Logo"}
          className={classes.logo}
        />
      )}
      <Text fw={700} fz={28} className={classes.title}>
        {branding.hero_title ?? "iCare Donor Dashboard"}
      </Text>
      <Text fz="sm" c="dimmed" ta="center" className={classes.subtitle}>
        {mode === "reset"
          ? "Choose a new password for your account."
          : "Enter your email and we will send you a password reset link."}
      </Text>
    </Stack>
  );

  // ---------- render ----------

  if (mode === "checking") {
    // same style as branded loading
    return (
      <div
        className={classes.page}
        style={{
          minHeight: "100vh",
          backgroundColor: color.surface.auth,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: branding.font_family,
          padding: "2rem",
        }}
      >
        <Stack align="center">
          <Text fw={700} fz={28} className={classes.title}>
            {branding.hero_title ?? "iCare Donor Dashboard"}
          </Text>
          <Text c="dimmed">Preparing password reset page…</Text>
        </Stack>
      </div>
    );
  }

  return (
    <div
      className={classes.page}
      style={{
        minHeight: "100vh",
        backgroundColor: color.surface.auth,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: branding.font_family,
      }}
    >
      <Container size={420} className={classes.container}>
        {renderHeader()}

        <Card withBorder shadow="sm" radius="md" p="lg" className={classes.card}>
          {mode === "request" && (
            <form onSubmit={handleRequestLink}>
              <Stack gap="sm">
                {requestError && (
                  <Text c="red" fz="sm">
                    {requestError}
                  </Text>
                )}
                {requestMessage && (
                  <Text c="green" fz="sm">
                    {requestMessage}
                  </Text>
                )}

                <TextInput
                  label="Email"
                  required
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                />

                <Button type="submit" loading={sending}>
                  Send reset link
                </Button>

                <Button
                  variant="subtle"
                  type="button"
                  onClick={() => navigate("/login")}
                >
                  Back to login
                </Button>
              </Stack>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleResetPassword}>
              <Stack gap="sm">
                {resetError && (
                  <Text c="red" fz="sm">
                    {resetError}
                  </Text>
                )}
                {resetMessage && (
                  <Text c="green" fz="sm">
                    {resetMessage}
                  </Text>
                )}

                <PasswordInput
                  label="New password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.currentTarget.value)}
                  visibilityToggleIcon={({ reveal }) =>
                    reveal ? (
                      <span style={{ fontSize: "var(--fs-xs)" }}>Hide password</span>
                    ) : (
                      <span style={{ fontSize: "var(--fs-xs)" }}>Show password</span>
                    )
                  }
                />

                <PasswordInput
                  label="Confirm new password"
                  required
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.currentTarget.value)
                  }
                  visibilityToggleIcon={({ reveal }) =>
                    reveal ? (
                      <span style={{ fontSize: "var(--fs-xs)" }}>Hide password</span>
                    ) : (
                      <span style={{ fontSize: "var(--fs-xs)" }}>Show password</span>
                    )
                  }
                />

                <Button type="submit" loading={updating}>
                  Save new password
                </Button>

                <Button
                  variant="subtle"
                  type="button"
                  onClick={() => navigate("/login")}
                >
                  Back to login
                </Button>
              </Stack>
            </form>
          )}
        </Card>
      </Container>
    </div>
  );
};
