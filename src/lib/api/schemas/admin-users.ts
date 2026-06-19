import { z } from "zod";
import { paginated } from "@/lib/api/schemas/pagination";

/**
 * Zod schemas for admin-user management + roles list
 * (/admin/users*, GET /admin/roles — docs/api-contracts/16-rbac.md).
 */

export const adminUserStatusSchema = z.enum(["active", "suspended", "pending", "deleted"]);
export type AdminUserStatus = z.infer<typeof adminUserStatusSchema>;

export const adminUserRowSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  email: z.string().email(),
  role: z.string(),
  role_id: z.string().optional(),
  status: adminUserStatusSchema,
  last_login_at: z.string().nullable().optional(),
});
export type AdminUserRow = z.infer<typeof adminUserRowSchema>;

export const adminUserListSchema = z.array(adminUserRowSchema);
/** Paginated envelope for GET /admin/users (rawEnvelope: { data, meta }). */
export const adminUserPageSchema = paginated(adminUserListSchema);
export type AdminUserPage = z.infer<typeof adminUserPageSchema>;

export const inviteResultSchema = z.object({
  id: z.string(),
  status: adminUserStatusSchema,
  invite_sent: z.boolean().default(false),
});

export const roleOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  is_system: z.boolean().optional(),
  assigned_count: z.number().optional(),
  permission_count: z.union([z.number(), z.string()]).optional(),
});
export type RoleOption = z.infer<typeof roleOptionSchema>;

export const roleListSchema = z.array(roleOptionSchema);
