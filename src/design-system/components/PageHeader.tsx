// src/design-system/components/PageHeader.tsx
import React from "react";
import { Button, PageHeader as LumenPageHeader } from "../lumen";

/** What index.html ships with, and what a page with no title falls back to. */
const SITE_NAME = "Donor Dashboard";

export interface PageHeaderProps {
  title: React.ReactNode;
  /** Optional supporting line under the title. */
  subtitle?: React.ReactNode;
  /** Buttons / links rendered on the right of the header row. */
  actions?: React.ReactNode;
  /** Renders a standard "Back" button before the actions. */
  onBack?: () => void;
  backLabel?: string;
  /**
   * The browser-tab title, when the heading itself will not do.
   *
   * Needed where `title` is a node rather than a string, or where the heading
   * is too long to read in a tab.
   */
  documentTitle?: string;
}

/** The heading as a plain string, or null if it is a node we cannot read. */
const asText = (node: React.ReactNode): string | null => {
  if (typeof node === "string") return node.trim() || null;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    const parts = node.map(asText).filter(Boolean);
    return parts.length ? parts.join(" ") : null;
  }
  return null;
};

/**
 * The header row repeated at the top of ~26 pages: title left, actions right.
 *
 * Now a thin adapter over the design system's PageHeader. The prop shape is
 * unchanged so no page had to be touched; `size="md"` and `serif={false}` are
 * the in-app settings — the serif hero is reserved for overview and landing
 * screens.
 *
 * It also owns the browser-tab title. Every route used to render the one
 * `<title>` from index.html, so back-button history was twenty six identical
 * entries and a screen reader announced the same words on every navigation.
 * The heading is already the page's name, so it is the tab's name too.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  onBack,
  backLabel = "Back",
  documentTitle,
}) => {
  const tabTitle = documentTitle ?? asText(title);

  React.useEffect(() => {
    document.title = tabTitle ? `${tabTitle} · ${SITE_NAME}` : SITE_NAME;
    // Restored on unmount so a route without a PageHeader does not inherit the
    // last page's name.
    return () => {
      document.title = SITE_NAME;
    };
  }, [tabTitle]);

  return (
    <LumenPageHeader
      size="md"
      serif={false}
      padded={false}
      title={title}
      description={subtitle}
      actions={
        (actions || onBack) && (
          <>
            {onBack && (
              <Button variant="ghost" size="sm" icon="chevron-left" onClick={onBack}>
                {backLabel}
              </Button>
            )}
            {actions}
          </>
        )
      }
    />
  );
};

export default PageHeader;
