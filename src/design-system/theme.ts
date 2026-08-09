// src/design-system/theme.ts
//
// The single place where design tokens are handed to Mantine.
//
// Everything a page used to repeat by hand (card radius, table striping,
// input size, badge variant, icon dimensions) is expressed here as component
// defaultProps, so a future visual change is one edit in this folder rather
// than a sweep across forty page files.

import { createTheme, rem } from "@mantine/core";
import type { MantineThemeOverride } from "@mantine/core";
import {
  breakpoint,
  color,
  fontSize,
  iconSize,
  lineHeight,
  radius,
  shadow,
  space,
} from "./tokens";
import { headings } from "./typography";
import { brandingToThemeOverride } from "./branding";
import type { BrandingLike } from "./branding";

const px = (value: number) => rem(value);

export function buildTheme(
  branding?: BrandingLike | null
): MantineThemeOverride {
  const { brand, accent, fontFamily, defaultRadius } =
    brandingToThemeOverride(branding);

  return createTheme({
    fontFamily,
    fontFamilyMonospace:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    primaryColor: "brand",
    primaryShade: 6,
    defaultRadius,

    colors: { brand, accent },

    breakpoints: { ...breakpoint },

    spacing: {
      xs: px(space.xs),
      sm: px(space.sm),
      md: px(space.md),
      lg: px(space.lg),
      xl: px(space.xl),
    },

    radius: {
      xs: px(radius.sm),
      sm: px(radius.sm),
      md: px(radius.md),
      lg: px(radius.lg),
      xl: px(radius.xl),
    },

    shadows: {
      xs: shadow.xs,
      sm: shadow.sm,
      md: shadow.md,
      lg: shadow.lg,
      xl: shadow.lg,
    },

    fontSizes: {
      xs: px(fontSize.xs),
      sm: px(fontSize.sm),
      md: px(fontSize.md),
      lg: px(fontSize.lg),
      xl: px(fontSize.xl),
    },

    lineHeights: {
      xs: String(lineHeight.tight),
      sm: String(lineHeight.normal),
      md: String(lineHeight.normal),
      lg: String(lineHeight.normal),
      xl: String(lineHeight.relaxed),
    },

    headings,

    other: {
      iconSize,
      statusColors: color.status,
    },

    components: {
      // ── Surfaces ───────────────────────────────────────────────
      Card: {
        defaultProps: {
          withBorder: true,
          radius: "md",
          shadow: "xs",
        },
      },
      Paper: {
        defaultProps: {
          withBorder: true,
          radius: "md",
        },
      },
      Modal: {
        defaultProps: {
          centered: true,
          radius: "md",
          overlayProps: { backgroundOpacity: 0.55, blur: 2 },
        },
      },
      Drawer: {
        defaultProps: {
          padding: "md",
          overlayProps: { backgroundOpacity: 0.5, blur: 2 },
        },
      },

      // ── Actions ────────────────────────────────────────────────
      Button: {
        defaultProps: {
          size: "sm",
        },
      },
      ActionIcon: {
        defaultProps: {
          variant: "subtle",
          size: "md",
        },
      },

      // ── Data display ───────────────────────────────────────────
      Table: {
        defaultProps: {
          striped: true,
          highlightOnHover: true,
          horizontalSpacing: "md",
          verticalSpacing: "sm",
        },
      },
      Badge: {
        defaultProps: {
          variant: "light",
          size: "sm",
          radius: "sm",
        },
      },
      Loader: {
        defaultProps: {
          size: "md",
        },
      },

      // ── Inputs ─────────────────────────────────────────────────
      TextInput: { defaultProps: { size: "sm" } },
      PasswordInput: { defaultProps: { size: "sm" } },
      Textarea: { defaultProps: { size: "sm" } },
      NumberInput: { defaultProps: { size: "sm" } },
      MultiSelect: { defaultProps: { size: "sm" } },
      Switch: { defaultProps: { size: "sm" } },
      Checkbox: {
        defaultProps: { size: "sm" },
      },
      Select: {
        defaultProps: { size: "sm" },
        styles: {
          // Keeps the chevron from colliding with long option labels.
          input: { paddingRight: px(iconSize.xl + 8) },
        },
      },
      FileInput: {
        defaultProps: { size: "sm" },
      },
      DateInput: { defaultProps: { size: "sm" } },
    },
  });
}

/** Theme used before branding has loaded, and as the last-resort fallback. */
export const defaultTheme = buildTheme(null);
