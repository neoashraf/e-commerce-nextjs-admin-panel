"use client";

import Link from "next/link";
import { useAdminUsers } from "@/lib/api/hooks/useAdminUsers";
import { InviteEditForm } from "@/components/admin-users/InviteEditForm";

/**
 * Edit-admin loader. The contract has no single-user GET, so this reads the
 * (deleted-inclusive) list and finds the row, then renders the shared form in
 * edit mode. Loading / not-found handled.
 */
export function EditUserView({ id }: { id: string }) {
  const { data, isLoading, isError } = useAdminUsers({ include_deleted: true, page: 1, limit: 200 });

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
  const user = data?.find((u) => u.id === id);

  if (isError || !user) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-600">We couldn&apos;t find that admin user.</p>
        <Link href="/admin/users" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">Back to admin users</Link>
      </div>
    );
  }

  return (
    <InviteEditForm
      mode="edit"
      initial={{
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role_id: user.role_id,
      }}
    />
  );
}
