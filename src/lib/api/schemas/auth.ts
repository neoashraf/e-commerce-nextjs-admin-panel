import { z } from "zod";

/**
 * Zod schemas for the admin auth endpoints, derived from
 * docs/api-contracts/16-rbac.md (Admin Authentication). safeParse at the API
 * boundary — the backend's shape is external input (fe-api-integration).
 */

export const adminUserSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  email: z.string().email(),
  role: z.string(),
  permissions: z.array(z.string()),
});
export type AdminUserDto = z.infer<typeof adminUserSchema>;

/**
 * The `admin` object returned by the auth endpoints (login / 2fa verify) is a
 * lighter projection than the full profile: per docs/api-contracts/16-rbac.md,
 * login returns `{ id, full_name, role }` and 2fa/verify returns `{ id, role }`.
 * The full profile (full_name, email, permissions) is hydrated by GET /admin/me.
 */
export const authAdminSchema = z.object({
  id: z.string(),
  role: z.string(),
  full_name: z.string().optional(),
  email: z.string().email().optional(),
  permissions: z.array(z.string()).optional(),
});
export type AuthAdminDto = z.infer<typeof authAdminSchema>;

export const tokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});
export type TokensDto = z.infer<typeof tokensSchema>;

/**
 * POST /admin/auth/login returns either a full session, or a 2FA challenge.
 * Discriminated by the presence of `twofa_required`.
 */
export const loginResultSchema = z.union([
  z.object({
    twofa_required: z.literal(true),
    challenge_id: z.string(),
    channel: z.string(),
    expires_in: z.number(),
  }),
  z.object({
    // login returns a lighter admin ({ id, full_name, role }); the full profile
    // (email, permissions) comes from GET /admin/me.
    admin: authAdminSchema,
    tokens: tokensSchema,
  }),
]);
export type LoginResult = z.infer<typeof loginResultSchema>;

export const twoFaVerifySchema = z.object({
  // 2fa/verify returns the minimal admin ({ id, role }); full profile from GET /admin/me.
  admin: authAdminSchema,
  tokens: tokensSchema,
});

/**
 * POST /admin/auth/password/forgot and /reset (FR-RBAC-007). Both return a
 * generic message; forgot is anti-enumeration (always 200). Reset errors:
 * 410 (token expired/used), 400 (weak password).
 */
export const messageResultSchema = z.object({
  message: z.string().optional(),
});
export type MessageResult = z.infer<typeof messageResultSchema>;
