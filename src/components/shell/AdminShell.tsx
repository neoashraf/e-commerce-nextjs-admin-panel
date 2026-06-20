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

  // Lock the page behind the fixed shell so it can never scroll on admin routes
  // (the shell is `fixed inset-0`; scrolling lives inside <main>). Scoped to the
  // shell's lifetime and restored on unmount so auth pages (login/forgot/reset),
  // which legitimately scroll, are unaffected.
  useEffect(() => {
    const { documentElement: html, body } = document;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
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
    // `fixed inset-0` pins the shell to the exact viewport rect and takes it out
    // of normal flow, so the page body has nothing to scroll — the sidebar and
    // topbar are immovable and only <main> scrolls. (h-screen/100vh alone left a
    // few px of body scroll on some browsers — mobile URL-bar vh quirks, sub-px
    // rounding — which drifted the chrome; fixed positioning removes that class
    // of bug entirely.)
    <div className="fixed inset-0 flex overflow-hidden bg-canvas">
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

      {/* Main column — the topbar stays fixed; only <main> scrolls. min-h-0 is
          what makes that true: a flex-col item defaults to min-height:auto and
          won't shrink below its content, so without it <main> grows to its full
          content height, the h-screen box is exceeded, and the WHOLE PAGE
          scrolls (carrying the sidebar + topbar away) instead of just <main>. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          onToggleCollapse={toggleCollapsed}
          collapsed={collapsed}
        />
        {/* min-w-0: lets the column shrink below intrinsic content width so a wide
            child (a min-w table, a recharts ResponsiveContainer) scrolls inside
            instead of shoving the sidebar.
            min-h-0: lets <main> shrink below its content height so its own
            overflow-y-auto engages and the page chrome stays put. */}
        <main className="no-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          <PermissionBoundary>{children}</PermissionBoundary>
        </main>
      </div>
    </div>
  );
}
