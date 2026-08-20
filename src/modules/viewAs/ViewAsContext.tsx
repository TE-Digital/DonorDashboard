// src/modules/viewAs/ViewAsContext.tsx
//
// Which product the signed-in account is currently looking at.
//
// This is a presentation concern only. Nothing here grants access: the session,
// its roles and every row-level policy are exactly what they were. An admin can
// preview the teacher product because an admin can already read every student
// and report; a teacher who switches nothing simply sees their own.
//
// Two values make up a view:
//   viewRole   which shell, nav and home screen to render
//   teacherId  whose roster the teacher product should show
//
// Both persist in localStorage so a page reload does not throw the admin back
// into the admin console mid-task.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";

export type ViewRole = "admin" | "teacher" | "donor";

export interface TeacherOption {
  id: string;
  name: string;
}

interface ViewAsValue {
  /** The product being rendered. */
  viewRole: ViewRole;
  /** Roles this account may render — its own, plus the teacher preview for admins. */
  availableRoles: ViewRole[];
  setViewRole: (role: ViewRole) => void;

  /** profiles.id whose roster the teacher product shows. Null before it resolves. */
  teacherId: string | null;
  setTeacherId: (id: string | null) => void;
  /** Teachers an admin can preview. Empty for a real teacher — they are the only one. */
  teacherOptions: TeacherOption[];

  /** True when the account is previewing a role it does not itself hold. */
  simulated: boolean;
  /** Who is being previewed, for the banner. */
  simulatedName: string | null;
  /** Leaves the preview and returns to the account's own product. */
  resetView: () => void;
}

const ROLE_KEY = "icare.viewRole";
const TEACHER_KEY = "icare.viewTeacherId";

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string | null) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private browsing — the view simply will not persist */
  }
};

const ViewAsContext = createContext<ViewAsValue>({
  viewRole: "admin",
  availableRoles: [],
  setViewRole: () => {},
  teacherId: null,
  setTeacherId: () => {},
  teacherOptions: [],
  simulated: false,
  simulatedName: null,
  resetView: () => {},
});

export const ViewAsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, role, roles, loading } = useAuth();

  const ownRoles = useMemo<ViewRole[]>(() => {
    const out: ViewRole[] = [];
    const push = (value: unknown) => {
      if ((value === "admin" || value === "teacher" || value === "donor") && !out.includes(value)) {
        out.push(value);
      }
    };
    if (Array.isArray(roles)) roles.forEach(push);
    push(role);
    return out;
  }, [role, roles]);

  const isAdmin = ownRoles.includes("admin");

  // An admin gets the teacher product as a preview; everybody else sees only
  // what they hold. Nothing here is a permission — see the file header.
  const availableRoles = useMemo<ViewRole[]>(() => {
    const out = [...ownRoles];
    if (isAdmin && !out.includes("teacher")) out.push("teacher");
    return out;
  }, [ownRoles, isAdmin]);

  const [viewRole, setViewRoleState] = useState<ViewRole>("admin");
  const [teacherId, setTeacherIdState] = useState<string | null>(null);
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([]);
  const [resolved, setResolved] = useState(false);

  // Settle on a view once the session's roles are known: the stored one if it is
  // still legal for this account, otherwise the account's own primary role.
  useEffect(() => {
    if (loading || !availableRoles.length || resolved) return;
    const stored = read(ROLE_KEY) as ViewRole | null;
    setViewRoleState(stored && availableRoles.includes(stored) ? stored : availableRoles[0]);
    setResolved(true);
  }, [loading, availableRoles, resolved]);

  // A real teacher is always themselves. An admin picks, and the choice sticks.
  useEffect(() => {
    if (!profile?.id) return;
    if (ownRoles.includes("teacher") && !isAdmin) {
      setTeacherIdState(profile.id);
      return;
    }
    const stored = read(TEACHER_KEY);
    setTeacherIdState(stored ?? (ownRoles.includes("teacher") ? profile.id : null));
  }, [profile?.id, ownRoles, isAdmin]);

  // The roster of teachers an admin can preview.
  useEffect(() => {
    if (!isAdmin) return;

    const load = async () => {
      const [{ data: roleRows }, { data: profileRows }] = await Promise.all([
        supabase.from("person_roles").select("user_id").eq("role", "teacher"),
        supabase.from("profiles").select("id, full_name").order("full_name"),
      ]);

      const teacherIds = new Set(
        ((roleRows ?? []) as Array<{ user_id: string }>).map((row) => row.user_id),
      );

      setTeacherOptions(
        ((profileRows ?? []) as Array<{ id: string; full_name: string | null }>)
          .filter((row) => teacherIds.has(row.id))
          .map((row) => ({ id: row.id, name: row.full_name ?? "(no name)" })),
      );
    };

    void load();
  }, [isAdmin]);

  // An admin who has never picked a teacher gets the first one, so the teacher
  // product is never an empty screen with no explanation.
  useEffect(() => {
    if (viewRole !== "teacher" || teacherId || !teacherOptions.length) return;
    setTeacherIdState(teacherOptions[0].id);
    write(TEACHER_KEY, teacherOptions[0].id);
  }, [viewRole, teacherId, teacherOptions]);

  const setViewRole = useCallback((next: ViewRole) => {
    setViewRoleState(next);
    write(ROLE_KEY, next);
  }, []);

  const setTeacherId = useCallback((next: string | null) => {
    setTeacherIdState(next);
    write(TEACHER_KEY, next);
  }, []);

  const resetView = useCallback(() => {
    const own = ownRoles[0] ?? "admin";
    setViewRoleState(own);
    write(ROLE_KEY, own);
  }, [ownRoles]);

  const simulated = viewRole === "teacher" && !ownRoles.includes("teacher");

  const value = useMemo<ViewAsValue>(
    () => ({
      viewRole,
      availableRoles,
      setViewRole,
      teacherId,
      setTeacherId,
      teacherOptions,
      simulated,
      simulatedName: teacherOptions.find((option) => option.id === teacherId)?.name ?? null,
      resetView,
    }),
    [
      viewRole,
      availableRoles,
      setViewRole,
      teacherId,
      setTeacherId,
      teacherOptions,
      simulated,
      resetView,
    ],
  );

  return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>;
};

export const useViewAs = () => useContext(ViewAsContext);

/**
 * The teacher whose data the teacher product should read.
 *
 * Every teacher screen asks this instead of reaching for the session, which is
 * what lets one set of screens serve both a teacher and an admin previewing one.
 */
export const useEffectiveTeacherId = (): string | null => {
  const { profile } = useAuth();
  const { viewRole, teacherId } = useViewAs();
  if (viewRole === "teacher") return teacherId ?? profile?.id ?? null;
  return profile?.id ?? null;
};
