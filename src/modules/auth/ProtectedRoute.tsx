// src/modules/auth/ProtectedRoute.tsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Loader, Center } from "@mantine/core";

type AppRole = "admin" | "teacher" | "donor";

export const ProtectedRoute: React.FC = () => {
  const { loading, session } = useAuth() as {
    loading: boolean;
    session: unknown | null;
  };

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

interface RoleRouteProps {
  allowed: AppRole[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ allowed }) => {
  const { role, roles, loading } = useAuth() as {
    role?: string | null;
    roles?: string[] | null;
    loading: boolean;
  };

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  // Build effectiveRoles from single role + roles[]
  const effectiveRoles = new Set<AppRole>();

  if (Array.isArray(roles)) {
    roles.forEach((r) => {
      if (r === "admin" || r === "teacher" || r === "donor") {
        effectiveRoles.add(r);
      }
    });
  }

  if (role === "admin" || role === "teacher" || role === "donor") {
    effectiveRoles.add(role);
  }

  if (effectiveRoles.size === 0) {
    // logged in but no recognized roles → send to login or home
    return <Navigate to="/login" replace />;
  }

  const isAllowed = allowed.some((r) => effectiveRoles.has(r));

  if (!isAllowed) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

