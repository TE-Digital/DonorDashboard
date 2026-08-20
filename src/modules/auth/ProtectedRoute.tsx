// src/modules/auth/ProtectedRoute.tsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useViewAs } from "../viewAs/ViewAsContext";
import { Center } from "@mantine/core";
import { LoadingState } from "../../design-system";

type AppRole = "admin" | "teacher" | "donor";

export const ProtectedRoute: React.FC = () => {
  const { loading, session } = useAuth() as {
    loading: boolean;
    session: unknown | null;
  };

  if (loading) {
    return (
      <Center h="100vh">
        <LoadingState variant="inline" />
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
  // An admin previewing the teacher product reaches /teacher/*. This is a
  // routing decision only: every row they see there is one an admin can already
  // read, and the database policies are unchanged.
  const { viewRole, availableRoles } = useViewAs();

  if (loading) {
    return (
      <Center h="100vh">
        <LoadingState variant="inline" />
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

  const previewing =
    availableRoles.includes(viewRole as AppRole) && allowed.includes(viewRole as AppRole);

  const isAllowed = allowed.some((r) => effectiveRoles.has(r)) || previewing;

  if (!isAllowed) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

