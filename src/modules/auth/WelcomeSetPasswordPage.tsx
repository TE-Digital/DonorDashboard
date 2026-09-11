import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  Container,
  PasswordInput,
  Stack,
  Text,
  Image,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useBranding } from "../theme/BrandingContext";
import { color,
  useDocumentTitle,
} from "../../design-system";
import classes from "./AuthSurface.module.scss";
import {
  errorSummary,
  fieldId,
  firstError,
  focusField,
  hasErrors,
  type FieldErrors,
} from "../../design-system";

/** Namespaces this form's field ids. */
const FORM_ID = "welcome-password";

type PasswordField = "password" | "confirm";
const PASSWORD_FIELD_ORDER: readonly PasswordField[] = ["password", "confirm"];

export const WelcomeSetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const branding = useBranding();

  useDocumentTitle("Set your password");

  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<PasswordField>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session?.user) {
        // Arriving here without a session is the ordinary case — somebody
        // opened /welcome directly, or the invite link has already been used.
        // Only a real failure from Supabase is worth the console.
        if (error) console.error("Error checking session on welcome:", error);
        navigate("/login", { replace: true });
        return;
      }

      setEmail(data.session.user.email ?? null);
      setChecking(false);
    };

    checkSession();
  }, [navigate]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const problems: FieldErrors<PasswordField> = {};
    if (!newPassword || newPassword.length < 8) {
      problems.password = "Use at least 8 characters.";
    }
    if (newPassword !== confirmPassword) {
      problems.confirm = "The two passwords don't match.";
    }
    setFieldErrors(problems);

    if (hasErrors(problems)) {
      setError(errorSummary(problems));
      focusField(FORM_ID, firstError(problems, PASSWORD_FIELD_ORDER));
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error("updateUser error (welcome):", error);
        setError("We couldn't set your password. Try again.");
        return;
      }

      setMessage(
        "Your password is set. You can now use it to sign in with your email."
      );
    } finally {
      setUpdating(false);
    }
  };

  if (checking) {
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
            {branding.hero_title ?? "Donor Dashboard"}
          </Text>
          <Text c="dimmed">Getting your welcome page ready…</Text>
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
        <Stack align="center" gap="xs" className={classes.header}>
          {branding.logo_url && (
            <Image
              src={branding.logo_url}
              height={48} // smaller logo
              fit="contain"
              alt={branding.hero_title ?? "Logo"}
              className={classes.logo}
            />
          )}
          <Text fw={700} fz={28} className={classes.title}>
            {branding.hero_title ?? "Donor Dashboard"}
          </Text>
          <Text fz="sm" c="dimmed" ta="center" className={classes.subtitle}>
            Choose a password to get started.
          </Text>
          {email && (
            <Text fz="sm" c="dimmed">
              Account: <strong>{email}</strong>
            </Text>
          )}
        </Stack>

        <Card withBorder shadow="sm" radius="md" p="lg" className={classes.card}>
          <form onSubmit={handleSetPassword} noValidate>
            <Stack gap="sm">
              {error && (
                <Text c="red" fz="sm">
                  {error}
                </Text>
              )}
              {message && (
                <Text c="green" fz="sm">
                  {message}
                </Text>
              )}

              <PasswordInput
                label="Password"
                id={fieldId(FORM_ID, "password")}
                error={fieldErrors.password}
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.currentTarget.value)}
              />

              <PasswordInput
                label="Confirm password"
                id={fieldId(FORM_ID, "confirm")}
                error={fieldErrors.confirm}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.currentTarget.value)}
              />

              <Button type="submit" loading={updating}>
                Save password
              </Button>

              <Button
                variant="subtle"
                type="button"
                onClick={() => navigate("/login")}
              >
                Back to sign in
              </Button>
            </Stack>
          </form>
        </Card>
      </Container>
    </div>
  );
};

export default WelcomeSetPasswordPage;
