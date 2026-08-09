// src/modules/theme/BrandingContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { brandDefaults, color, space } from "../../design-system/tokens";

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
  donor_contact_email: string | null;
};

// Default used ONLY as seed + last-resort fallback
export const defaultBranding: BrandingSettings = {
  logo_url: null,
  primary_color: brandDefaults.primaryColor,
  secondary_color: brandDefaults.secondaryColor,
  font_family: brandDefaults.fontFamily,
  button_radius: brandDefaults.buttonRadius,
  hero_title: "iCare Donor Dashboard",
  hero_subtitle: "Helping children in remote schools, together.",
  login_title: "Welcome back",
  login_subtitle: "Sign in to manage students, donors and reports.",
  donor_contact_email: "your@email.com",
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
        const { data: row, error } = await supabase
          .from("branding_settings")
          .select(
            `
            logo_url,
            primary_color,
            secondary_color,
            font_family,
            button_radius,
            hero_title,
            hero_subtitle,
            login_title,
            login_subtitle,
            donor_contact_email
          `
          )
          .eq("id", "global")
          .maybeSingle();

        if (error) {
          console.error("Branding load error:", error);
        }

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
            donor_contact_email: nullableStr(
              row.donor_contact_email,
              defaultBranding.donor_contact_email
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
              donor_contact_email: defaultBranding.donor_contact_email,
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
          backgroundColor: color.surface.auth,
          fontFamily: defaultBranding.font_family,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ marginBottom: space.xs }}>
            {defaultBranding.hero_title ?? "Dashboard"}
          </h1>
          <p style={{ opacity: 0.7 }}>
            Preparing your dashboard. Please wait a moment…
          </p>
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
