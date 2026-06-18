"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store } from "lucide-react";
import { NAV_SECTIONS } from "@/config/nav";
import { useAuthStore } from "@/lib/stores/auth";
import { cn } from "@/lib/cn";

/**
 * Admin sidebar (design-system §7.1). White rail, brand block, grouped nav with
 * UPPERCASE muted headers, lucide icons, and the accent active treatment
 * (accent-50 bg + accent-700 text/icon + a 3px accent-600 left bar).
 *
 * Renders only the nav items the signed-in admin has permission for (permissions
 * come from GET /admin/me). On mobile it slides in over the content; on md+ it's
 * a fixed rail (handled by the shell layout).
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const admin = useAuthStore((s) => s.admin);
  const permissions = admin?.permissions ?? [];

  // Until /admin/me resolves we have no permissions — show all so the nav isn't
  // empty on first paint; real access is enforced by the backend per request.
  const canSee = (perm: string) =>
    permissions.length === 0 || permissions.includes(perm);

  return (
    <nav className="flex h-full flex-col">
      {/* Brand block — aligned to the topbar height (§7.1). */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-600 text-accent-fg">
          <Store className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="text-[15px] font-semibold text-text">Commerce Admin</span>
      </div>

      <div className="no-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((i) => canSee(i.permission));
          if (items.length === 0) return null;
          return (
            <div key={section.title}>
              <p className="px-2 pb-1.5 text-eyebrow uppercase tracking-wide text-text-faint">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
                          active
                            ? "bg-accent-50 font-semibold text-accent-700"
                            : "text-text-secondary hover:bg-surface-hover hover:text-text",
                        )}
                      >
                        {active && (
                          <span
                            className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-accent-600"
                            aria-hidden="true"
                          />
                        )}
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0",
                            active ? "text-accent-700" : "text-text-muted",
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
