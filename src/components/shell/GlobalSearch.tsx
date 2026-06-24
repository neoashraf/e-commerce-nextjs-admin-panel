"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { cn } from "@/lib/cn";

/**
 * Global search (design-system §7.2). A working command palette: the admin types a query and jumps to
 * the matching list — Orders / Products / Customers — which each already filter by the `?q=` URL param.
 * There is no cross-entity backend search endpoint, so this routes to the relevant list scope rather
 * than rendering inline results. Scopes are gated by the admin's permissions (same keys as the sidebar),
 * so an admin is never routed to a list they can't open. ⌘K / Ctrl+K focuses it; ↑/↓ move, Enter goes,
 * Esc closes.
 */
interface SearchScope {
  key: string;
  label: string;
  href: string;
  permission: string;
}

const SCOPES: SearchScope[] = [
  { key: "orders", label: "Orders", href: "/admin/orders", permission: "orders.order.read" },
  { key: "products", label: "Products", href: "/admin/products", permission: "catalog.product.read" },
  { key: "customers", label: "Customers", href: "/admin/customers", permission: "customers.customer.read" },
];

export function GlobalSearch() {
  const router = useRouter();
  const { can, ready } = usePermissions();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Scopes the admin can reach. Until GET /admin/me resolves (no permissions yet) show all, so the
  // affordance isn't hidden on first paint — mirrors the Sidebar's optimistic reveal.
  const scopes = useMemo(
    () => SCOPES.filter((s) => !ready || can(s.permission)),
    [ready, can],
  );

  // ⌘K / Ctrl+K focuses the search from anywhere in the panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Outside-click closes the dropdown.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Keep the active index valid as the available scope list changes.
  useEffect(() => {
    setActive((i) => Math.min(Math.max(0, i), Math.max(0, scopes.length - 1)));
  }, [scopes.length]);

  if (scopes.length === 0) return null; // admin can't reach any searchable list — hide the affordance

  const go = (scope: SearchScope | undefined) => {
    const q = query.trim();
    if (!q || !scope) return;
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(`${scope.href}?q=${encodeURIComponent(q)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % scopes.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i - 1 + scopes.length) % scopes.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(scopes[active] ?? scopes[0]);
    } else if (e.key === "Escape") {
      if (open) setOpen(false);
      else inputRef.current?.blur();
    }
  };

  const q = query.trim();

  return (
    <div ref={rootRef} className="relative hidden max-w-md flex-1 sm:block">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open && q ? `${listboxId}-opt-${active}` : undefined}
        placeholder="Search orders, products, customers…"
        aria-label="Search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-9 w-full rounded-md border border-border-strong bg-surface pl-9 pr-16 text-sm text-text placeholder:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-surface-subtle px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
        ⌘K
      </kbd>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search scopes"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-md"
        >
          {q ? (
            scopes.map((s, idx) => (
              <button
                key={s.key}
                id={`${listboxId}-opt-${idx}`}
                type="button"
                role="option"
                aria-selected={idx === active}
                onMouseEnter={() => setActive(idx)}
                onClick={() => go(s)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                  idx === active ? "bg-surface-subtle text-text" : "text-text-secondary hover:bg-surface-subtle",
                )}
              >
                <Search className="h-3.5 w-3.5 shrink-0 text-text-faint" aria-hidden="true" />
                <span className="flex-1 truncate">
                  Search <span className="font-medium text-text">{s.label}</span> for “{q}”
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-faint" aria-hidden="true" />
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-xs text-text-muted">
              Type to search {scopes.map((s) => s.label.toLowerCase()).join(", ")}, then press Enter.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
