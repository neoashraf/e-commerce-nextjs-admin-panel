import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Admin auth client state (global, low-frequency) — see fe-state-management.
 *
 * Holds the admin's tokens + identity for attaching the Bearer token to API
 * calls and gating the admin shell. The backend is the real authorization
 * boundary (RBAC); this store only decides what UI to show and which token to
 * send. Tokens live in localStorage for now — note the XSS tradeoff
 * (fe-api-integration); migrate to httpOnly cookies if the threat model
 * requires it.
 */

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  /** Effective permission keys from GET /admin/me (e.g. "dashboard.view"). */
  permissions: string[];
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  admin: AdminUser | null;
  tokens: AuthTokens | null;
  /** Gate localStorage reads until the client has hydrated (avoids SSR mismatch). */
  hydrated: boolean;
  setSession: (admin: AdminUser, tokens: AuthTokens) => void;
  setTokens: (tokens: AuthTokens) => void;
  setAdmin: (admin: AdminUser) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      admin: null,
      tokens: null,
      hydrated: false,
      setSession: (admin, tokens) => set({ admin, tokens }),
      setTokens: (tokens) => set({ tokens }),
      setAdmin: (admin) => set({ admin }),
      clear: () => set({ admin: null, tokens: null }),
    }),
    {
      name: "admin-auth",
      partialize: (s) => ({ admin: s.admin, tokens: s.tokens }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

/** Read the current access token outside React (for the API client). */
export function getAccessToken(): string | null {
  return useAuthStore.getState().tokens?.accessToken ?? null;
}

/** True if the signed-in admin has the given permission key. */
export function hasPermission(key: string): boolean {
  return useAuthStore.getState().admin?.permissions.includes(key) ?? false;
}
