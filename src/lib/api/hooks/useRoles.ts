"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  permissionCatalogSchema,
  roleListSchema,
  roleDetailSchema,
  createRoleResultSchema,
  updateRoleResultSchema,
  type Permission,
  type RoleDetail,
} from "@/lib/api/schemas/roles";
import type { RoleOption } from "@/lib/api/schemas/admin-users";

/**
 * Roles + permission-catalog hooks (rbac-roles-permissions-fe). All via the api
 * client; role mutations invalidate the list + the edited role.
 */
export const roleKeys = {
  list: ["roles"] as const,
  detail: (id: string) => ["roles", id] as const,
  catalog: ["permission-catalog"] as const,
};

export function useRoleList() {
  return useQuery({
    queryKey: roleKeys.list,
    queryFn: (): Promise<RoleOption[]> =>
      api.get("/admin/roles", { schema: roleListSchema }) as Promise<RoleOption[]>,
    staleTime: 60_000,
  });
}

export function usePermissionCatalog() {
  return useQuery({
    queryKey: roleKeys.catalog,
    queryFn: (): Promise<Permission[]> =>
      api.get("/admin/permissions", { schema: permissionCatalogSchema }) as Promise<Permission[]>,
    staleTime: 10 * 60_000,
  });
}

export function useRoleDetail(id: string) {
  return useQuery({
    queryKey: roleKeys.detail(id),
    enabled: !!id,
    queryFn: (): Promise<RoleDetail> =>
      api.get(`/admin/roles/${id}`, { schema: roleDetailSchema }) as Promise<RoleDetail>,
    staleTime: 30_000,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; permissions: string[] }) =>
      api.post("/admin/roles", body, { schema: createRoleResultSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: roleKeys.list }),
  });
}

export function useUpdateRole(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; description?: string; permissions: string[]; updated_at?: string }) =>
      api.patch(`/admin/roles/${id}`, body, { schema: updateRoleResultSchema }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roleKeys.list });
      qc.invalidateQueries({ queryKey: roleKeys.detail(id) });
    },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/admin/roles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: roleKeys.list }),
  });
}
