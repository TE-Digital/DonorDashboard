// src/layout/AppShellLayout.tsx
//
// The application shell, rebuilt on the Lumen design system:
// full-width top bar, labelled nav on the warm canvas, content floating as a
// white panel. See design-system/lumen.
//
// Nav item ids ARE route paths — SideNav hands the id straight to navigate().

import React, { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Burger, Drawer, Image, ScrollArea } from "@mantine/core";
import { useMantineTheme } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useAuth } from "../modules/auth/AuthContext";
import { useBranding } from "../modules/theme/BrandingContext";
import { Button, SideNav, TopBar, type NavChild, type NavModule } from "../design-system/lumen";
import classes from "./AppShellLayout.module.scss";

type AppRole = "admin" | "teacher" | "donor";

/** Initials for the top-bar avatar. "Ada Kimani" -> "AK". */
function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** Sentence-case a route segment: "grant-types" -> "Grant types". */
function humanise(segment: string): string {
  const words = segment.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const AppShellLayout: React.FC = () => {
  const { profile, role, roles, logout } = useAuth();
  const branding = useBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [mobileOpen, setMobileOpen] = useState(false);

  const effectiveRoles: AppRole[] = useMemo(() => {
    const result: AppRole[] = [];
    const push = (r: unknown) => {
      if ((r === "admin" || r === "teacher" || r === "donor") && !result.includes(r)) result.push(r);
    };
    if (Array.isArray(roles) && roles.length > 0) roles.forEach(push);
    else push(role);
    return result;
  }, [role, roles]);

  // ── Nav config. Ids are route paths. ───────────────────────────────────
  //
  // Structure is priority-ordered, not role-ordered:
  //   1. Overview      — one row per role the user actually holds
  //   2. Community     — students, teachers and schools in ONE group
  //   3. Programmes    — scholarships, grant types, field reports
  //   4. Giving        — donors, contact requests, renewals
  //   5. Organisation  — accounts and settings
  // Every destination from the previous nav is still reachable; only the
  // grouping and ordering changed.
  const modules = useMemo<NavModule[]>(() => {
    const isAdmin = effectiveRoles.includes("admin");
    const isTeacher = effectiveRoles.includes("teacher");
    const isDonor = effectiveRoles.includes("donor");
    const out: NavModule[] = [];

    // ── 1. Overview ─────────────────────────────────────────────────────
    const overviews: NavChild[] = [];
    if (isAdmin) overviews.push({ id: "/admin/dashboard", label: "Admin overview" });
    if (isTeacher) overviews.push({ id: "/teacher/dashboard", label: "Teaching overview" });
    if (isDonor) overviews.push({ id: "/donor/dashboard", label: "Giving overview" });

    if (overviews.length === 1) {
      out.push({ ...overviews[0], label: "Overview", icon: "house" });
    } else if (overviews.length > 1) {
      out.push({ id: "overview-group", label: "Overview", icon: "house", children: overviews });
    }

    // ── 2. Community — the primary modules. Flat rows, never collapsed. ──
    const community: NavModule[] = [];
    if (isAdmin)
      community.push({ id: "/admin/students", label: "Students", icon: "graduation-cap" });
    if (isTeacher)
      community.push({ id: "/teacher/students", label: "My students", icon: "graduation-cap" });
    if (isAdmin) {
      community.push(
        { id: "/admin/teachers", label: "Teachers", icon: "contact" },
        { id: "/admin/schools", label: "Schools", icon: "school" },
      );
    }

    if (community.length) {
      out.push({ id: "sec-community", section: "Community" }, ...community);
    }

    // ── 3. Programmes ───────────────────────────────────────────────────
    if (isAdmin) {
      out.push(
        { id: "sec-programmes", section: "Programmes" },
        {
          id: "grants-group",
          label: "Scholarships",
          icon: "hand-coins",
          children: [
            { id: "/admin/scholarships", label: "All scholarships" },
            { id: "/admin/grant-types", label: "Grant types" },
          ],
        },
        { id: "/admin/reports", label: "Field reports", icon: "clipboard-list" },
      );
    }

    // ── 4. Giving ───────────────────────────────────────────────────────
    const giving: NavModule[] = [];
    if (isAdmin) {
      giving.push(
        { id: "/admin/donors", label: "Donors", icon: "wallet" },
        { id: "/admin/contact-requests", label: "Requests", icon: "clipboard-list" },
      );
    }
    if (isDonor) giving.push({ id: "/donor/renew", label: "Contact", icon: "clipboard-list" });

    if (giving.length) {
      out.push({ id: "sec-giving", section: "Giving" }, ...giving);
    }

    // ── 5. Organisation ─────────────────────────────────────────────────
    if (isAdmin) {
      out.push(
        { id: "sec-org", section: "Organisation" },
        { id: "/admin/users", label: "Accounts", icon: "users" },
        { id: "/admin/branding", label: "Settings", icon: "settings" },
      );
    }

    return out;
  }, [effectiveRoles]);

  /** Deepest nav id that prefixes the current path — that row lights up. */
  const activeId = useMemo(() => {
    const ids: string[] = [];
    modules.forEach((m) => {
      if (m.id.startsWith("/")) ids.push(m.id);
      (m.children || []).forEach((c) => ids.push(c.id));
    });
    return ids
      .filter((id) => location.pathname === id || location.pathname.startsWith(id + "/"))
      .sort((a, b) => b.length - a.length)[0];
  }, [modules, location.pathname]);

  const breadcrumbs = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    return parts.slice(0, -1).map(humanise);
  }, [location.pathname]);

  const title = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    return parts.length ? humanise(parts[parts.length - 1]) : "Overview";
  }, [location.pathname]);

  const go = (id: string) => {
    if (!id.startsWith("/")) return;
    navigate(id);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  const navFooter = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button type="button" onClick={() => go("/profile")} className={classes.profileRow}>
        <span className={classes.avatar}>{initials(profile?.full_name)}</span>
        <span className={classes.profileName}>
          {profile?.full_name || "Signed in"}
          {effectiveRoles.length > 0 && (
            <span className={classes.profileRole}> · {effectiveRoles.join(", ")}</span>
          )}
        </span>
      </button>
      <Button variant="secondary" fullWidth size="sm" onClick={handleLogout}>
        Log out
      </Button>
    </div>
  );

  const nav = (
    <SideNav
      workspace={
        <span className={classes.workspace}>
          {branding.logo_url && (
            <Image src={branding.logo_url} alt="" h={16} w="auto" fit="contain" />
          )}
          Impact Center
        </span>
      }
      modules={modules}
      activeId={activeId}
      onNavigate={go}
      footer={navFooter}
    />
  );

  // ── Mobile: top bar + drawer, same nav. ────────────────────────────────
  if (isMobile) {
    return (
      <div className={`lumen ${classes.shell}`}>
        <header className={classes.mobileBar}>
          <Burger
            opened={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
            size="sm"
            aria-label="Toggle navigation"
          />
          <span className={classes.mobileTitle}>{title}</span>
          <span className={classes.avatar}>{initials(profile?.full_name)}</span>
        </header>
        <Drawer
          opened={mobileOpen}
          onClose={() => setMobileOpen(false)}
          padding={0}
          size={260}
          overlayProps={{ opacity: 0.4, blur: 2 }}
        >
          <ScrollArea h="100%" className="lumen">
            {nav}
          </ScrollArea>
        </Drawer>
        <main className={classes.mobileMain}>
          <Outlet />
        </main>
      </div>
    );
  }

  // ── Desktop: rail-less shell. Nav on the canvas, content floating white. ──
  // Nav runs the full height on the left; the top bar belongs to the content
  // column, so the breadcrumb lines up with the page rather than the nav.
  return (
    <div className={`lumen ${classes.shell}`}>
      <div className={classes.body}>
        {nav}
        <div className={classes.panelWrap}>
          <TopBar
            breadcrumbs={breadcrumbs}
            title={title}
            notifications={0}
            user={initials(profile?.full_name)}
          />
          <main className={classes.panel}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default AppShellLayout;
