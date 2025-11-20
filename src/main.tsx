// src/main.tsx (or wherever this file lives)
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import App from "./App";
import { AuthProvider } from "./modules/auth/AuthContext";
import {
  BrandingProvider,
  useBranding,
  defaultBranding,
} from "./modules/theme/BrandingContext";

const ThemedApp: React.FC = () => {
  const { branding } = useBranding();

  // Always have a complete branding object for Mantine
  const b = branding ?? defaultBranding;

  const theme = createTheme({
    fontFamily: b.font_family,
    defaultRadius: b.button_radius as any,
    primaryColor: "brand",
    colors: {
      brand: [
        b.primary_color, // 0
        b.primary_color,
        b.primary_color,
        b.primary_color,
        b.primary_color,
        b.primary_color,
        b.secondary_color, // 6
        b.secondary_color,
        b.secondary_color,
        b.secondary_color, // 9
      ],
    },

    //
    // 👇 Component-specific overrides to stop the giant icons
    //
    components: {
      Checkbox: {
        styles: {
          input: {
            width: 18,
            height: 18,
            minWidth: 18,
            minHeight: 18,
          },
          icon: {
            width: 14,
            height: 14,
            minWidth: 14,
            minHeight: 14,
          },
        },
      },
      Select: {
        styles: {
          rightSection: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
          },
          input: {
            // keep some room for the arrow, avoids layout glitches
            paddingRight: 32,
          },
        },
      },
      FileInput: {
        styles: {
          rightSection: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
          },
        },
      },
      ActionIcon: {
        styles: {
          root: {
            width: 24,
            height: 24,
            minWidth: 24,
            minHeight: 24,
          },
        },
      },
    },
  });

  return (
    <MantineProvider theme={theme} withGlobalStyles withNormalizeCSS>
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

