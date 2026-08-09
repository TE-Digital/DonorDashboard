// src/design-system/tokens.ts
//
// Raw design values. No Mantine import, no React.
// Every literal colour / size / spacing value in the app should live here.
// Current values intentionally mirror what the app already renders, so
// introducing these tokens is a no-op visually. Retuning happens here later.

export const color = {
  // Neutral ramp. Replaces the ad-hoc #ddd / #eee / #999 / #f8f9fa literals.
  neutral: {
    0: "#ffffff",
    1: "#f8f9fa",
    2: "#f1f3f5",
    3: "#e9ecef",
    4: "#dee2e6",
    5: "#ced4da",
    6: "#adb5bd",
    7: "#868e96",
    8: "#495057",
    9: "#212529",
  },

  surface: {
    page: "#ffffff",
    card: "#ffffff",
    sunken: "#f8f9fa",
    auth: "#edf2ff",
    overlay: "rgba(0, 0, 0, 0.55)",
  },

  border: {
    subtle: "#eeeeee",
    default: "#dddddd",
    strong: "#ced4da",
  },

  text: {
    primary: "#212529",
    secondary: "#495057",
    dimmed: "#868e96",
    inverse: "#ffffff",
  },

  // Semantic status colours are expressed as Mantine colour keys so that
  // Badge / Text / Button `color` props keep working unchanged.
  status: {
    success: "green",
    warning: "orange",
    danger: "red",
    info: "blue",
    neutral: "gray",
  },
} as const;

export const space = {
  none: 0,
  "3xs": 2,
  "2xs": 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 9999,
} as const;

export const shadow = {
  none: "none",
  xs: "0 1px 2px rgba(0, 0, 0, 0.05)",
  sm: "0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.04)",
  md: "0 4px 12px rgba(0, 0, 0, 0.06)",
  lg: "0 12px 28px rgba(0, 0, 0, 0.10)",
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  "2xl": 28,
  "3xl": 34,
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
} as const;

/**
 * Icon sizing scale. Replaces the per-component width/height overrides that
 * previously lived in main.tsx to work around oversized icons.
 */
export const iconSize = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
} as const;

export const breakpoint = {
  xs: "36em",
  sm: "48em",
  md: "62em",
  lg: "75em",
  xl: "88em",
} as const;

export const layout = {
  navWidth: 220,
  mobileBarHeight: 56,
  pagePadding: {
    mobile: "72px 16px 24px",
    desktop: "32px 40px",
  },
  navPadding: "24px 16px",
  authMaxWidth: 420,
  drawerWidth: "260px",
} as const;

export const zIndex = {
  nav: 100,
  drawer: 200,
  modal: 300,
  overlay: 400,
  notification: 500,
} as const;

export const duration = {
  fast: 120,
  normal: 200,
  slow: 320,
} as const;

/** Default branding values used before (or instead of) DB-provided branding. */
export const brandDefaults = {
  primaryColor: "#1c7ed6",
  secondaryColor: "#228be6",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  buttonRadius: "md",
} as const;

export type SpaceToken = keyof typeof space;
export type RadiusToken = keyof typeof radius;
export type ShadowToken = keyof typeof shadow;
export type FontSizeToken = keyof typeof fontSize;
export type StatusTone = keyof typeof color.status;
