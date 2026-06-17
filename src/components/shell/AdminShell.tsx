"use client";

import { useState } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { PermissionBoundary } from "@/components/shell/PermissionBoundary";

/**
 * Admin shell layout: fixed sidebar rail on md+, slide-over drawer on mobile,
 * topbar, and the scrollable content region. Per fe-page-scaffold: admin shell
 * = sidebar + flex-1 p-4 md:p-6 content.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    // h-screen + overflow-hidden makes the shell own the full viewport height so
    // the sidebar and the main content scroll independently (the sidebar stays
    // put while only <main> scrolls), instead of the page scrolling as one unit.
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Desktop sidebar — the Sidebar owns its internal scroll (brand block stays put). */}
      <aside className="hidden w-64 shrink-0 overflow-hidden border-r border-border bg-surface md:block">
        <Sidebar />
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
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="no-scrollbar flex-1 overflow-y-auto p-4 md:p-6">
          <PermissionBoundary>{children}</PermissionBoundary>
        </main>
      </div>
    </div>
  );
}
