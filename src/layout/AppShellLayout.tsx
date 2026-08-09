// src/layout/AppShellLayout.tsx
import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Image,
  Text,
  Button,
  Burger,
  Drawer,
  Stack,
  Group,
  ScrollArea,
} from "@mantine/core";
import { useMantineTheme } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconSettings } from "@tabler/icons-react";
import { useAuth } from "../modules/auth/AuthContext";
import { useBranding } from "../modules/theme/BrandingContext";
import {
  brandDefaults,
  color,
  layout,
  space,
  zIndex,
} from "../design-system";

type AppRole = "admin" | "teacher" | "donor";

type NavItem = {
  label: string;
  to: string;
};

type RoleNavItem = NavItem & { role: AppRole };

export const AppShellLayout: React.FC = () => {
  const { profile, role, roles, logout } = useAuth();
  const branding = useBranding();
  const location = useLocation();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path);

  // ─────────────────────────────────────────────────────────────
  // NAV CONFIG
  // ─────────────────────────────────────────────────────────────

  const adminMainNav: NavItem[] = [
    { label: "Dashboard", to: "/admin/dashboard" },
    { label: "Students", to: "/admin/students" },
    { label: "Teachers", to: "/admin/teachers" },
    { label: "Schools", to: "/admin/schools" },
    { label: "Donors", to: "/admin/donors" },
    { label: "Scholarships", to: "/admin/scholarships" },
    { label: "Contact requests", to: "/admin/contact-requests" },
  ];

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

  // ─────────────────────────────────────────────────────────────
  // MULTI-ROLE SUPPORT
  // ─────────────────────────────────────────────────────────────

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

  const navBg = branding.primary_color || brandDefaults.primaryColor;

  // ─────────────────────────────────────────────────────────────
  // BASE STYLES
  // ─────────────────────────────────────────────────────────────

  const desktopLinkStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: "white",
    textDecoration: "none",
    fontSize: 14,
    padding: "4px 0",
  };

  const roleBadgeStyle: React.CSSProperties = {
    fontSize: 11,
    opacity: 0.85,
  };

  // Mobile link style → readable on white drawer
  const mobileLinkStyle: React.CSSProperties = {
    color: branding.primary_color || brandDefaults.primaryColor,
    textDecoration: "none",
    fontSize: 16,
    padding: "10px 0",
    display: "block",
    fontWeight: 500,
  };

  // ─────────────────────────────────────────────────────────────
  // LOGOUT HANDLER
  // ─────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // SIDEBAR CONTENT (shared between desktop + mobile)
  // ─────────────────────────────────────────────────────────────

  const SidebarNav = (
    <Stack justify="space-between" style={{ height: "100%" }}>
      <div>
        {branding.logo_url && (
          <Image src={branding.logo_url} alt="Logo" h={80} fit="contain" mb="lg" />
        )}

        <Text fw={700} mb="sm">
          Impact Center
        </Text>

        {/* MAIN NAV */}
        <nav>
          {allMainNavItems.map((item) => (
            <Link
              key={`${item.role}-${item.to}`}
              to={item.to}
              style={
                isMobile
                  ? {
                      ...mobileLinkStyle,
                      fontWeight: isActive(item.to) ? 700 : 500,
                    }
                  : {
                      ...desktopLinkStyle,
                      fontWeight: isActive(item.to) ? 700 : 400,
                    }
              }
              onClick={() => setMobileOpen(false)}
            >
              <span>{item.label}</span>
              {!isMobile && hasMultipleRoles && (
                <span style={roleBadgeStyle}>{roleLabels[item.role]}</span>
              )}
            </Link>
          ))}

          {/* COLLAPSIBLE ADMIN SETTINGS */}
          {effectiveRoles.includes("admin") && (
            <div style={{ marginTop: space.md }}>
              <button
                type="button"
                onClick={() => setShowAdminSettings((v) => !v)}
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  color: isMobile ? mobileLinkStyle.color : "white",
                }}
              >
                <Group justify="space-between" gap={8} style={{ padding: "6px 0" }}>
                  <Group gap={6}>
                    <IconSettings size={16} />
                    <span style={{ fontSize: 14 }}>Admin settings</span>
                  </Group>
                  <span style={{ fontSize: 12 }}>
                    {showAdminSettings ? "−" : "+"}
                  </span>
                </Group>
              </button>

              {showAdminSettings && (
                <div style={{ marginTop: space["2xs"], paddingLeft: space.lg }}>
                  {adminSettingsNav.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      style={
                        isMobile
                          ? { ...mobileLinkStyle, paddingLeft: 0 }
                          : {
                              ...desktopLinkStyle,
                              fontSize: 13,
                              opacity: 0.95,
                              fontWeight: isActive(item.to) ? 700 : 400,
                            }
                      }
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      {/* FOOTER: PROFILE + LOGOUT */}
      <div style={{ marginTop: space.lg }}>
        {profile && (
          <Link
            to="/profile"
            style={{
              display: "block",
              textDecoration: "underline",
              marginBottom: 12,
              fontSize: 14,
              color: isMobile ? mobileLinkStyle.color : "white",
            }}
            onClick={() => setMobileOpen(false)}
          >
            {profile.full_name}
            {hasMultipleRoles && ` (${effectiveRoles.join(", ")})`}
          </Link>
        )}

        <Button fullWidth onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </Stack>
  );

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: branding.font_family }}>
      {/* MOBILE TOP BAR */}
      {isMobile && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: layout.mobileBarHeight,
            backgroundColor: "white",
            borderBottom: `1px solid ${color.border.subtle}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: `0 ${space.md}px`,
            zIndex: zIndex.nav,
          }}
        >
          <Group>
            <Burger
              opened={mobileOpen}
              onClick={() => setMobileOpen((o) => !o)}
              color={branding.primary_color || brandDefaults.primaryColor}
              aria-label="Toggle navigation"
            />

            {branding.logo_url && (
              <Image src={branding.logo_url} alt="Logo" h={30} fit="contain" />
            )}
          </Group>

          <Text size="sm" fw={600} c={branding.primary_color || brandDefaults.primaryColor}>
            Impact Center
          </Text>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      {!isMobile && (
        <aside
          style={{
            width: layout.navWidth,
            backgroundColor: navBg,
            color: "white",
            padding: layout.navPadding,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {SidebarNav}
        </aside>
      )}

      {/* MOBILE DRAWER MENU */}
      {isMobile && (
        <Drawer
          opened={mobileOpen}
          onClose={() => setMobileOpen(false)}
          padding="md"
          size={layout.drawerWidth}
          overlayProps={{ opacity: 0.5, blur: 2 }}
        >
          <ScrollArea h="100%">{SidebarNav}</ScrollArea>
        </Drawer>
      )}

      {/* MAIN CONTENT */}
      <main
        style={{
          flex: 1,
          padding: isMobile
            ? layout.pagePadding.mobile
            : layout.pagePadding.desktop,
        }}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default AppShellLayout;
