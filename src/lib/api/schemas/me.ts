import { z } from "zod";

/**
 * Zod schemas for the admin self-service profile/security endpoints
 * (GET/PATCH /admin/me, PATCH /admin/me/password, /admin/me/2fa —
 * docs/api-contracts/16-rbac.md).
 */
export const meProfileSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  role: z.string(),
  /** True for a Super Admin — 2FA is opt-in for every admin (no locked-on state). */
  is_super_admin: z.boolean().optional(),
  two_fa_enabled: z.boolean().optional(),
  /** Whether THIS session passed the 2FA step at login — the disable flow needs a fresh code when false (FR-RBAC-009). */
  session_mfa_verified: z.boolean().optional(),
  last_login_at: z.string().nullable().optional(),
  permissions: z.array(z.string()).default([]),
});
export type MeProfile = z.infer<typeof meProfileSchema>;

export const messageSchema = z.object({ message: z.string().optional() });

/**
 * PATCH /admin/me/2fa response (contract 16 v0.2): current state, plus a
 * `verification` challenge when a code was just emailed (enable start, or a
 * disable that needs a fresh code). Email-only — no channel field.
 */
export const twoFaVerificationSchema = z.object({
  challenge_id: z.string(),
  /** Masked account email, e.g. `o**@store.com`. */
  sent_to: z.string(),
  expires_in: z.number(),
  resend_after: z.number().optional(),
});
export type TwoFaVerification = z.infer<typeof twoFaVerificationSchema>;

export const twoFaUpdateSchema = z.object({
  two_fa_enabled: z.boolean(),
  verification: twoFaVerificationSchema.optional(),
});
export type TwoFaUpdateResult = z.infer<typeof twoFaUpdateSchema>;

/** POST /admin/me/2fa/confirm response — 2FA activates only now (FR-RBAC-008). */
export const twoFaConfirmSchema = z.object({ two_fa_enabled: z.boolean() });
