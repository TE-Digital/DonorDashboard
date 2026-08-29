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
import { InlineMessage, isEmail, textRole, useDocumentTitle } from "../../design-system";
import type { FieldErrors } from "../../design-system/fieldValidation";
import { color } from "../../design-system";
import classes from "./AuthSurface.module.scss";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const branding = useBranding();

  useDocumentTitle("Sign in");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<"email" | "password">>({});

  useEffect(() => {
    if (session) navigate("/");
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // The form is noValidate, so this is the only validation: the browser's
    // own bubble is unstyled, disappears on the next click and is not reliably
    // announced, and every other form in the product answers on the field.
    const problems: FieldErrors<"email" | "password"> = {};
    if (!email.trim()) {
      problems.email = "Enter the email address you sign in with.";
    } else if (!isEmail(email)) {
      problems.email = "That does not look like an email address.";
    }
    if (!password) problems.password = "Enter your password.";

    setFieldErrors(problems);
    if (Object.keys(problems).length) {
      setError(null);
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) setError(signInError.message);
    setSubmitting(false);
  };

  /** A field stops being wrong the moment it is edited. */
  const clear = (key: "email" | "password") =>
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

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
          <form onSubmit={handleSubmit} noValidate>
            <Stack gap="sm">
              <InlineMessage tone="error">{error}</InlineMessage>

              <TextInput
                label="Email"
                autoComplete="username"
                required
                type="email"
                placeholder="you@example.com"
                error={fieldErrors.email}
                value={email}
                onChange={(e) => {
                  clear("email");
                  setEmail(e.currentTarget.value);
                }}
              />

              <PasswordInput
                label="Password"
                autoComplete="current-password"
                required
                placeholder="Your password"
                error={fieldErrors.password}
                value={password}
                onChange={(e) => {
                  clear("password");
                  setPassword(e.currentTarget.value);
                }}
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
