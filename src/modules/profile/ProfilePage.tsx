// src/modules/profile/ProfilePage.tsx
import React, { useEffect, useState } from "react";
import {
  Stack,
  Text,
  TextInput,
  Group,
  Button,
  PasswordInput,
} from "@mantine/core";
import { supabase } from "../../lib/supabaseClient";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  InlineMessage,
  LoadingState,
  PageHeader,
  errorSummary,
  fieldId,
  firstError,
  focusField,
  hasErrors,
  isEmail,
  type FieldErrors,
} from "../../design-system";
import { toFriendlyError } from "../../i18n/errors";

/** Namespaces this form's field ids. */
const FORM_ID = "my-profile";

type ProfileField = "email" | "newPassword" | "confirmPassword";
const PROFILE_FIELD_ORDER: readonly ProfileField[] = ["email", "newPassword", "confirmPassword"];

export const ProfilePage: React.FC = () => {
  const { session, role, loading: authLoading } = useAuth();

  const [searchParams] = useSearchParams();
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<ProfileField>>({});

  // Determine which user we're editing and load their profile
  useEffect(() => {
    const load = async () => {
      if (authLoading) return; // wait for auth to finish

      setLoading(true);
      setError(null);
      setMessage(null);

      if (!session?.user) {
        setError("You're not signed in.");
        setLoading(false);
        return;
      }

      const loggedInUserId = session.user.id;
      const requestedUserId = searchParams.get("userId");

      const effectiveUserId =
        role === "admin" && requestedUserId
          ? requestedUserId
          : loggedInUserId;

      setTargetUserId(effectiveUserId);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, phone, email")
        .eq("id", effectiveUserId)
        .maybeSingle();

      if (profileError) {
        setError(toFriendlyError(profileError, "errors.load", "loadProfile"));
        setLoading(false);
        return;
      }

      if (!profile) {
        setError("We couldn't find this profile.");
        setLoading(false);
        return;
      }

      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setEmail(profile.email ?? "");

      setLoading(false);
    };

    load();
  }, [session, role, authLoading, searchParams]);

  const isOwnProfile =
    !!session?.user && targetUserId === session.user.id;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId) return;

    setSavingProfile(true);
    setError(null);
    setMessage(null);

    const trimmedEmail = email.trim();

    try {
      // If user is editing their own profile, also update auth email
      if (isOwnProfile) {
        // Marked on the field. `includes("@")` accepted "a@b" and rejected
        // nothing else; the shared check is the one every other form uses.
        const problem = !trimmedEmail
          ? "Add an email address. It's how you sign in."
          : !isEmail(trimmedEmail)
            ? "Enter a complete email address, for example name@example.com."
            : null;

        if (problem) {
          setFieldErrors((current) => ({ ...current, email: problem }));
          setError("One field needs attention before this can be saved.");
          focusField(FORM_ID, "email");
          setSavingProfile(false);
          return;
        }
        setFieldErrors((current) => ({ ...current, email: undefined }));

        const { error: authError } = await supabase.auth.updateUser({
          email: trimmedEmail,
        });

        if (authError) {
          setError(toFriendlyError(authError, "errors.save", "updateAuthEmail"));
          setSavingProfile(false);
          return;
        }
      }

      // Update profile row (always), keeping email in sync for own profile
      const updatePayload: {
        full_name: string;
        phone: string;
        email?: string;
      } = {
        full_name: fullName,
        phone,
      };

      if (isOwnProfile) {
        updatePayload.email = trimmedEmail;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", targetUserId);

      if (updateError) {
        setError(toFriendlyError(updateError, "errors.save", "updateProfile"));
        setSavingProfile(false);
        return;
      }

      // If this user is also a donor, keep donor.email AND donor.contact.email in sync.
      if (isOwnProfile) {
        try {
          const { data: donorRow, error: donorFetchError } = await supabase
            .from("donors")
            .select("id, contact, email")
            .eq("user_id", targetUserId)
            .maybeSingle();

          if (donorFetchError) {
            console.error("Error loading donor for email sync", donorFetchError);
          } else if (donorRow) {
            const currentContact =
              (donorRow as any).contact && typeof (donorRow as any).contact === "object"
                ? (donorRow as any).contact
                : {};

            const updatedContact = {
              ...currentContact,
              email: trimmedEmail,
            };

            const { error: donorUpdateError } = await supabase
              .from("donors")
              .update({
                email: trimmedEmail,      // top-level donor email
                contact: updatedContact,  // JSON contact.email
              })
              .eq("id", donorRow.id);

            if (donorUpdateError) {
              console.error("Error syncing donor email", donorUpdateError);
              // We don't abort the whole flow, just show a softer message
              setMessage(
                "Your profile is saved, but we couldn't update the email on your donor profile. Ask us to change it for you."
              );
              setSavingProfile(false);
              return;
            }
          }
        } catch (innerErr) {
          console.error("Unexpected error syncing donor email", innerErr);
          // Still treat main profile update as success
        }
      }

      setMessage("Your profile is saved.");
    } catch (err: any) {
      setError(toFriendlyError(err, "errors.save", "updateProfile"));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnProfile) return; // safety guard

    setSavingPassword(true);
    setError(null);
    setMessage(null);

    const problems: FieldErrors<ProfileField> = {};
    if (!newPassword || newPassword.length < 6) {
      problems.newPassword = "Use at least 6 characters.";
    }
    if (newPassword !== newPasswordConfirm) {
      problems.confirmPassword = "The two passwords don't match.";
    }
    setFieldErrors((current) => ({ ...current, ...problems }));

    if (hasErrors(problems)) {
      setError(errorSummary(problems));
      focusField(FORM_ID, firstError(problems, PROFILE_FIELD_ORDER));
      setSavingPassword(false);
      return;
    }

    const { error: pwError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (pwError) {
      setError(toFriendlyError(pwError, "errors.save", "updatePassword"));
    } else {
      setMessage("Your new password is saved. Use it next time you sign in.");
      setNewPassword("");
      setNewPasswordConfirm("");
    }

    setSavingPassword(false);
  };

  const heading =
    isOwnProfile || !session?.user
      ? "My profile"
      : "Edit profile";

  const subtitle = isOwnProfile
    ? "Update your contact details, email and password."
    : "You're editing this person's contact details as an admin.";

  return (
    <div style={{ position: "relative" }}>
      <LoadingState variant="overlay" visible={loading} />
      <Stack gap="lg">
        <PageHeader title={heading} subtitle={subtitle} />

        <InlineMessage tone="error">{error}</InlineMessage>
        <InlineMessage tone="success">{message}</InlineMessage>

        {/* Contact details */}
        <form onSubmit={handleSaveProfile}>
          <Stack gap="sm">
            <Text fw={500} size="sm">
              Contact details
            </Text>

            <TextInput
              label="Email"
              id={fieldId(FORM_ID, "email")}
              error={fieldErrors.email}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              disabled={!isOwnProfile}
            />

            <TextInput
              label="Full name"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.currentTarget.value)}
            />

            <TextInput
              label="Phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
            />

            <Group justify="flex-end" mt="xs">
              <Button type="submit" loading={savingProfile}>
                Save profile
              </Button>
            </Group>
          </Stack>
        </form>

        {/* Password change – only for own profile */}
        {isOwnProfile && (
          <form onSubmit={handleChangePassword}>
            <Stack gap="sm">
              <Text fw={500} size="sm">
                Change password
              </Text>

              <PasswordInput
                label="New password"
                id={fieldId(FORM_ID, "newPassword")}
                error={fieldErrors.newPassword}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.currentTarget.value)}
              />

              <PasswordInput
                label="Confirm new password"
                id={fieldId(FORM_ID, "confirmPassword")}
                error={fieldErrors.confirmPassword}
                autoComplete="new-password"
                value={newPasswordConfirm}
                onChange={(e) =>
                  setNewPasswordConfirm(e.currentTarget.value)
                }
              />

              <Group justify="flex-end" mt="xs">
                <Button
                  type="submit"
                  loading={savingPassword}
                  variant="outline"
                >
                  Update password
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Stack>
    </div>
  );
};

export default ProfilePage;
