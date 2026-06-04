"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth";
import { useAdminLogout } from "@/lib/api/hooks/useAuth";

/**
 * Admin top bar: mobile menu toggle, current admin identity, and logout.
 */
export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const admin = useAuthStore((s) => s.admin);
  const logout = useAdminLogout();

  const onLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => router.replace("/login"),
    });
  };

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
      <button
        type="button"
        onClick={onMenuClick}
        className="-ml-1 rounded-md p-2 text-gray-600 hover:bg-gray-100 md:hidden"
        aria-label="Open navigation menu"
      >
        <span aria-hidden className="block h-0.5 w-5 bg-current shadow-[0_6px_0_currentColor,0_-6px_0_currentColor]" />
      </button>

      <div className="flex flex-1 items-center justify-end gap-4">
        {admin && (
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-gray-900">{admin.full_name}</p>
            <p className="text-xs text-gray-500">{admin.role}</p>
          </div>
        )}
        <button
          type="button"
          onClick={onLogout}
          disabled={logout.isPending}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {logout.isPending ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}
