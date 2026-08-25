import { useState, useContext, createContext, useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

export type Role = "site_user" | "checker" | "approver" | "purchase_head" | "purchase_member";

export interface CurrentUser {
  id: number;
  name: string;
  role: Role;
  site_name?: string | null;
}

interface AuthCtx {
  user: CurrentUser | null;
  isLoading: boolean;
  setUser: (u: CurrentUser | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  function logout() {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      // Wipe every cached query, not just sign out — this computer is
      // shared across a whole team for the pilot, so the next person to
      // log in here must never see a flash of the previous person's data.
      queryClient.clear();
      setUser(null);
    });
  }

  return <AuthContext.Provider value={{ user, isLoading, setUser, logout }}>{children}</AuthContext.Provider>;
}

/** For the top-level login gate in App.tsx — user may be null (logged out, or still checking). */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside RoleProvider");
  return ctx;
}

/**
 * For pages inside the app. `user` is safe to treat as always-defined here:
 * App.tsx only ever renders the app's routes once useAuth().user is
 * confirmed non-null (see the login gate in App.tsx), so every page that
 * calls this hook is already past that check.
 */
export function useRole() {
  const { user, setUser } = useAuth();
  if (!user) throw new Error("useRole called outside an authenticated session");
  return { user, setUser: (u: CurrentUser) => setUser(u) };
}

export const ROLE_LABELS: Record<Role, string> = {
  site_user: "Site User",
  checker: "Checker",
  approver: "Approver",
  purchase_head: "Purchase Head",
  purchase_member: "Purchase Member",
  director: "Director",
};
