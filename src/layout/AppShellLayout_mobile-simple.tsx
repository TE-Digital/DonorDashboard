// src/layout/AppShellLayout.tsx
import React from "react";
import {
  AppShell,
  Burger,
  Group,
  Text,
  Box,
  ScrollArea,
  NavLink,
  ActionIcon,
  Stack,  
  Avatar,
  useMantineTheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconLogout } from "@tabler/icons-react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../modules/auth/AuthContext";
import { useBranding } from "../modules/theme/BrandingContext";
import { supabase } from "../lib/supabaseClient";

type NavItem = {
  label: string;
  to: string;
};

const adminNav: NavItem[] = [
  { label: "Dashboard", to: "/admin/dashboard" },
  { label: "Students", to: "/admin/students" },
  { label: "Teachers", to: "/admin/teachers" },
  { label: "Schools", to: "/admin/schools" },
  { label: "Donors", to: "/admin/donors" },
  { label: "Scholarships", to: "/admin/scholarships" },
  { label: "Grant types", to: "/admin/grant-types" },
  { label: "Reports", to: "/admin/reports" },
  { label: "Contact requests", to: "/admin/contact-requests" },
  { label: "Branding", to: "/admin/branding" },
];

const teacherNav: NavItem[] = [
  { label: "Dashboard", to: "/teacher/dashboard" },
  { label: "Students", to: "/teacher/students" },
  { label: "New report", to: "/teacher/reports/new" },
];

const donorNav: NavItem[] = [
  { label: "Your impact", to: "/donor/overview" },
  { label: "Renew your support", to: "/donor/renew" },
];

const AppShellLayout: React.FC = () => {
  const theme = useMantineTheme();
  const [opened, { toggle, close }] = useDisclosure(false);

  const { role, profile } = useAuth();
  const branding = useBranding();
  const location = useLocation();
  const navigate = useNavigate();

  // Pick navigation based on role
  let navItems: NavItem[] = [];
  if (role === "admin") navItems = adminNav;
  if (role === "teacher") navItems = teacherNav;
  if (role === "donor") navItems = donorNav;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const initials =
    profile?.full_name?.trim()?.charAt(0)?.toUpperCase() ??
    profile?.email?.trim()?.charAt(0)?.toUpperCase() ??
    "?";

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 260,
        breakpoint: "sm",
        collapsed: { mobile: !opened, desktop: false },
      }}
      padding="md"
    >
      {/* Header */}
      <AppShell.Header>
        <Group
          h="100%"
          px="sm"
          justify="space-between"
          wrap="nowrap"
        >
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            {branding.logo_url ? (
              <Group gap="xs" wrap="nowrap">
                <Box
                  component={Link}
                  to="/"
                  style={{ textDecoration: "none" }}
                >
                  <img
                    src={branding.logo_url}
                    alt="Logo"
                    style={{
                      height: 28, // smaller on all devices
                      maxWidth: "140px",
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                </Box>
                <Box visibleFrom="sm">
                  <Text fw={600} size="sm">
                    iCare Donor Dashboard
                  </Text>
                  {role === "donor" && (
                    <Text size="xs" c="dimmed">
                      Thank you for supporting education
                    </Text>
                  )}
                  {role === "teacher" && (
                    <Text size="xs" c="dimmed">
                      Helping students share their progress
                    </Text>
                  )}
                  {role === "admin" && (
                    <Text size="xs" c="dimmed">
                      Manage students, donors and reports
                    </Text>
                  )}
                </Box>
              </Group>
            ) : (
              <Box component={Link} to="/" style={{ textDecoration: "none" }}>
                <Text fw={700} size="sm">
                  iCare Dashboard
                </Text>
                {role === "donor" && (
                  <Text size="xs" c="dimmed">
                    Thank you for supporting education
                  </Text>
                )}
              </Box>
            )}
          </Group>

          {/* Right side: profile + logout */}
          <Group gap="xs" wrap="nowrap">
            <Box hiddenFrom="xs">
              {role === "donor" && (
                <Text size="xs" c="dimmed">
                  Continue your impact
                </Text>
              )}
            </Box>
            <Avatar
              radius="xl"
              size="sm"
              component={Link}
              to="/profile"
              style={{ textDecoration: "none", cursor: "pointer" }}
            >
              {initials}
            </Avatar>
            <ActionIcon
              variant="subtle"
              aria-label="Logout"
              onClick={handleLogout}
            >
              <IconLogout size={18} />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      {/* Sidebar / Navbar */}
      <AppShell.Navbar p="sm">
        <ScrollArea
          style={{ height: "100%" }}
          type="auto"
          scrollbarSize={6}
        >
          <Stack gap="xs">
            {navItems.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  component={Link}
                  to={item.to}
                  label={item.label}
                  active={active}
                  onClick={close}
                />
              );
            })}

            {/* Common profile link */}
            <Box mt="sm">
              <NavLink
                component={Link}
                to="/profile"
                label="Your profile"
                active={location.pathname.startsWith("/profile")}
                onClick={close}
              />
            </Box>
          </Stack>
        </ScrollArea>
      </AppShell.Navbar>

      {/* Main content */}
      <AppShell.Main>
        <Box
          style={{
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          <Outlet />
        </Box>
      </AppShell.Main>
    </AppShell>
  );
};

export default AppShellLayout;
