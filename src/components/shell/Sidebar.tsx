"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS } from "@/config/nav";
import { useAuthStore } from "@/lib/stores/auth";

/**
 * Admin sidebar. Renders only the nav items the signed-in admin has permission
 * for (permissions come from GET /admin/me). On mobile it slides in over the
 * content; on md+ it's a fixed rail (handled by the shell layout).
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
    <nav className="no-scrollbar flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div className="px-2 text-lg font-semibold text-gray-900">
        Sports Admin
      </div>
      <div className="flex flex-col gap-5">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((i) => canSee(i.permission));
          if (items.length === 0) return null;
          return (
            <div key={section.title}>
              <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={[
                          "block rounded-md px-2 py-2 text-sm transition-colors",
                          active
                            ? "bg-brand-50 font-medium text-brand-700"
                            : "text-gray-700 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        {item.label}
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
