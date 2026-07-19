"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  meProfileSchema,
  messageSchema,
  twoFaConfirmSchema,
  twoFaUpdateSchema,
  type MeProfile,
  type TwoFaUpdateResult,
} from "@/lib/api/schemas/me";

/**
 * Admin self-service profile/security hooks (rbac-admin-profile-fe). Reads
 * GET /admin/me (richer than the auth-store snapshot) and patches profile,
 * password, and own 2FA. All via the api client.
 */
export const meKeys = { profile: ["admin", "me", "profile"] as const };

export function useMyProfile() {
  return useQuery({
    queryKey: meKeys.profile,
    queryFn: (): Promise<MeProfile> =>
      api.get("/admin/me", { schema: meProfileSchema }) as Promise<MeProfile>,
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { full_name?: string; phone?: string | null }) =>
      api.patch("/admin/me", body, { schema: meProfileSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: meKeys.profile }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      api.patch("/admin/me/password", body, { schema: messageSchema }),
  });
}

export function useUpdateTwoFa() {
  const qc = useQueryClient();
  return useMutation({
    // Email-only (contract 16 v0.2): no channel. `code` = fresh emailed code for the
    // disable path when the session is not 2FA-verified (FR-RBAC-009).
    mutationFn: (body: {
      enabled: boolean;
      current_password: string;
      code?: string;
    }): Promise<TwoFaUpdateResult> =>
      api.patch("/admin/me/2fa", body, { schema: twoFaUpdateSchema }) as Promise<TwoFaUpdateResult>,
    onSuccess: () => qc.invalidateQueries({ queryKey: meKeys.profile }),
  });
}

export function useConfirmTwoFa() {
  const qc = useQueryClient();
  return useMutation({
    // POST /admin/me/2fa/confirm — activates 2FA (FR-RBAC-008); other sessions revoked.
    mutationFn: (body: { challenge_id: string; code: string }) =>
      api.post("/admin/me/2fa/confirm", body, { schema: twoFaConfirmSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: meKeys.profile }),
  });
}
