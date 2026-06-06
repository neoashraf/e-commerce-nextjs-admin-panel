"use client";

import { useAuthStore } from "@/lib/stores/auth";

/**
 * Permission-gating hook (rbac-admin-shell-fe, FR-RBAC-032). Reads the effective
 * permission keys from the auth store (populated by GET /admin/me) and answers
 * `can(key)` / `canAny` / `canAll`. UI gating is cosmetic — the backend enforces
 * every /admin/* request (§12.10); this just decides what to show.
 *
 * Until /admin/me resolves there are no permissions yet; callers that must not
 * flash hidden UI can gate on `ready`.
 */
export function usePermissions() {
  const admin = useAuthStore((s) => s.admin);
  const permissions = admin?.permissions ?? [];
  const ready = admin !== null;

  const can = (key: string) => permissions.includes(key);
  const canAny = (keys: string[]) => keys.some((k) => permissions.includes(k));
  const canAll = (keys: string[]) => keys.every((k) => permissions.includes(k));

  return { permissions, ready, can, canAny, canAll };
}
