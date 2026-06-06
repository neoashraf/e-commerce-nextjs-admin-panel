"use client";

import Link from "next/link";
import { useRoleDetail } from "@/lib/api/hooks/useRoles";
import { RoleEditor } from "@/components/roles/RoleEditor";

/** Loads a role's detail then renders the editor (rbac-roles-permissions-fe). */
export function EditRoleView({ id }: { id: string }) {
  const { data, isLoading, isError } = useRoleDetail(id);

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
  if (isError || !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-600">We couldn&apos;t find that role.</p>
        <Link href="/admin/roles" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">Back to roles</Link>
      </div>
    );
  }
  return <RoleEditor mode="edit" role={data} />;
}
