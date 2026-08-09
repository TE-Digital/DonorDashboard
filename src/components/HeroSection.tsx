// src/components/HeroSection.tsx
import React from "react";
import { Card, Group, Image, Stack, Text } from "@mantine/core";
import { useBranding } from "../modules/theme/BrandingContext";
import { textRole } from "../design-system";

export const HeroSection: React.FC = () => {
  const branding = useBranding();

  return (
    <Card mb="md">
      <Group align="center" gap="md">
        {branding.logo_url && (
          <Image
            src={branding.logo_url}
            height={56}
            fit="contain"
            alt="Logo"
          />
        )}
        <Stack gap={2}>
          <Text {...textRole("pageTitle")}>
            {branding.hero_title || "iCare Donor Dashboard"}
          </Text>
          <Text {...textRole("pageSubtitle")}>
            {branding.hero_subtitle ||
              "Helping children in remote schools, together."}
          </Text>
        </Stack>
      </Group>
    </Card>
  );
};
