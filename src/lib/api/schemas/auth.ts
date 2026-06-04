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
    admin: adminUserSchema.partial({ permissions: true }).extend({
      // login returns a lighter admin; full permissions come from GET /admin/me
      permissions: z.array(z.string()).optional(),
    }),
    tokens: tokensSchema,
  }),
]);
export type LoginResult = z.infer<typeof loginResultSchema>;

export const twoFaVerifySchema = z.object({
  admin: adminUserSchema.partial({ permissions: true }).extend({
    permissions: z.array(z.string()).optional(),
  }),
  tokens: tokensSchema,
});
