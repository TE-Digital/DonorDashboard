import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  Container,
  Stack,
  Text,
  TextInput,
  PasswordInput,
  Image,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "./AuthContext";
import { useBranding } from "../theme/BrandingContext";
import { InlineMessage, textRole } from "../../design-system";
import { color } from "../../design-system";
import classes from "./AuthSurface.module.scss";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const branding = useBranding();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) navigate("/");
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) setError(signInError.message);
    setSubmitting(false);
  };

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

          <Text {...textRole("metricValue")} className={classes.title}>
            {branding.login_title ?? "Welcome back"}
          </Text>

          <Text
            {...textRole("pageSubtitle")}
            ta="center"
            className={classes.subtitle}
          >
            {branding.login_subtitle ??
              "Sign in to manage students, donors and reports."}
          </Text>
        </Stack>

        <Card p="lg" className={classes.card}>
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              <InlineMessage tone="error">{error}</InlineMessage>

              <TextInput
                label="Email"
                required
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />

              <PasswordInput
                label="Password"
                required
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                // no custom "show/hide password" text – use Mantine default
              />

              <Stack gap="xs" mt="md">
                <Button type="submit" fullWidth loading={submitting}>
                  Sign in
                </Button>

                <Button
                  variant="subtle"
                  size="xs"
                  type="button"
                  onClick={() => navigate("/reset-password")}
                  style={{ alignSelf: "flex-start" }}
                >
                  Forgot password?
                </Button>
              </Stack>
            </Stack>
          </form>
        </Card>
      </Container>
    </div>
  );
};

export default LoginPage;
