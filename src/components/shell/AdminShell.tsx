"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { PermissionBoundary } from "@/components/shell/PermissionBoundary";
import { useAdminNotificationStream } from "@/lib/hooks/useAdminNotificationStream";

const COLLAPSE_KEY = "admin.sidebar.collapsed";

/**
 * Admin shell layout: fixed sidebar rail on md+, slide-over drawer on mobile,
 * topbar, and the scrollable content region. Per fe-page-scaffold: admin shell
 * = sidebar + flex-1 p-4 md:p-6 content.
 *
 * The desktop rail can be collapsed to an icon-only strip via the topbar collapse
 * button (design-system §7.2). The preference is persisted in localStorage so it
 * survives reloads.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restore the saved collapse preference after mount (avoids SSR hydration
  // mismatch — the server always renders the expanded rail).
  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });

  // Real-time in-app notifications (new-order alerts): one SSE subscription for the whole shell.
  useAdminNotificationStream();

  return (
    // h-screen + overflow-hidden makes the shell own the full viewport height so
    // the sidebar and the main content scroll independently (the sidebar stays
    // put while only <main> scrolls), instead of the page scrolling as one unit.
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Desktop sidebar — collapses to an icon rail; the Sidebar owns its
          internal scroll (brand block stays put). */}
      <aside
        className={`hidden shrink-0 overflow-hidden border-r border-border bg-surface transition-[width] duration-200 ease-out md:block ${
          collapsed ? "w-[68px]" : "w-64"
        }`}
      >
        <Sidebar collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-64 overflow-hidden bg-surface shadow-lg">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column — the topbar stays fixed; only <main> scrolls. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          onToggleCollapse={toggleCollapsed}
          collapsed={collapsed}
        />
        <main className="no-scrollbar flex-1 overflow-y-auto p-4 md:p-6">
          <PermissionBoundary>{children}</PermissionBoundary>
        </main>
      </div>
    </div>
  );
}
