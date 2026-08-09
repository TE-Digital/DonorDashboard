// src/main.tsx
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import App from "./App";
import { AuthProvider } from "./modules/auth/AuthContext";
import { BrandingProvider, useBranding } from "./modules/theme/BrandingContext";
import { buildTheme } from "./design-system";

const ThemedApp: React.FC = () => {
  // useBranding() returns the settings object itself, already defaulted by
  // BrandingProvider. buildTheme() handles null/partial values on its own.
  const branding = useBranding();

  const theme = React.useMemo(() => buildTheme(branding), [branding]);

  return (
    <MantineProvider theme={theme}>
      <Notifications />
      <App />
    </MantineProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BrandingProvider>
          <ThemedApp />
        </BrandingProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
