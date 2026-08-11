// src/design-system/branding.ts
//
// Turns DB-driven branding settings into Mantine theme overrides.
//
// Previously main.tsx built a fake ten-step palette by repeating the primary
// colour six times and the secondary colour four times. Mantine derives hover
// states, `variant="light"` backgrounds and disabled states from specific
// indices of that tuple, so every one of those states rendered as a solid
// brand colour. generateRamp() produces a real scale instead.

import type { MantineColorsTuple } from "@mantine/core";
import { brandDefaults, brandRamp, radius } from "./tokens";

interface Hsl {
  h: number;
  s: number;
  l: number;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

function hexToHsl(hex: string): Hsl | null {
  let normalized = hex.trim().replace("#", "");

  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((c) => c + c)
      .join("");
  }

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return { h, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: Hsl): string {
  const sat = clamp(s, 0, 100) / 100;
  const lig = clamp(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lig - c / 2;

  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return (
    "#" +
    rgb
      .map((v) =>
        Math.round((v + m) * 255)
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

/**
 * Lightness targets for a Mantine 10-step colour scale.
 * Index 6 is the "base" shade Mantine uses for filled buttons, which is why
 * the supplied brand colour is placed there verbatim.
 */
const RAMP_LIGHTNESS = [96, 90, 82, 72, 62, 54, null, 40, 33, 27];
const RAMP_SATURATION_SCALE = [0.55, 0.7, 0.85, 0.95, 1, 1, 1, 1, 0.95, 0.9];

/** Build a real ten-step Mantine palette from a single brand colour. */
export function generateRamp(hex: string): MantineColorsTuple {
  const base = hexToHsl(hex) ?? hexToHsl(brandDefaults.primaryColor)!;

  const shades = RAMP_LIGHTNESS.map((lightness, index) => {
    if (lightness === null) return hex;
    return hslToHex({
      h: base.h,
      s: clamp(base.s * RAMP_SATURATION_SCALE[index], 0, 100),
      l: lightness,
    });
  });

  return shades as unknown as MantineColorsTuple;
}

export interface BrandingLike {
  primary_color?: string | null;
  secondary_color?: string | null;
  font_family?: string | null;
  button_radius?: string | null;
}

export interface BrandingThemeOverride {
  brand: MantineColorsTuple;
  accent: MantineColorsTuple;
  fontFamily: string;
  defaultRadius: string;
}

const isValidRadius = (value: unknown): value is keyof typeof radius =>
  typeof value === "string" && value in radius;

/**
 * Pin the primary to the design system's warm blue (#072AC8) and ignore
 * `branding_settings.primary_color`.
 *
 * The blue is load-bearing in this system rather than decorative: it appears on
 * exactly one filled action per screen region, and every other control is an
 * outline defined against it. A per-tenant primary breaks that relationship, so
 * the ramp is fixed here.
 *
 * Set this to false to hand the primary back to the branding row — the tenant
 * path below is intact, not deleted. Secondary/accent, logo, fonts and copy
 * stay tenant-controlled either way.
 */
const PIN_PRIMARY_TO_DESIGN_SYSTEM = true;

/**
 * Values that were the *previous* built-in defaults. A stored row holding one
 * of these was never a deliberate branding choice — it is the old seed value —
 * so it must not outrank the Lumen defaults in tokens.ts. A genuinely custom
 * brand colour still wins.
 *
 * Drop an entry once no tenant row carries it.
 */
const LEGACY_DEFAULTS = new Set(
  [
    "#1c7ed6",
    "#228be6",
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  ].map((v) => v.toLowerCase())
);

/** The stored value, unless it is a superseded default. */
function preferred(
  stored: string | null | undefined,
  fallback: string
): string {
  const value = stored?.trim();
  if (!value || LEGACY_DEFAULTS.has(value.toLowerCase())) return fallback;
  return value;
}

/** Normalise branding settings into safe, complete theme inputs. */
export function brandingToThemeOverride(
  branding: BrandingLike | null | undefined
): BrandingThemeOverride {
  const primary = preferred(branding?.primary_color, brandDefaults.primaryColor);
  const secondary = preferred(
    branding?.secondary_color,
    brandDefaults.secondaryColor
  );
  const fontFamily = preferred(branding?.font_family, brandDefaults.fontFamily);

  const requestedRadius = branding?.button_radius?.trim();
  const defaultRadius = isValidRadius(requestedRadius)
    ? requestedRadius
    : brandDefaults.buttonRadius;

  return {
    // The design system's own ten steps, not an HSL approximation of them, so a
    // filled button is exactly #072AC8 and its hover is exactly --blue-600.
    brand: PIN_PRIMARY_TO_DESIGN_SYSTEM
      ? (brandRamp as unknown as MantineColorsTuple)
      : generateRamp(primary),
    accent: generateRamp(secondary),
    fontFamily,
    defaultRadius,
  };
}
