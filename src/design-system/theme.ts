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
  fontWeight,
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
    // One family everywhere, including the places Mantine would otherwise
    // reach for a monospace face.
    fontFamilyMonospace: fontFamily,
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
      // Lumen geometry: 36px control height, the single 8px radius, medium
      // weight. The blue only ever appears on `filled`; every other variant is
      // an outline or a ghost, which is what keeps the blue meaningful.
      Button: {
        defaultProps: {
          size: "sm",
          radius: "md",
        },
        styles: {
          root: {
            height: px(36),
            minHeight: px(36),
            paddingInline: px(space.md),
            fontSize: px(fontSize.md),
            fontWeight: fontWeight.medium,
            letterSpacing: "0.002em",
            borderWidth: 1,
            borderStyle: "solid",
          },
          label: { gap: px(space.xs) },
        },
      },
      ActionIcon: {
        defaultProps: {
          variant: "subtle",
          size: "md",
          radius: "md",
        },
        styles: {
          root: {
            width: px(36),
            height: px(36),
            borderWidth: 1,
            borderStyle: "solid",
          },
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
      // The table is the product. Users come from Excel: a sunken 40px header
      // row with a hard rule under it, 44px body rows separated by hairlines,
      // 13px type and tabular figures so columns of money line up.
      Table: {
        defaultProps: {
          striped: false,
          highlightOnHover: true,
          horizontalSpacing: "md",
          verticalSpacing: 0,
        },
        styles: {
          table: {
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize: px(13),
            lineHeight: "18px",
            fontVariantNumeric: "tabular-nums",
          },
          thead: { position: "sticky", top: 0, zIndex: 2 },
          th: {
            height: px(40),
            background: color.neutral[2],
            borderBottom: `1px solid ${color.border.default}`,
            color: color.text.dimmed,
            fontSize: px(fontSize.xs),
            fontWeight: fontWeight.semibold,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
            textTransform: "none",
          },
          td: {
            height: px(44),
            borderBottom: `1px solid ${color.border.subtle}`,
            color: color.text.primary,
          },
        },
      },
      Badge: {
        defaultProps: {
          variant: "light",
          size: "sm",
          radius: "sm",
        },
        styles: {
          root: {
            height: px(20),
            paddingInline: px(space.xs),
            border: "1px solid transparent",
            fontSize: px(11),
            fontWeight: fontWeight.semibold,
            letterSpacing: "0.01em",
            textTransform: "none",
          },
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
      // `md` is the form field — a 52px box holding 16px text under a 14px
      // label. The height ramp itself is remapped onto the control tokens in
      // styles/global.scss, so `size` stays a meaning rather than a number:
      // pass `size="sm"` for a dense toolbar search or table filter.
      TextInput: { defaultProps: { size: "md" } },
      PasswordInput: { defaultProps: { size: "md" } },
      Textarea: { defaultProps: { size: "md" } },
      NumberInput: { defaultProps: { size: "md" } },
      MultiSelect: { defaultProps: { size: "md" } },
      // Toggles are not typed into, so they keep their own compact scale.
      Switch: { defaultProps: { size: "sm" } },
      Checkbox: {
        defaultProps: { size: "sm" },
      },
      Select: {
        defaultProps: { size: "md" },
        styles: {
          // Keeps the chevron from colliding with long option labels.
          input: { paddingRight: px(iconSize.xl + 8) },
        },
      },
      FileInput: {
        defaultProps: { size: "md" },
      },
      // Every date field in the product reads and writes `12 Mar 2026`. Set
      // here rather than per page: the browser's own `input type="date"` shows
      // 28/08/2026 in one locale and 08/28/2026 in another, is a different
      // height from every other control, and carries its own calendar glyph.
      DateInput: {
        defaultProps: {
          size: "md",
          valueFormat: "DD MMM YYYY",
          placeholder: "Choose date",
          popoverProps: { withinPortal: true },
        },
      },
    },
  });
}

/** Theme used before branding has loaded, and as the last-resort fallback. */
export const defaultTheme = buildTheme(null);
