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
  duration,
  fontSize,
  iconSize,
  layout,
  lineHeight,
  radius,
  shadow,
  space,
  zIndex,
} from "./tokens";
import { headings } from "./typography";
import { brandingToThemeOverride } from "./branding";
import type { BrandingLike } from "./branding";

const px = (value: number) => rem(value);

/** Kept in step with `color.surface.overlay` — one scrim strength product-wide. */
const OVERLAY_OPACITY = 0.55;

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

    // Focus must always be visible, and must never shift layout.
    focusRing: "auto",

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
      space,
      shadow,
      duration,
      layout,
      zIndex,
      border: color.border,
      surface: color.surface,
      textColor: color.text,
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
          padding: "lg",
          overlayProps: { backgroundOpacity: OVERLAY_OPACITY, blur: 2 },
        },
      },
      Drawer: {
        defaultProps: {
          padding: "md",
          overlayProps: { backgroundOpacity: OVERLAY_OPACITY, blur: 2 },
        },
      },

      // ── Actions ────────────────────────────────────────────────
      // Only the primary action on a screen region is filled. Secondary
      // actions must pass variant="default", dismissals variant="subtle".
      // The default stays "filled" so existing primary actions keep working;
      // the rule is enforced by review, not by a silent theme flip.
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
      Anchor: {
        defaultProps: {
          underline: "hover",
        },
      },

      // ── Data display ───────────────────────────────────────────
      // No zebra striping: hover is the only row emphasis, so colour in a
      // table always means status rather than position.
      Table: {
        defaultProps: {
          striped: false,
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
      Tooltip: {
        defaultProps: {
          withArrow: true,
          openDelay: 250,
          radius: "sm",
        },
      },
      Avatar: {
        defaultProps: {
          radius: "xl",
        },
      },
      Menu: {
        defaultProps: {
          radius: "md",
          shadow: "md",
          withinPortal: true,
        },
      },
      Notification: {
        defaultProps: {
          radius: "md",
        },
      },
      Alert: {
        defaultProps: {
          radius: "md",
          variant: "light",
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
