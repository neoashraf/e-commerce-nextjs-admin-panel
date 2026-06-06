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
  /** True for a Super Admin — 2FA is mandatory (locked on). */
  is_super_admin: z.boolean().optional(),
  two_fa_enabled: z.boolean().optional(),
  two_fa_channel: z.enum(["sms", "email", "app"]).nullable().optional(),
  last_login_at: z.string().nullable().optional(),
  permissions: z.array(z.string()).default([]),
});
export type MeProfile = z.infer<typeof meProfileSchema>;

export const messageSchema = z.object({ message: z.string().optional() });

/** PATCH /admin/me/2fa response (the new 2FA state, or a confirm challenge). */
export const twoFaUpdateSchema = z.union([
  z.object({ two_fa_enabled: z.boolean(), two_fa_channel: z.string().nullable().optional() }),
  z.object({ challenge_id: z.string(), channel: z.string() }),
]);
