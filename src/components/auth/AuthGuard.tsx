"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth";
import { useAdminMe } from "@/lib/api/hooks/useAuth";

/**
 * Client-side guard for the admin shell. Redirects to /login when no token is
 * present. This is UX only — the backend authorizes every /admin/* request
 * (fe-page-scaffold, fe-api-integration). Gated on `hydrated` so we don't
 * redirect before the persisted token is read from localStorage.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const tokens = useAuthStore((s) => s.tokens);

  // Loads /admin/me into the store so the sidebar knows the admin's permissions.
  useAdminMe();

  useEffect(() => {
    if (hydrated && !tokens) router.replace("/login");
  }, [hydrated, tokens, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (!tokens) return null; // redirect in flight

  return <>{children}</>;
}
