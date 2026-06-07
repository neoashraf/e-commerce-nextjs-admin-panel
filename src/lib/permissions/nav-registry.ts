import { NAV_SECTIONS } from "@/config/nav";

/**
 * Route → required-permission registry (rbac-admin-shell-fe). Derived from the
 * sidebar nav config so the gating permission for a given admin route lives in
 * one place. Used by the shell's route guard to render a 403 view when an admin
 * deep-links a route they lack (defense-in-depth; the server is authoritative).
 */
const ROUTE_PERMISSION: Record<string, string> = Object.fromEntries(
  NAV_SECTIONS.flatMap((s) => s.items.map((i) => [i.href, i.permission] as const)),
);

/**
 * The permission required for an admin pathname, or undefined if the route isn't
 * permission-gated (e.g. the dashboard landing). Matches the longest nav href
 * that prefixes the path so nested routes inherit their section's permission.
 */
export function permissionForPath(pathname: string): string | undefined {
  let best: string | undefined;
  let bestLen = -1;
  for (const [href, perm] of Object.entries(ROUTE_PERMISSION)) {
    if ((pathname === href || pathname.startsWith(`${href}/`)) && href.length > bestLen) {
      best = perm;
      bestLen = href.length;
    }
  }
  return best;
}
