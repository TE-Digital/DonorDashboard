// src/main.tsx
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "./styles/global.scss";
// Lumen design-system tokens. Publishes the `--n-*`, `--blue-*`, `--fs-*`… custom
// properties on :root; element styling is scoped to `.lumen`, so this cannot
// restyle the existing Mantine surfaces.
import "./design-system/lumen/tokens.css";
// Initialises i18next and applies the stored language to <html lang> before the
// first paint, so a Thai session never flashes English on load.
import "./i18n";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import App from "./App";
import { AuthProvider } from "./modules/auth/AuthContext";
import { ViewAsProvider } from "./modules/viewAs/ViewAsContext";
import { BrandingProvider, useBranding } from "./modules/theme/BrandingContext";
import { buildTheme, cssVariablesResolver } from "./design-system";

const ThemedApp: React.FC = () => {
  // useBranding() returns the settings object itself, already defaulted by
  // BrandingProvider. buildTheme() handles null/partial values on its own.
  const branding = useBranding();

  const theme = React.useMemo(() => buildTheme(branding), [branding]);

  return (
    // cssVariablesResolver publishes every design token from tokens.ts onto
    // :root as a `--dd-*` custom property, so .module.scss files read the same
    // values these components do. See design-system/cssVars.ts.
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver}>
      <Notifications />
      <App />
    </MantineProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ViewAsProvider>
          <BrandingProvider>
            <ThemedApp />
          </BrandingProvider>
        </ViewAsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
