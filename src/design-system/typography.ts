// src/design-system/typography.ts
//
// Semantic text roles. Pages should describe *what* a piece of text is,
// not pick a size/weight/colour by hand.
//
// The prop values below deliberately match what the pages already render
// today, so adopting a role is a visual no-op.

import { fontWeight } from "./tokens";

export type TextRole =
  | "pageTitle"
  | "pageSubtitle"
  | "sectionTitle"
  | "cardTitle"
  | "fieldLabel"
  | "body"
  | "bodyStrong"
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
  // Page-level heading, e.g. "Scholarships", "Dashboard Overview".
  pageTitle: { size: "lg", fw: fontWeight.bold },
  pageSubtitle: { size: "sm", fw: fontWeight.regular, c: "dimmed" },

  // Heading of a section inside a page.
  sectionTitle: { size: "md", fw: fontWeight.semibold },

  // Heading inside a card / panel.
  cardTitle: { size: "sm", fw: fontWeight.semibold },

  // Standalone label above a group of fields.
  fieldLabel: { size: "sm", fw: fontWeight.medium },

  body: { size: "sm", fw: fontWeight.regular },
  bodyStrong: { size: "sm", fw: fontWeight.semibold },
  caption: { size: "xs", fw: fontWeight.regular, c: "dimmed" },

  // Dashboard / stat cards.
  metricValue: { size: "xl", fw: fontWeight.bold },
  metricLabel: { size: "sm", fw: fontWeight.regular, c: "dimmed" },

  tableHeader: { size: "xs", fw: fontWeight.semibold },
};

/** Spread onto a Mantine <Text>: `<Text {...textRole("body")}>` */
export const textRole = (role: TextRole): TextRoleProps => textRoles[role];

/** Mantine heading config derived from the roles above. */
export const headings = {
  fontWeight: String(fontWeight.bold),
  sizes: {
    h1: { fontSize: "28px", lineHeight: "1.3" },
    h2: { fontSize: "22px", lineHeight: "1.35" },
    h3: { fontSize: "18px", lineHeight: "1.4" },
    h4: { fontSize: "16px", lineHeight: "1.45" },
    h5: { fontSize: "14px", lineHeight: "1.5" },
    h6: { fontSize: "12px", lineHeight: "1.5" },
  },
};
