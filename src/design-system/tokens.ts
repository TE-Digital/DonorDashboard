// src/design-system/tokens.ts
//
// Raw design values. No Mantine import, no React.
// Every literal colour / size / spacing value in the app should live here.
//
// Retuned to the Lumen design system (design-system/lumen/tokens.css). These
// values ARE those values — warm clay neutrals, one 8px radius, ringless
// shadows — so the Mantine surfaces and the Lumen components render as one
// system. Keep the two files in step: change a colour here, change it there.

export const color = {
  // Warm neutral ramp — a hint of clay keeps surfaces from reading cold.
  // Mirrors --n-0 … --n-900.
  neutral: {
    0: "#ffffff",
    1: "#fcfbf9",
    2: "#f7f6f3",
    3: "#f0eeea",
    4: "#e7e4df",
    5: "#d4d0c9",
    6: "#aca49b",
    7: "#857c72",
    8: "#4a443d",
    9: "#211e1b",
  },

  surface: {
    page: "#f6f5f2",
    card: "#ffffff",
    sunken: "#fcfbf9",
    auth: "#f6f5f2",
    overlay: "rgba(33, 30, 27, 0.34)",
  },

  border: {
    subtle: "#e7e4df",
    default: "#d4d0c9",
    strong: "#aca49b",
  },

  text: {
    primary: "#211e1b",
    secondary: "#4a443d",
    dimmed: "#857c72",
    inverse: "#ffffff",
  },

  // Warm blue — the primary. Reserved for the single most important action per
  // screen region; everything else is an outline. Mirrors --blue-25 … --blue-800
  // in design-system/lumen/tokens.css, and is the ramp documented by
  // guidelines/colors-primary.card.html in the design project.
  blue: {
    25: "#f3f5fe",
    50: "#e6eafc",
    100: "#c9d1f8",
    200: "#93a3f0",
    300: "#5b71e5",
    400: "#2544d6",
    500: "#072ac8",
    600: "#0622a6",
    700: "#051b83",
    800: "#041461",
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

/**
 * The primary as Mantine wants it: a ten-step tuple, index 6 being the shade
 * `variant="filled"` uses. These are the design system's own steps rather than
 * an HSL approximation of them, so a filled button is exactly #072AC8.
 *
 * Order maps 25/50/100/200/300/400/500/600/700/800 onto Mantine's 0…9.
 */
export const brandRamp = [
  color.blue[25],
  color.blue[50],
  color.blue[100],
  color.blue[200],
  color.blue[300],
  color.blue[400],
  color.blue[500],
  color.blue[600],
  color.blue[700],
  color.blue[800],
] as const;

/**
 * Spacing scale. Every step is a multiple of 4 except `3xs`, which exists only
 * for optical nudges (icon / text baseline alignment) and never for layout.
 *
 * Inside a card: `md`. Between cards: `lg`. Between page sections: `xl`.
 */
export const space = {
  none: 0,
  "3xs": 2,
  "2xs": 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 40,
} as const;

/**
 * One radius. Every box in the system is 8px — the sm/md/lg steps exist only so
 * component code reads naturally. `xl` is the pill used for true circles
 * (avatars, switches, status dots).
 */
export const radius = {
  none: 0,
  sm: 8,
  md: 8,
  lg: 8,
  xl: 9999,
} as const;

/** Ringless, warm-toned elevation. Mirrors --shadow-card … --shadow-overlay. */
export const shadow = {
  none: "none",
  xs: "0 1px 2px rgba(60, 50, 30, 0.04)",
  sm: "0 2px 6px rgba(60, 50, 30, 0.07)",
  md: "0 1px 3px rgba(60, 50, 30, 0.05), 0 10px 26px -16px rgba(60, 50, 30, 0.16)",
  lg: "0 12px 30px -8px rgba(60, 50, 30, 0.22)",
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 14,
  lg: 16,
  xl: 19,
  "2xl": 24,
  "3xl": 32,
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
  navWidth: 236,
  railWidth: 56,
  topBarHeight: 56,
  mobileBarHeight: 56,
  pagePadding: {
    mobile: "72px 16px 24px",
    desktop: "28px 32px 32px",
  },
  navPadding: "18px 10px",
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
  // Lumen primary. Blue is rationed: only the one most important action is filled.
  primaryColor: "#072ac8",
  secondaryColor: "#0fb5ba",
  fontFamily:
    '"Figtree", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  buttonRadius: "md",
} as const;

export type SpaceToken = keyof typeof space;
export type RadiusToken = keyof typeof radius;
export type ShadowToken = keyof typeof shadow;
export type FontSizeToken = keyof typeof fontSize;
export type StatusTone = keyof typeof color.status;
