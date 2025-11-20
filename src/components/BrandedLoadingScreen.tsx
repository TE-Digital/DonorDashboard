import React from "react";
import { Box, Center, Image, Loader, Stack, Text } from "@mantine/core";
import { useBranding } from "../modules/theme/BrandingContext";

export const BrandedLoadingScreen: React.FC = () => {
  const { branding } = useBranding();

  // Fallbacks only used BEFORE branding is loaded from DB
  const primary = branding?.primary_color ?? "#2563eb";
  const secondary = branding?.secondary_color ?? "#0f172a";
  const heroTitle = branding?.hero_title ?? "iCare Donor Dashboard";
  const heroSubtitle =
    branding?.hero_subtitle ??
    "Preparing your dashboard. Please wait a moment…";

  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "flex",
        background: `linear-gradient(135deg, ${primary}20, ${secondary}20)`,
      }}
    >
      <Center w="100%">
        <Stack align="center" gap="xs">
          {branding?.logo_url && (
            <Image
              src={branding.logo_url}
              alt="Logo"
              w={180}
              fit="contain"
              mb="sm"
            />
          )}

          <Loader size="lg" />

          <Text fw={600} mt="xs">
            {heroTitle}
          </Text>
          <Text size="sm" c="dimmed" ta="center" maw={320}>
            {heroSubtitle}
          </Text>
        </Stack>
      </Center>
    </Box>
  );
};