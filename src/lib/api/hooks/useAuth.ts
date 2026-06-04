"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  adminUserSchema,
  loginResultSchema,
  twoFaVerifySchema,
  type LoginResult,
} from "@/lib/api/schemas/auth";
import { useAuthStore, type AdminUser } from "@/lib/stores/auth";

/**
 * React Query hooks for admin auth (docs/api-contracts/16-rbac.md).
 * Reads use stable keys; the session itself lives in the Zustand auth store,
 * not React Query, because it's client state shared outside the query cache.
 */

export const authKeys = {
  me: ["admin", "me"] as const,
};

/** GET /admin/me — current admin + effective permissions. */
export function useAdminMe() {
  const tokens = useAuthStore((s) => s.tokens);
  const setAdmin = useAuthStore((s) => s.setAdmin);

  return useQuery({
    queryKey: authKeys.me,
    enabled: !!tokens, // don't fetch protected data without a token
    queryFn: async () => {
      const admin = await api.get("/admin/me", { schema: adminUserSchema });
      setAdmin(admin as AdminUser);
      return admin;
    },
    staleTime: 5 * 60_000,
  });
}

/** POST /admin/auth/login. Stores the session on a non-2FA success. */
export function useAdminLogin() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api.post<LoginResult>("/admin/auth/login", body, {
        public: true,
        schema: loginResultSchema,
      }),
    onSuccess: (result) => {
      if ("tokens" in result) {
        setSession(
          {
            id: result.admin.id,
            full_name: result.admin.full_name,
            email: result.admin.email,
            role: result.admin.role,
            permissions: result.admin.permissions ?? [],
          },
          {
            accessToken: result.tokens.access_token,
            refreshToken: result.tokens.refresh_token,
          },
        );
      }
      // 2FA-required results are handled by the caller (show the OTP step).
    },
  });
}

/** POST /admin/auth/2fa/verify. */
export function useAdminTwoFaVerify() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (body: { challenge_id: string; code: string }) =>
      api.post("/admin/auth/2fa/verify", body, {
        public: true,
        schema: twoFaVerifySchema,
      }),
    onSuccess: (result) => {
      setSession(
        {
          id: result.admin.id,
          full_name: result.admin.full_name,
          email: result.admin.email,
          role: result.admin.role,
          permissions: result.admin.permissions ?? [],
        },
        {
          accessToken: result.tokens.access_token,
          refreshToken: result.tokens.refresh_token,
        },
      );
    },
  });
}

/** POST /admin/auth/logout — best-effort server revoke, always clears locally. */
export function useAdminLogout() {
  const clear = useAuthStore((s) => s.clear);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => api.post("/admin/auth/logout").catch(() => undefined),
    onSettled: () => {
      clear();
      qc.clear();
    },
  });
}
