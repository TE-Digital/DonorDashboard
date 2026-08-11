// src/components/HeroSection.tsx
import React from "react";
import { Card, Group, Image, Stack, Text } from "@mantine/core";
import { useBranding } from "../modules/theme/BrandingContext";
import { textRole } from "../design-system";
import classes from "./HeroSection.module.scss";

export const HeroSection: React.FC = () => {
  const branding = useBranding();

  return (
    <Card mb="md" className={classes.root}>
      <Group align="center" gap="md">
        {branding.logo_url && (
          <Image
            src={branding.logo_url}
            height={56}
            fit="contain"
            alt="Logo"
          />
        )}
        <Stack gap={2} className={classes.content}>
          <Text {...textRole("pageTitle")} className={classes.title}>
            {branding.hero_title || "iCare Donor Dashboard"}
          </Text>
          <Text {...textRole("pageSubtitle")} className={classes.subtitle}>
            {branding.hero_subtitle ||
              "Helping children in remote schools, together."}
          </Text>
        </Stack>
      </Group>
    </Card>
  );
};
