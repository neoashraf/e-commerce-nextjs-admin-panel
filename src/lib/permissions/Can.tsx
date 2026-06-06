"use client";

import { usePermissions } from "./usePermissions";

/**
 * Declarative permission gate (rbac-admin-shell-fe AC3, FR-RBAC-032). Renders
 * its children only when the admin holds the required permission(s); otherwise
 * renders `fallback` (default: nothing). Reused by every admin CRUD screen to
 * gate buttons/actions. Server enforcement remains authoritative.
 *
 *   <Can permission="catalog.product.create"><NewProductButton/></Can>
 *   <Can anyOf={["orders.order.read","orders.order.update"]}>…</Can>
 */
export function Can({
  permission,
  anyOf,
  allOf,
  fallback = null,
  children,
}: {
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can, canAny, canAll } = usePermissions();

  const allowed =
    (permission ? can(permission) : true) &&
    (anyOf ? canAny(anyOf) : true) &&
    (allOf ? canAll(allOf) : true);

  return <>{allowed ? children : fallback}</>;
}
