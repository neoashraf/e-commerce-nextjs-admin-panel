"use client";

import Link from "next/link";
import { useState } from "react";
import { useRoleList, useDeleteRole } from "@/lib/api/hooks/useRoles";
import type { RoleOption } from "@/lib/api/schemas/admin-users";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Roles list (roles-list.md, rbac-roles-permissions-fe AC1/AC2). System/custom
 * badges, permission count ("All" for Super Admin), assigned_count linking to
 * filtered users. Delete only for custom roles; ROLE_IN_USE → blocked dialog.
 */
export function RolesView() {
  const { data, isLoading, isError, refetch } = useRoleList();
  const del = useDeleteRole();
  const [target, setTarget] = useState<RoleOption | null>(null);
  const [blocked, setBlocked] = useState<{ role: RoleOption; count: number } | null>(null);

  async function onDelete() {
    if (!target) return;
    try {
      await del.mutateAsync(target.id);
      setTarget(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === "ROLE_IN_USE") {
        const count = Number((err.details?.[0]?.message as string) ?? target.assigned_count ?? 0);
        setBlocked({ role: target, count: Number.isFinite(count) ? count : (target.assigned_count ?? 0) });
      }
      setTarget(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Roles</h1>
        <Can permission="rbac.role.create">
          <Link href="/admin/roles/new" className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
            Create role
          </Link>
        </Can>
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">Couldn&apos;t load roles.</p>
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button>
        </div>
      ) : !data || data.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">No roles yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((role) => (
            <li key={role.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="break-words font-medium text-gray-900">{role.name}</p>
                <span className={"rounded px-1.5 py-0.5 text-xs font-medium " + (role.is_system ? "bg-gray-100 text-gray-600" : "bg-blue-50 text-blue-700")}>
                  {role.is_system ? "System" : "Custom"}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {typeof role.permission_count === "string" ? "All permissions" : `${role.permission_count ?? 0} permissions`}
              </p>
              {role.assigned_count != null && (
                <Link href={`/admin/users?role=${encodeURIComponent(role.name)}`} className="mt-1 inline-block text-sm text-brand-700 hover:underline">
                  {role.assigned_count} assigned
                </Link>
              )}
              <div className="mt-3 flex items-center gap-3">
                <Can permission="rbac.role.read">
                  <Link href={`/admin/roles/${role.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                    {role.is_system ? "View" : "Edit"}
                  </Link>
                </Can>
                {!role.is_system && (
                  <Can permission="rbac.role.delete">
                    <button type="button" onClick={() => setTarget(role)} className="text-sm font-medium text-red-600 hover:underline">Delete</button>
                  </Can>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!target}
        title="Delete role?"
        message={`The "${target?.name}" role will be permanently removed.`}
        confirmLabel="Delete"
        danger
        pending={del.isPending}
        onConfirm={onDelete}
        onClose={() => setTarget(null)}
      />

      <ConfirmDialog
        open={!!blocked}
        title="Role is in use"
        message={
          <span>
            The &quot;{blocked?.role.name}&quot; role is assigned to {blocked?.count} admin(s). Reassign them before deleting.{" "}
            <Link href={`/admin/users?role=${encodeURIComponent(blocked?.role.name ?? "")}`} className="font-medium text-brand-700 hover:underline">View assigned users</Link>
          </span>
        }
        confirmLabel="OK"
        onConfirm={() => setBlocked(null)}
        onClose={() => setBlocked(null)}
      />
    </div>
  );
}
