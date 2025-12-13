// src/modules/auth/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, Profile } from "../../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export type Role = "admin" | "teacher" | "donor" | "agent" | "unknown" | null;

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  role: Role;        // primary UI role
  roles: Role[];     // all roles assigned to this user

  // logout/signOut
  logout: () => Promise<void>;
  signOut: () => Promise<void>;

  // helpers
  hasRole: (role: Exclude<Role, null | "unknown">) => boolean;
  isAdmin: boolean;
  isTeacher: boolean;

  // actions
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  profile: null,
  role: null,
  roles: [],
  // default no-op implementations
  logout: async () => {},
  signOut: async () => {},
  hasRole: () => false,
  isAdmin: false,
  isTeacher: false,
  refresh: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // central function that loads profile + roles for a given session
  const loadUser = async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setProfile(null);
      setRole(null);
      setRoles([]);
      return;
    }

    // 1) Load profile (allow 0 rows)
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentSession.user.id)
      .maybeSingle(); // ⬅️ allow "no row" without throwing

    if (profileError) {
      console.error("Error loading profile", profileError);
      setProfile(null);
      setRole(null);
      setRoles([]);
      return;
    }

    const p = profileData as Profile | null;
    setProfile(p ?? null);

    // If there is no profile row yet, we can still load roles based on user id
    const profileId = p?.id ?? currentSession.user.id;

    // 2) Load roles from person_roles
    const { data: rolesData, error: rolesError } = await supabase
      .from("person_roles")
      .select("role")
      .eq("user_id", profileId);

    if (rolesError) {
      console.error("Error loading roles", rolesError);
      setRole("unknown");
      setRoles([]);
      return;
    }

    const roleStrings = (rolesData ?? []).map(
      (r: any) => r.role as Role
    );
    setRoles(roleStrings);

    // 3) Decide primary UI role
    let primary: Role = null;
    if (roleStrings.includes("admin")) primary = "admin";
    else if (roleStrings.includes("teacher")) primary = "teacher";
    else if (roleStrings.includes("agent")) primary = "agent";
    else if (roleStrings.includes("donor")) primary = "donor";
    else primary = "unknown";

    setRole(primary);
  };

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Error getting session", error);
      setSession(null);
      setProfile(null);
      setRole(null);
      setRoles([]);
      setLoading(false);
      return;
    }
    const currentSession = data.session ?? null;
    setSession(currentSession);
    await loadUser(currentSession);
    setLoading(false);
  };

  useEffect(() => {
    // initial load
    refresh();

    // subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        // on login / refresh
        setLoading(true);
        loadUser(newSession).finally(() => setLoading(false));
      } else {
        // on logout
        setProfile(null);
        setRole(null);
        setRoles([]);
        navigation.navigate("Login");       }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error during sign out", err);
    } finally {
      setSession(null);
      setProfile(null);
      setRole(null);
      setRoles([]);
      setLoading(false);
      navigate("/login", { replace: true });
    }
  };

  const logout = signOut; // 👈 alias so AppShellLayout can call logout()

  const hasRole = (r: Exclude<Role, null | "unknown">) =>
    roles.includes(r) || role === r;

  const value: AuthContextValue = {
    session,
    loading,
    profile,
    role,
    roles,
    logout,
    signOut,
    hasRole,
    isAdmin: hasRole("admin"),
    isTeacher: hasRole("teacher"),
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

