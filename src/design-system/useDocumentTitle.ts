// src/design-system/useDocumentTitle.ts
//
// The browser-tab name for a screen that has no PageHeader.
//
// PageHeader sets the title for the ~26 pages that have one. The auth screens
// are deliberately headerless — they are a card on an empty background — so
// they say it themselves rather than all rendering the one title from
// index.html.

import { useEffect } from "react";

const SITE_NAME = "Donor Dashboard";

export const useDocumentTitle = (title: string | null): void => {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
    return () => {
      document.title = SITE_NAME;
    };
  }, [title]);
};
