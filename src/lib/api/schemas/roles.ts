import { z } from "zod";
import { roleOptionSchema } from "./admin-users";

/**
 * Zod schemas for roles + the permission catalog
 * (/admin/roles*, GET /admin/permissions — docs/api-contracts/16-rbac.md).
 */

export const permissionSchema = z.object({
  code: z.string(),
  module: z.string(),
  description: z.string().optional(),
});
export type Permission = z.infer<typeof permissionSchema>;

export const permissionCatalogSchema = z.array(permissionSchema);

/** Roles list row (reuses the role-option shape from admin-users). */
export const roleListSchema = z.array(roleOptionSchema);

export const roleDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  is_system: z.boolean().optional(),
  is_super_admin: z.boolean().optional(),
  permissions: z.array(z.string()).default([]),
  updated_at: z.string().optional(),
});
export type RoleDetail = z.infer<typeof roleDetailSchema>;

export const createRoleResultSchema = z.object({ id: z.string(), name: z.string() });
export const updateRoleResultSchema = z.object({
  id: z.string(),
  permission_count: z.number().optional(),
});
