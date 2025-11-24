// src/modules/profile/ProfilePage.tsx
import React, { useEffect, useState } from "react";
import {
  Card,
  Stack,
  Text,
  TextInput,
  Group,
  Button,
  PasswordInput,
  LoadingOverlay,
} from "@mantine/core";
import { supabase } from "../../lib/supabaseClient";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

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

  // Determine which user we're editing and load their profile
  useEffect(() => {
    const load = async () => {
      if (authLoading) return; // wait for auth to finish

      setLoading(true);
      setError(null);
      setMessage(null);

      if (!session?.user) {
        setError("You are not logged in.");
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
        console.error(profileError);
        setError("Could not load profile.");
        setLoading(false);
        return;
      }

      if (!profile) {
        setError("Profile not found.");
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
        if (!trimmedEmail) {
          setError("Email cannot be empty.");
          setSavingProfile(false);
          return;
        }

        // Basic sanity check; you can replace with stricter validation if needed
        if (!trimmedEmail.includes("@")) {
          setError("Please enter a valid email address.");
          setSavingProfile(false);
          return;
        }

        const { error: authError } = await supabase.auth.updateUser({
          email: trimmedEmail,
        });

        if (authError) {
          console.error("Error updating auth email", authError);
          setError(authError.message || "Could not update email.");
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
        console.error(updateError);
        setError(updateError.message);
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
                "Profile updated, but there was a problem syncing the donor contact email. Please contact an administrator if this persists."
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

      setMessage("Profile updated successfully.");
    } catch (err: any) {
      console.error("Unexpected error updating profile", err);
      setError(err.message ?? "Unexpected error while updating profile.");
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

    if (!newPassword || newPassword.length < 6) {
      setError("Password should have at least 6 characters.");
      setSavingPassword(false);
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError("Passwords do not match.");
      setSavingPassword(false);
      return;
    }

    const { error: pwError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (pwError) {
      console.error(pwError);
      setError(pwError.message);
    } else {
      setMessage("Password updated successfully.");
      setNewPassword("");
      setNewPasswordConfirm("");
    }

    setSavingPassword(false);
  };

  const heading =
    isOwnProfile || !session?.user
      ? "My profile"
      : "Edit user profile";

  const subtitle = isOwnProfile
    ? "Update your contact details, email and password."
    : "You are editing this user's contact details as an admin.";

  return (
    <Card withBorder pos="relative">
      <LoadingOverlay visible={loading} />
      <Stack gap="lg">
        <div>
          <Text fw={700} size="lg" mb={4}>
            {heading}
          </Text>
          <Text size="sm" c="dimmed">
            {subtitle}
          </Text>
        </div>

        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}
        {message && (
          <Text size="sm" c="green">
            {message}
          </Text>
        )}

        {/* Contact details */}
        <form onSubmit={handleSaveProfile}>
          <Stack gap="sm">
            <Text fw={500} size="sm">
              Contact details
            </Text>

            <TextInput
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              disabled={!isOwnProfile}
              description={
                isOwnProfile
                  ? "This email is used for login and donor communication."
                  : "Email is managed via authentication and can only be changed by the user."
              }
            />

            <TextInput
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.currentTarget.value)}
            />

            <TextInput
              label="Phone"
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
                value={newPassword}
                onChange={(e) => setNewPassword(e.currentTarget.value)}
              />

              <PasswordInput
                label="Confirm new password"
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
    </Card>
  );
};

export default ProfilePage;
