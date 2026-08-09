// src/design-system/cssVars.ts
//
// Bridges the TypeScript tokens in tokens.ts into CSS custom properties, so a
// .scss file can consume the exact same values the components consume.
//
// tokens.ts stays the single source of truth. Nothing here invents a value.
// Every property is prefixed `--dd-` so it can never collide with Mantine's
// own `--mantine-*` variables.
//
// Naming is mechanical: the object path, lowercased and hyphenated.
//   color.neutral[3]      -> --dd-color-neutral-3
//   space.md              -> --dd-space-md
//   layout.navWidth       -> --dd-layout-nav-width
//   color.border.default  -> --dd-color-border-default

import {
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

type TokenTree = { [key: string]: string | number | TokenTree };

/** `navWidth` -> `nav-width`, `2xl` -> `2xl`, `3` -> `3`. */
function kebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Values that are lengths get `px` appended; unitless ratios and z-indexes do
 * not. Strings (hex, rgba, shadows, em breakpoints) pass through untouched.
 */
function formatValue(value: string | number, unitless: boolean): string {
  if (typeof value === "string") return value;
  if (unitless || value === 0) return String(value);
  return `${value}px`;
}

function flatten(
  tree: TokenTree,
  prefix: string,
  unitless: boolean,
  out: Record<string, string>
): void {
  for (const [key, value] of Object.entries(tree)) {
    const name = `${prefix}-${kebab(key)}`;
    if (value !== null && typeof value === "object") {
      flatten(value as TokenTree, name, unitless, out);
    } else {
      out[name] = formatValue(value, unitless);
    }
  }
}

/**
 * The full `--dd-*` map.
 *
 * Computed once at module load: tokens.ts is a frozen literal, so there is
 * nothing to recompute. Branding-driven colours are NOT here — those change
 * per tenant at runtime and are supplied by `brandCssVars()` below.
 */
export function buildCssVars(): Record<string, string> {
  const vars: Record<string, string> = {};

  // Lengths — emitted with px.
  flatten(space, "--dd-space", false, vars);
  flatten(radius, "--dd-radius", false, vars);
  flatten(fontSize, "--dd-font-size", false, vars);
  flatten(iconSize, "--dd-icon-size", false, vars);
  flatten(layout, "--dd-layout", false, vars);

  // Unitless / pre-formatted.
  flatten(color, "--dd-color", true, vars);
  flatten(shadow, "--dd-shadow", true, vars);
  flatten(fontWeight, "--dd-font-weight", true, vars);
  flatten(lineHeight, "--dd-line-height", true, vars);
  flatten(zIndex, "--dd-z", true, vars);

  // Durations read better as CSS time values than raw numbers.
  for (const [key, value] of Object.entries(duration)) {
    vars[`--dd-duration-${kebab(key)}`] = `${value}ms`;
  }

  return vars;
}

export const cssVars = buildCssVars();

/**
 * Mantine's `cssVariablesResolver` shape. Passing this to MantineProvider puts
 * every token on `:root` alongside Mantine's own variables, which means the
 * .scss files pick them up with no extra import and no duplicated values.
 */
export const cssVariablesResolver = () => ({
  variables: cssVars,
  light: {},
  dark: {},
});
