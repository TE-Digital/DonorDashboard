import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export type BrandingSettings = {
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  button_radius: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  login_title: string | null;
  login_subtitle: string | null;
};

// Default used ONLY as seed + last-resort fallback
export const defaultBranding: BrandingSettings = {
  logo_url: null,
  primary_color: "#1c7ed6",
  secondary_color: "#228be6",
  font_family:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  button_radius: "md",
  hero_title: "iCare Donor Dashboard",
  hero_subtitle: "Helping children in remote schools, together.",
  login_title: "Welcome back",
  login_subtitle: "Sign in to manage students, donors and reports.",
};

const BrandingContext = createContext<BrandingSettings>(defaultBranding);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [branding, setBranding] = useState<BrandingSettings | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // 1) Try to load row from DB
        const { data, error } = await supabase
          .from("branding_settings")
          .select("*")
          .eq("id", "global")
          .limit(1);

        if (error) {
          console.error("Branding load error:", error);
        }

        const row = data && data.length > 0 ? data[0] : null;

        if (row) {
          // DB is the source of truth
          const str = (v: any, fb: string): string =>
            typeof v === "string" && v.trim() !== "" ? v : fb;
          const nullableStr = (v: any, fb: string | null): string | null =>
            typeof v === "string" && v.trim() !== "" ? v : fb;

          setBranding({
            logo_url: nullableStr(row.logo_url, defaultBranding.logo_url),
            primary_color: str(
              row.primary_color,
              defaultBranding.primary_color
            ),
            secondary_color: str(
              row.secondary_color,
              defaultBranding.secondary_color
            ),
            font_family: str(row.font_family, defaultBranding.font_family),
            button_radius: str(
              row.button_radius,
              defaultBranding.button_radius
            ),
            hero_title: nullableStr(row.hero_title, defaultBranding.hero_title),
            hero_subtitle: nullableStr(
              row.hero_subtitle,
              defaultBranding.hero_subtitle
            ),
            login_title: nullableStr(
              row.login_title,
              defaultBranding.login_title
            ),
            login_subtitle: nullableStr(
              row.login_subtitle,
              defaultBranding.login_subtitle
            ),
          });
          return;
        }

        // 2) No row yet: seed once with defaults
        const { error: seedError } = await supabase
          .from("branding_settings")
          .upsert(
            {
              id: "global",
              logo_url: defaultBranding.logo_url,
              primary_color: defaultBranding.primary_color,
              secondary_color: defaultBranding.secondary_color,
              font_family: defaultBranding.font_family,
              button_radius: defaultBranding.button_radius,
              hero_title: defaultBranding.hero_title,
              hero_subtitle: defaultBranding.hero_subtitle,
              login_title: defaultBranding.login_title,
              login_subtitle: defaultBranding.login_subtitle,
            },
            { onConflict: "id" }
          );

        if (seedError) {
          console.error("Branding seed error:", seedError);
        }

        // After seeding, use defaults in memory
        setBranding(defaultBranding);
      } catch (e) {
        console.error("Unexpected branding error:", e);
        // If anything blows up, still render app with defaults
        setBranding(defaultBranding);
      }
    })();
  }, []);

  if (!branding) {
    // Branded loading screen
    return (
      <div
        style={{
          height: "100vh",
          width: "100vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f1f5ff",
          fontFamily: defaultBranding.font_family,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ marginBottom: 8 }}>
            {defaultBranding.hero_title ?? "Dashboard"}
          </h1>
          <p style={{ opacity: 0.7 }}>Preparing your dashboard. Please wait a moment…</p>
        </div>
      </div>
    );
  }

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);


