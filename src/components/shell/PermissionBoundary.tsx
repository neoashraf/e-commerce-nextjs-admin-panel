"use client";

import { usePathname } from "next/navigation";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { permissionForPath } from "@/lib/permissions/nav-registry";
import { ForbiddenView } from "./ForbiddenView";

/**
 * Route-level permission guard (rbac-admin-shell-fe AC4). Looks up the
 * permission a route requires (from the nav registry) and renders a 403 view
 * when the admin lacks it. While `/admin/me` is still loading (`!ready`) it
 * shows the page optimistically — the backend rejects any real call anyway.
 */
export function PermissionBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, can } = usePermissions();

  const required = permissionForPath(pathname);
  if (ready && required && !can(required)) {
    return <ForbiddenView />;
  }
  return <>{children}</>;
}
