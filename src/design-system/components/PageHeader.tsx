// src/design-system/components/PageHeader.tsx
import React from "react";
import { Button, PageHeader as LumenPageHeader } from "../lumen";

export interface PageHeaderProps {
  title: React.ReactNode;
  /** Optional supporting line under the title. */
  subtitle?: React.ReactNode;
  /** Buttons / links rendered on the right of the header row. */
  actions?: React.ReactNode;
  /** Renders a standard "Back" button before the actions. */
  onBack?: () => void;
  backLabel?: string;
}

/**
 * The header row repeated at the top of ~26 pages: title left, actions right.
 *
 * Now a thin adapter over the design system's PageHeader. The prop shape is
 * unchanged so no page had to be touched; `size="md"` and `serif={false}` are
 * the in-app settings — the serif hero is reserved for overview and landing
 * screens.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  onBack,
  backLabel = "Back",
}) => (
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

export default PageHeader;
