"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  adminUserPageSchema,
  inviteResultSchema,
  roleListSchema,
  type AdminUserPage,
  type RoleOption,
} from "@/lib/api/schemas/admin-users";

/**
 * Admin-user management + roles-list hooks (rbac-admin-users-fe). All via the
 * api client; mutations invalidate the list so status/role changes reflect.
 */
export const adminUserKeys = {
  list: (qs: string) => ["admin-users", qs] as const,
  roles: ["admin-roles"] as const,
};

export function useAdminUsers(params: Record<string, string | number | boolean | undefined>) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: adminUserKeys.list(qs),
    // rawEnvelope so the list view can read meta.total for pagination. Bulk
    // consumers (recipient/assignee pickers) read `.data` off the same envelope.
    queryFn: (): Promise<AdminUserPage> =>
      api.get("/admin/users", { schema: adminUserPageSchema, params, rawEnvelope: true }) as Promise<AdminUserPage>,
    staleTime: 20_000,
  });
}

export function useRoles() {
  return useQuery({
    queryKey: adminUserKeys.roles,
    queryFn: (): Promise<RoleOption[]> =>
      api.get("/admin/roles", { schema: roleListSchema }) as Promise<RoleOption[]>,
    staleTime: 5 * 60_000,
  });
}

export function useInviteAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { full_name: string; email: string; phone?: string; role_id: string }) =>
      api.post("/admin/users", body, { schema: inviteResultSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useEditAdmin(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { full_name?: string; phone?: string; role_id?: string }) =>
      api.patch(`/admin/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

/** Suspend / reactivate / soft-delete / resend-invite row actions. */
export function useAdminUserActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });
  return {
    suspend: useMutation({ mutationFn: (id: string) => api.post(`/admin/users/${id}/suspend`), onSuccess: invalidate }),
    reactivate: useMutation({ mutationFn: (id: string) => api.post(`/admin/users/${id}/reactivate`), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => api.delete<void>(`/admin/users/${id}`), onSuccess: invalidate }),
    resendInvite: useMutation({ mutationFn: (id: string) => api.post(`/admin/users/${id}/resend-invite`) }),
  };
}
