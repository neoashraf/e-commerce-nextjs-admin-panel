"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
 *
 * When `collapsed` is true the rail is an icon-only strip: the brand wordmark and
 * section headers/labels fade out and the icons center. Items keep their full
 * label as a native `title` tooltip so the rail stays usable when collapsed.
 */
export function Sidebar({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const admin = useAuthStore((s) => s.admin);
  const permissions = admin?.permissions ?? [];

  // Until /admin/me resolves we have no permissions — show all so the nav isn't
  // empty on first paint; real access is enforced by the backend per request.
  const canSee = (perm: string) =>
    permissions.length === 0 || permissions.includes(perm);

  return (
    <nav className="flex h-full flex-col">
      {/* Brand block — dark "C" tile + wordmark, aligned to the topbar height. */}
      <div
        className={cn(
          "flex h-14 items-center gap-2.5 border-b border-border",
          collapsed ? "justify-center px-0" : "px-4",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-text text-[15px] font-bold tracking-tight text-surface">
          C
        </span>
        {!collapsed && (
          <span className="flex min-w-0 flex-col leading-[1.15]">
            <span className="truncate text-[13.5px] font-bold text-text">
              Commerce Admin
            </span>
            <span className="truncate text-[10.5px] tracking-wide text-text-faint">
              White-label console
            </span>
          </span>
        )}
      </div>

      <div
        className={cn(
          "no-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto py-4",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((i) => canSee(i.permission));
          if (items.length === 0) return null;
          return (
            <div key={section.title}>
              {!collapsed && (
                <p className="px-2 pb-1.5 text-eyebrow uppercase tracking-wide text-text-faint">
                  {section.title}
                </p>
              )}
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
                        title={collapsed ? item.label : undefined}
                        aria-label={collapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex items-center gap-2.5 rounded-md py-2 text-sm transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
                          collapsed ? "justify-center px-2" : "px-2",
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
                        {!collapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
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
