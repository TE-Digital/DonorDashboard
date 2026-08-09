// src/design-system/typography.ts
//
// Semantic text roles. Pages describe *what* a piece of text is, never pick a
// size / weight / colour by hand.
//
// Sizes come from `fontSize` in tokens.ts and are emitted as explicit px, so a
// role is never limited to Mantine's five size keys. The scale is the one in
// .claude/Design-system.md:
//
//   3xl 34  hero (auth / marketing only)
//   2xl 28  page title, metric value
//   xl  22  section title
//   lg  18  card title
//   md  16  body / long-form prose
//   sm  14  UI default, tables, controls
//   xs  12  captions, labels, table headers
//
// Titles are semibold (600), not bold — bold headings on a dense admin screen
// read as shouting. Bold is reserved for a single metric value.

import { fontSize, fontWeight, lineHeight } from "./tokens";

const fz = (token: keyof typeof fontSize) => `${fontSize[token]}px`;

export type TextRole =
  | "hero"
  | "pageTitle"
  | "pageSubtitle"
  | "sectionTitle"
  | "cardTitle"
  | "fieldLabel"
  | "body"
  | "bodyStrong"
  | "bodyLong"
  | "caption"
  | "metricValue"
  | "metricLabel"
  | "tableHeader";

export interface TextRoleProps {
  size: string;
  fw: number;
  c?: string;
  lh?: number;
}

export const textRoles: Record<TextRole, TextRoleProps> = {
  // Single large statement on auth / landing surfaces. Never inside the shell.
  hero: { size: fz("3xl"), fw: fontWeight.semibold, lh: lineHeight.tight },

  // Page-level heading, e.g. "Scholarships", "Overview".
  pageTitle: { size: fz("2xl"), fw: fontWeight.semibold, lh: lineHeight.tight },
  pageSubtitle: { size: fz("sm"), fw: fontWeight.regular, c: "dimmed" },

  // Heading of a section inside a page.
  sectionTitle: { size: fz("xl"), fw: fontWeight.semibold, lh: lineHeight.tight },

  // Heading inside a card / panel.
  cardTitle: { size: fz("lg"), fw: fontWeight.semibold, lh: lineHeight.tight },

  // Standalone label above a group of fields.
  fieldLabel: { size: fz("sm"), fw: fontWeight.medium },

  // Default UI text: rows, cells, controls, inline copy.
  body: { size: fz("sm"), fw: fontWeight.regular },
  bodyStrong: { size: fz("sm"), fw: fontWeight.semibold },

  // Prose a person reads rather than scans: report text, descriptions.
  // Thai renders taller than Latin, so long copy always gets the relaxed step.
  bodyLong: { size: fz("md"), fw: fontWeight.regular, lh: lineHeight.relaxed },

  caption: { size: fz("xs"), fw: fontWeight.regular, c: "dimmed" },

  // Dashboard / stat cards. The one place bold is correct.
  metricValue: { size: fz("2xl"), fw: fontWeight.bold, lh: lineHeight.tight },
  metricLabel: { size: fz("xs"), fw: fontWeight.medium, c: "dimmed" },

  tableHeader: { size: fz("xs"), fw: fontWeight.semibold },
};

/** Spread onto a Mantine <Text>: `<Text {...textRole("body")}>` */
export const textRole = (role: TextRole): TextRoleProps => textRoles[role];

/**
 * Mantine heading config, kept in step with the roles above so a raw
 * <Title order={2}> and a <Text {...textRole("sectionTitle")}> agree.
 */
export const headings = {
  fontWeight: String(fontWeight.semibold),
  sizes: {
    h1: { fontSize: fz("2xl"), lineHeight: String(lineHeight.tight) },
    h2: { fontSize: fz("xl"), lineHeight: String(lineHeight.tight) },
    h3: { fontSize: fz("lg"), lineHeight: String(lineHeight.tight) },
    h4: { fontSize: fz("md"), lineHeight: String(lineHeight.normal) },
    h5: { fontSize: fz("sm"), lineHeight: String(lineHeight.normal) },
    h6: { fontSize: fz("xs"), lineHeight: String(lineHeight.normal) },
  },
};
