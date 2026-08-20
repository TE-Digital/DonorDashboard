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
import { useViewAs } from "../modules/viewAs/ViewAsContext";
import { ViewAsSwitcher } from "../modules/viewAs/ViewAsSwitcher";
import { useBranding } from "../modules/theme/BrandingContext";
import { Banner, Button, IconButton, SideNav, TopBar, type NavChild, type NavModule } from "../design-system/lumen";
import { GlobalSearchDialog } from "../modules/search/GlobalSearchDialog";
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

const RESOURCE_LABELS: Record<string, string> = {
  dashboard: "Overview",
  students: "Students",
  teachers: "Teachers",
  schools: "Schools",
  donors: "Donors",
  scholarships: "Scholarships",
  "grant-types": "Grant types",
  reports: "Field reports",
  "contact-requests": "Requests",
  users: "Accounts",
  branding: "Settings",
  profile: "Profile",
  renew: "Contact",
};

const RESOURCE_SECTIONS: Record<string, string> = {
  students: "Directory",
  teachers: "Directory",
  schools: "Directory",
  scholarships: "Programmes",
  "grant-types": "Programmes",
  reports: "Programmes",
  donors: "Giving",
  "contact-requests": "Giving",
  renew: "Giving",
  users: "Organisation",
  branding: "Organisation",
};

function detailTitle(resource: string, tail: string[]): string {
  const singular = resource.endsWith("s") ? resource.slice(0, -1) : resource;
  if (tail.includes("new")) return `Add ${singular.replace(/-/g, " ")}`;
  if (tail.includes("edit")) return `Edit ${singular.replace(/-/g, " ")}`;
  if (tail[tail.length - 1] === "students") return "Assigned students";
  return `${humanise(singular)} details`;
}

export const AppShellLayout: React.FC = () => {
  const { profile, role, roles, logout } = useAuth();
  const { viewRole, simulated, simulatedName, resetView } = useViewAs();
  const branding = useBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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
    // The nav follows the view, not the account: an admin in teacher view gets
    // the teacher product whole, without the admin console bleeding into it.
    const isAdmin = viewRole === "admin" && effectiveRoles.includes("admin");
    const isTeacher = viewRole === "teacher";
    const isDonor = viewRole === "donor" && effectiveRoles.includes("donor");
    const out: NavModule[] = [];

    // The teacher product is three rows and no more: what is due, who it is
    // due for, and who you are.
    if (isTeacher) {
      return [
        { id: "/teacher/dashboard", label: "Overview", icon: "house" },
        { id: "sec-teaching", section: "Teaching" },
        { id: "/teacher/students", label: "My students", icon: "graduation-cap" },
        { id: "/teacher/profile", label: "My profile", icon: "contact" },
      ];
    }

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
  }, [effectiveRoles, viewRole]);

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
    const [scope, resource, ...tail] = parts;
    if (!resource || resource === "dashboard") return [];

    const section = RESOURCE_SECTIONS[resource];
    const items: Array<{ label: string; onClick: () => void }> = [];
    if (section) {
      items.push({
        label: section,
        onClick: () => navigate(scope === "admin" ? "/admin/dashboard" : `/${scope}/dashboard`),
      });
    }
    if (tail.length > 0) {
      items.push({
        label: RESOURCE_LABELS[resource] ?? humanise(resource),
        onClick: () => navigate(`/${scope}/${resource}`),
      });
    }
    return items;
  }, [location.pathname, navigate]);

  const title = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    const [, resource, ...tail] = parts;
    if (!resource) return "Overview";
    if (tail.length > 0) return detailTitle(resource, tail);
    return RESOURCE_LABELS[resource] ?? humanise(resource);
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
      <button
        type="button"
        onClick={() => go(viewRole === "teacher" ? "/teacher/profile" : "/profile")}
        className={classes.profileRow}
      >
        <span className={classes.avatar}>{initials(profile?.full_name)}</span>
        <span className={classes.profileName}>
          {viewRole === "teacher" && simulatedName ? simulatedName : profile?.full_name || "Signed in"}
          <span className={classes.profileRole}>
            {viewRole === "teacher"
              ? simulated
                ? " · teacher (preview)"
                : " · teacher"
              : effectiveRoles.length > 0
                ? ` · ${effectiveRoles.join(", ")}`
                : ""}
          </span>
        </span>
      </button>
      <Button variant="secondary" fullWidth size="sm" onClick={handleLogout}>
        Log out
      </Button>
    </div>
  );

  // ⌘K / Ctrl-K anywhere in the app opens the global search.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
          <IconButton icon="search" label="Search" onClick={() => setSearchOpen(true)} />
          <ViewAsSwitcher />
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
        <GlobalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
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
            actions={<ViewAsSwitcher />}
            onSearch={() => setSearchOpen(true)}
          />
          <main className={classes.panel}>
            {simulated && (
              <div className={classes.viewNotice}>
                <Banner
                  tone="info"
                  title="Previewing the teacher product"
                  action={
                    <Button variant="secondary" onClick={resetView}>
                      Back to admin
                    </Button>
                  }
                >
                  You are seeing what {simulatedName ?? "this teacher"} sees. You are still signed in
                  as {profile?.full_name || "an administrator"}, and anything you save is saved for
                  real.
                </Banner>
              </div>
            )}
            <Outlet />
          </main>
        </div>
      </div>
      <GlobalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

export default AppShellLayout;
