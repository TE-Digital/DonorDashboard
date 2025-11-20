import React, { useState } from "react";
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

const RADIUS_OPTIONS = ["xs", "sm", "md", "lg", "xl"];

export const AdminBrandingPage: React.FC = () => {
  const branding = useBranding();

  const [primary, setPrimary] = useState(branding.primary_color);
  const [secondary, setSecondary] = useState(branding.secondary_color);
  const [font, setFont] = useState(branding.font_family);
  const [buttonRadius, setButtonRadius] = useState(branding.button_radius || "md");

  const [heroTitle, setHeroTitle] = useState(branding.hero_title ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState(branding.hero_subtitle ?? "");

  const [loginTitle, setLoginTitle] = useState(branding.login_title ?? "");
  const [loginSubtitle, setLoginSubtitle] = useState(branding.login_subtitle ?? "");

  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);

    let logoUrl = branding.logo_url;

    try {
      // Upload new logo if provided
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

        logoUrl = urlData.publicUrl;
      }

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
        })
        .eq("id", "global");

      if (updateError) throw updateError;

      // Simple way to refresh theme + texts everywhere
      window.location.reload();
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
	      maw={250} // Sets a max width of 250px
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

      {error && (
        <Text size="sm" c="red">
          {error}
        </Text>
      )}

      <Group justify="flex-end">
        <Button onClick={save} loading={saving}>
          Save branding
        </Button>
      </Group>
    </Stack>
  );
};
