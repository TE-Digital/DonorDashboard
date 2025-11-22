// src/layout/AppShellLayout.tsx
import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Image, Text, Button } from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import { useAuth } from "../modules/auth/AuthContext";
import { useBranding } from "../modules/theme/BrandingContext";

type AppRole = "admin" | "teacher" | "donor";

type NavItem = {
  label: string;
  to: string;
};

type RoleNavItem = NavItem & { role: AppRole };

export const AppShellLayout: React.FC = () => {
  const { profile, role, roles, logout } = useAuth() as {
    profile: { full_name?: string } | null;
    role?: string | null;
    roles?: string[] | null;
    logout: () => Promise<void>;
  };

  const branding = useBranding();
  const location = useLocation();
  const [showAdminSettings, setShowAdminSettings] = useState(false);

  const isActive = (path: string) => location.pathname.startsWith(path);

  // ----- NAV CONFIG PER ROLE -----

  // Admin day-to-day
  const adminMainNav: NavItem[] = [
    { label: "Dashboard", to: "/admin/dashboard" },
    { label: "Students", to: "/admin/students" },
    { label: "Teachers", to: "/admin/teachers" },
    { label: "Schools", to: "/admin/schools" },
    { label: "Donors", to: "/admin/donors" },
    { label: "Scholarships", to: "/admin/scholarships" },
    { label: "Contact requests", to: "/admin/contact-requests" }, 
  ];

  // Admin “maintenance / settings”
  const adminSettingsNav: NavItem[] = [
    { label: "Reports", to: "/admin/reports" },
    { label: "Grant Types", to: "/admin/grant-types" },
    { label: "Users & Roles", to: "/admin/users" },
    { label: "Branding", to: "/admin/branding" },
  ];

  const teacherNav: NavItem[] = [
    { label: "Dashboard", to: "/teacher/dashboard" },
    { label: "Students", to: "/teacher/students" },
  ];

  const donorNav: NavItem[] = [
    { label: "Dashboard", to: "/donor/dashboard" },
    { label: "Contact", to: "/donor/renew" },

  ];

  const roleLabels: Record<AppRole, string> = {
    admin: "Admin",
    teacher: "Teacher",
    donor: "Donor",
  };

  // ----- EFFECTIVE ROLES (supports multi-role users) -----
  const effectiveRoles: AppRole[] = (() => {
    const result: AppRole[] = [];

    if (Array.isArray(roles) && roles.length > 0) {
      roles.forEach((r) => {
        if (r === "admin" || r === "teacher" || r === "donor") {
          if (!result.includes(r)) result.push(r);
        }
      });
    } else if (role === "admin" || role === "teacher" || role === "donor") {
      result.push(role);
    }

    return result;
  })();

  const hasMultipleRoles = effectiveRoles.length > 1;

  // Flat list of main nav items, but tagged with role
  const allMainNavItems: RoleNavItem[] = [];

  if (effectiveRoles.includes("admin")) {
    adminMainNav.forEach((item) =>
      allMainNavItems.push({ ...item, role: "admin" })
    );
  }
  if (effectiveRoles.includes("teacher")) {
    teacherNav.forEach((item) =>
      allMainNavItems.push({ ...item, role: "teacher" })
    );
  }
  if (effectiveRoles.includes("donor")) {
    donorNav.forEach((item) =>
      allMainNavItems.push({ ...item, role: "donor" })
    );
  }

  const navBg = branding.primary_color || "#1c7ed6";

  const baseLinkStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: "white",
    textDecoration: "none",
    fontSize: 14,
    padding: "4px 0",
    gap: 6,
  };

  const roleBadgeStyle: React.CSSProperties = {
    fontSize: 11,
    opacity: 0.85,
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: branding.font_family,
      }}
    >
      {/* LEFT NAVIGATION */}
      <aside
        style={{
          width: 220,
          backgroundColor: navBg,
          color: "white",
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          {/* Logo */}
          {branding.logo_url && (
            <Image
              src={branding.logo_url}
              alt="Logo"
              h={80}
              fit="contain"
              mb="lg"
            />
          )}

          <Text fw={700} mb="sm">
            Impact Center
          </Text>

          {/* MAIN NAV: all relevant roles mixed, role badge only if multi-role */}
          <nav>
            {allMainNavItems.map((item) => (
              <Link
                key={`${item.role}-${item.to}`}
                to={item.to}
                style={{
                  ...baseLinkStyle,
                  fontWeight: isActive(item.to) ? 700 : 400,
                }}
              >
                <span>{item.label}</span>
                {hasMultipleRoles && (
                  <span style={roleBadgeStyle}>{roleLabels[item.role]}</span>
                )}
              </Link>
            ))}

            {/* ADMIN SETTINGS: collapsible under a small gear row */}
            {effectiveRoles.includes("admin") && (
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowAdminSettings((v) => !v)}
                  style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    cursor: "pointer",
                    color: "white",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "4px 0",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <IconSettings size={16} />
                      <span style={{ fontSize: 13 }}>Admin settings</span>
                    </div>
                    <span style={{ fontSize: 11, opacity: 0.8 }}>
                      {showAdminSettings ? "−" : "+"}
                    </span>
                  </div>
                </button>

                {showAdminSettings && (
                  <div style={{ marginTop: 4, paddingLeft: 20 }}>
                    {adminSettingsNav.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        style={{
                          ...baseLinkStyle,
                          fontSize: 13,
                          fontWeight: isActive(item.to) ? 700 : 400,
                          opacity: 0.95,
                        }}
                      >
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* USER + LOGOUT (Profile close to logout) */}
        <div style={{ marginTop: "24px" }}>
          {profile && (
            <Link
              to="/profile"
              style={{
                display: "block",
                color: "white",
                textDecoration: "underline",
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              {profile.full_name}
              {hasMultipleRoles &&
                effectiveRoles.length > 0 &&
                ` (${effectiveRoles.join(", ")})`}
            </Link>
          )}

          <Button fullWidth onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main
        style={{
          flex: 1,
          padding: "32px 40px",
        }}
      >
        <Outlet />
      </main>
    </div>
  );
};
