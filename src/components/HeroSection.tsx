// src/components/HeroSection.tsx
import React from "react";
import { Card, Group, Image, Stack, Text } from "@mantine/core";
import { useBranding } from "../modules/theme/BrandingContext";

export const HeroSection: React.FC = () => {
  const branding = useBranding();

  return (
    <Card withBorder radius="lg" shadow="xs" mb="md">
      <Group align="center" gap="md">
        {branding.logo_url && (
          <Image
            src={branding.logo_url}
            height={59}
            fit="contain"
            alt="Logo"
          />
        )}
        <Stack gap={2}>
          <Text fw={700} size="lg">
            {branding.hero_title || "iCare Donor Dashboard"}
          </Text>
          <Text size="sm" c="dimmed">
            {branding.hero_subtitle ||
              "Helping children in remote schools, together."}
          </Text>
        </Stack>
      </Group>
    </Card>
  );
};
