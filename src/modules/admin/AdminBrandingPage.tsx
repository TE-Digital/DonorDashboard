// src/modules/admin/AdminBrandingPage.tsx
import React, { useState, useEffect } from "react";
import {
  Button,
  Card,
  Stack,
  TextInput,
  ColorInput,
  FileInput,
  Text,
  Image,
  Group,
  Select,
} from "@mantine/core";
import { BUTTON_RADIUS_OPTIONS, FONT_FAMILY_OPTIONS } from "../../design-system";
import { useBranding } from "../theme/BrandingContext";
import { supabase } from "../../lib/supabaseClient";
import { toFriendlyError } from "../../i18n/errors";


export const AdminBrandingPage: React.FC = () => {
  const branding = useBranding();

  const [primary, setPrimary] = useState(branding.primary_color);
  const [secondary, setSecondary] = useState(branding.secondary_color);
  const [font, setFont] = useState(branding.font_family);
  const [buttonRadius, setButtonRadius] = useState(
    branding.button_radius || "md"
  );

  const [heroTitle, setHeroTitle] = useState(branding.hero_title ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState(
    branding.hero_subtitle ?? ""
  );

  const [loginTitle, setLoginTitle] = useState(branding.login_title ?? "");
  const [loginSubtitle, setLoginSubtitle] = useState(
    branding.login_subtitle ?? ""
  );

  // Start with whatever the branding context has
  const [donorContactEmail, setDonorContactEmail] = useState(
    branding.donor_contact_email ?? ""
  );

  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If branding is loaded / updated later, prefill the email once
  useEffect(() => {
    if (!donorContactEmail && branding.donor_contact_email) {
      setDonorContactEmail(branding.donor_contact_email);
    }
  }, [branding.donor_contact_email, donorContactEmail]);

  const save = async () => {
    setSaving(true);
    setError(null);

    let logoUrl = branding.logo_url;

    try {
      // Upload logo if a new file is selected
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `logo.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("branding")
          .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("branding")
          .getPublicUrl(fileName);

        // Add cache-busting param so the new logo is visible immediately
        logoUrl = `${urlData.publicUrl}?v=${Date.now()}`;
      }

      const trimmedEmail = donorContactEmail.trim();

      const { error: updateError } = await supabase
        .from("branding_settings")
        .update({
          logo_url: logoUrl,
          primary_color: primary,
          secondary_color: secondary,
          font_family: font,
          button_radius: buttonRadius,
          hero_title: heroTitle,
          hero_subtitle: heroSubtitle,
          login_title: loginTitle,
          login_subtitle: loginSubtitle,
          donor_contact_email: trimmedEmail || null, // null if empty
        })
        .eq("id", "global");

      if (updateError) throw updateError;

      // Force-refresh theme / branding context
     // window.location.reload();
    } catch (e: unknown) {
      setError(toFriendlyError(e, "errors.save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack>
      <Text fw={700} size="lg">
        Branding and layout
      </Text>

      <Card withBorder>
        <Stack gap="md">
          <Text fw={500}>Logo</Text>
          {branding.logo_url && (
            <Image
              src={branding.logo_url}
              maw={250}
              height={60}
              fit="contain"
              alt="Current logo"
            />
          )}
          <FileInput
            label="Upload a new logo"
            placeholder="PNG, JPG or SVG. A transparent background works best."
            value={file}
            onChange={setFile}
          />
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="md">
          <Text fw={500}>Colors and font</Text>

          <ColorInput
            label="Primary color"
            value={primary}
            onChange={setPrimary}
          />
          <ColorInput
            label="Secondary color"
            value={secondary}
            onChange={setSecondary}
          />
          {/* Both of these were free text, and both change the whole product
              for every user. A rejected value used to fail silently back to the
              default with nothing on screen to say so. */}
          <Select
            label="Main font family"
            data={FONT_FAMILY_OPTIONS}
            allowDeselect={false}
            value={font}
            onChange={(value) => value && setFont(value)}
          />
          <Select
            label="Button radius"
            data={BUTTON_RADIUS_OPTIONS}
            allowDeselect={false}
            value={buttonRadius || "md"}
            onChange={(value) => value && setButtonRadius(value)}
          />
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="md">
          <Text fw={500}>Dashboard banner</Text>
          <TextInput
            label="Banner title"
            placeholder="iCare Donor Dashboard"
            value={heroTitle}
            onChange={(e) => setHeroTitle(e.currentTarget.value)}
          />
          <TextInput
            label="Banner subtitle"
            placeholder="Supporting students in remote schools, together."
            value={heroSubtitle}
            onChange={(e) => setHeroSubtitle(e.currentTarget.value)}
          />
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="md">
          <Text fw={500}>Sign in screen</Text>
          <TextInput
            label="Sign in title"
            placeholder="Welcome back"
            value={loginTitle}
            onChange={(e) => setLoginTitle(e.currentTarget.value)}
          />
          <TextInput
            label="Sign in subtitle"
            placeholder="Sign in to manage students, donors and reports."
            value={loginSubtitle}
            onChange={(e) => setLoginSubtitle(e.currentTarget.value)}
          />
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="md">
          <Text fw={500}>Donor contact email</Text>
          <TextInput
            aria-label="Donor contact email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="contact@your-organization.org"
            value={donorContactEmail}
            onChange={(e) => setDonorContactEmail(e.currentTarget.value)}
          />
        </Stack>
      </Card>

      {error && (
        <Text size="sm" c="red">
          {error}
        </Text>
      )}

      <Group justify="flex-end">
        <Button variant="default" onClick={save} loading={saving}>
          Save branding
        </Button>
      </Group>
    </Stack>
  );
};

export default AdminBrandingPage;
