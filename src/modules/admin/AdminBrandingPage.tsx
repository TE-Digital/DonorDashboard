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
} from "@mantine/core";
import { useBranding } from "../theme/BrandingContext";
import { supabase } from "../../lib/supabaseClient";

// const RADIUS_OPTIONS = ["xs", "sm", "md", "lg", "xl"]; // not used

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
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Error saving branding settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack>
      <Text fw={700} size="lg">
        Branding & Layout
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
            label="Upload logo (PNG/JPG/SVG)"
            placeholder="Choose file"
            value={file}
            onChange={setFile}
          />
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="md">
          <Text fw={500}>Colors & Font</Text>

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
          <TextInput
            label="Main font family"
            description="Example: Inter, system-ui, sans-serif"
            value={font}
            onChange={(e) => setFont(e.currentTarget.value)}
          />
          <TextInput
            label="Button radius"
            description='Mantine values: "xs", "sm", "md", "lg", "xl"'
            value={buttonRadius}
            onChange={(e) => setButtonRadius(e.currentTarget.value)}
            placeholder="md"
          />
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="md">
          <Text fw={500}>Hero Section (Dashboard)</Text>
          <TextInput
            label="Hero title"
            placeholder="iCare Donor Dashboard"
            value={heroTitle}
            onChange={(e) => setHeroTitle(e.currentTarget.value)}
          />
          <TextInput
            label="Hero subtitle"
            placeholder="Helping children in remote schools, together."
            value={heroSubtitle}
            onChange={(e) => setHeroSubtitle(e.currentTarget.value)}
          />
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="md">
          <Text fw={500}>Login Screen</Text>
          <TextInput
            label="Login title"
            placeholder="Welcome back"
            value={loginTitle}
            onChange={(e) => setLoginTitle(e.currentTarget.value)}
          />
          <TextInput
            label="Login subtitle"
            placeholder="Sign in to manage students, donors and reports."
            value={loginSubtitle}
            onChange={(e) => setLoginSubtitle(e.currentTarget.value)}
          />
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="md">
          <Text fw={500}>Donor Contact Email</Text>
          <TextInput
            label="Email for donor communication"
            description="All messages from the donor forms will be sent here."
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
