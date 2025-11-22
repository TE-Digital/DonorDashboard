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

export const WelcomeSetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const branding = useBranding();

  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session?.user) {
        console.error("Error checking session on welcome:", error);
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

    if (!newPassword) {
      setError("Please enter a password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error("updateUser error (welcome):", error);
        setError(error.message ?? "Could not set password.");
        return;
      }

      setMessage(
        "Your password has been set. You can now use it to log in with your email."
      );
    } finally {
      setUpdating(false);
    }
  };

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#edf2ff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: branding.font_family,
          padding: "2rem",
        }}
      >
        <Stack align="center">
          <Text fw={700} fz={28}>
            {branding.hero_title ?? "iCare Donor Dashboard"}
          </Text>
          <Text c="dimmed">Preparing your welcome page…</Text>
        </Stack>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#edf2ff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: branding.font_family,
      }}
    >
      <Container size={420}>
        <Stack align="center" gap="xs" mb="md">
          {branding.logo_url && (
            <Image
              src={branding.logo_url}
              height={48} // smaller logo
              fit="contain"
              alt={branding.hero_title ?? "Logo"}
            />
          )}
          <Text fw={700} fz={28}>
            {branding.hero_title ?? "iCare Donor Dashboard"}
          </Text>
          <Text fz="sm" c="dimmed" ta="center">
            Welcome! Please choose a password to complete your account setup.
          </Text>
          {email && (
            <Text fz="sm" c="dimmed">
              Account: <strong>{email}</strong>
            </Text>
          )}
        </Stack>

        <Card withBorder shadow="sm" radius="md" p="lg">
          <form onSubmit={handleSetPassword}>
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
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.currentTarget.value)}
              />

              <PasswordInput
                label="Confirm password"
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
                Back to login
              </Button>
            </Stack>
          </form>
        </Card>
      </Container>
    </div>
  );
};

export default WelcomeSetPasswordPage;
