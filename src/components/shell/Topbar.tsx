"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, PanelLeft, Search } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth";
import { useAdminLogout } from "@/lib/api/hooks/useAuth";
import { NotificationBell } from "@/components/shell/NotificationBell";

/**
 * Admin top bar (design-system §7.2): mobile menu toggle, a left global search
 * (visual affordance with ⌘K hint), a notifications bell, and an account menu
 * showing the admin name + role with "My profile / Security" and Logout (revokes
 * server-side, clears the store, redirects to login). The bar is quiet — no
 * accent fills; it frames, it doesn't compete.
 *
 * Keyboard-accessible menu: Esc + outside-click close, focus returns to trigger.
 */
export function Topbar({
  onMenuClick,
  onToggleCollapse,
  collapsed = false,
}: {
  onMenuClick: () => void;
  onToggleCollapse?: () => void;
  collapsed?: boolean;
}) {
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
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
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
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        type="button"
        onClick={onMenuClick}
        className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 md:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Desktop sidebar collapse toggle (design-system §7.2) — bordered square
          that shrinks the rail to an icon strip. Hidden on mobile, where the
          drawer toggle above takes over. */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-pressed={collapsed}
        className="hidden h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text-secondary hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 md:inline-flex"
      >
        <PanelLeft className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>

      {/* Global search (visual affordance; backend search is out of scope here). */}
      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search orders, products, customers…"
          aria-label="Search"
          className="h-9 w-full rounded-md border border-border-strong bg-surface pl-9 pr-16 text-sm text-text placeholder:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-surface-subtle px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
          ⌘K
        </kbd>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2.5 sm:flex-none">
        <NotificationBell />

        {/* Hairline divider between the bell and the account menu (§7.2). */}
        <span className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          >
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-full bg-accent-100 text-sm font-semibold text-accent-700"
            >
              {initial}
            </span>
            <span className="hidden text-right leading-tight lg:block">
              <span className="block max-w-[12rem] truncate font-medium text-text">
                {admin?.full_name ?? "Admin"}
              </span>
              {admin?.role && (
                <span className="block text-xs text-text-muted">{admin.role}</span>
              )}
            </span>
            <ChevronDown
              className="hidden h-4 w-4 text-text-muted lg:block"
              aria-hidden="true"
            />
          </button>

          {open && (
            <div
              ref={menuRef}
              role="menu"
              aria-label="Account"
              className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-md"
            >
              <div className="border-b border-border px-4 py-2 lg:hidden">
                <p className="truncate text-sm font-medium text-text">
                  {admin?.full_name ?? "Admin"}
                </p>
                {admin?.role && (
                  <p className="text-xs text-text-muted">{admin.role}</p>
                )}
              </div>
              <Link
                href="/admin/profile"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-subtle"
              >
                My profile / Security
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={onLogout}
                disabled={logout.isPending}
                className="block w-full px-4 py-2.5 text-left text-sm text-text-secondary hover:bg-surface-subtle disabled:opacity-60"
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
