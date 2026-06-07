import { Suspense } from "react";
import { UsersView } from "@/components/admin-users/UsersView";

/** Admin users list — /admin/users (rbac-admin-users-fe). Gated by the shell's
 * PermissionBoundary (rbac.admin_user.read). */
export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
      <UsersView />
    </Suspense>
  );
}
