"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/stores/auth";
import { useAdminLogout } from "@/lib/api/hooks/useAuth";

/**
 * Admin top bar (rbac-admin-shell-fe AC5): mobile menu toggle + an account menu
 * showing the admin name + role badge, with "My profile / Security" and a
 * Logout action (revokes server-side, clears the store, redirects to login).
 * Keyboard-accessible menu: Esc + outside-click close, focus returns to trigger.
 */
export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const admin = useAuthStore((s) => s.admin);
  const logout = useAdminLogout();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const onLogout = () => {
    setOpen(false);
    logout.mutate(undefined, { onSettled: () => router.replace("/login") });
  };

  const initial = admin?.full_name?.trim()?.charAt(0)?.toUpperCase() ?? "A";

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

      <div className="flex flex-1 items-center justify-end">
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initial}
            </span>
            <span className="hidden text-right leading-tight sm:block">
              <span className="block max-w-[12rem] truncate font-medium text-gray-900">{admin?.full_name ?? "Admin"}</span>
              {admin?.role && (
                <span className="inline-block rounded bg-gray-100 px-1.5 text-xs font-medium text-gray-600">{admin.role}</span>
              )}
            </span>
          </button>

          {open && (
            <div ref={menuRef} role="menu" aria-label="Account" className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <div className="border-b border-gray-100 px-4 py-2 sm:hidden">
                <p className="truncate text-sm font-medium text-gray-900">{admin?.full_name ?? "Admin"}</p>
                {admin?.role && <p className="text-xs text-gray-500">{admin.role}</p>}
              </div>
              <Link href="/admin/profile" role="menuitem" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                My profile / Security
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={onLogout}
                disabled={logout.isPending}
                className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {logout.isPending ? "Signing out…" : "Log out"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
