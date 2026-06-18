"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { StockStatus } from "@/lib/api/schemas/inventory";
import { cn } from "@/lib/cn";

const STATUS_OPTIONS: { value: "" | StockStatus; label: string; dot?: string }[] = [
  { value: "", label: "All" },
  { value: "in_stock", label: "In stock", dot: "bg-success" },
  { value: "low_stock", label: "Low", dot: "bg-warning" },
  { value: "out_of_stock", label: "Out", dot: "bg-error" },
];

const LIMIT_OPTIONS = [20, 50, 100];

/**
 * Search + status SegmentedControl + per-page filter bar (design Stock toolbar,
 * §8.2). All state lives in the URL (shareable/restorable); search is debounced
 * ~300ms before committing. Re-skinned to the design tokens.
 */
export function StockFilters({
  q,
  status,
  limit,
  resultLabel,
  onChange,
}: {
  q: string;
  status: string;
  limit: number;
  resultLabel?: string;
  onChange: (patch: { q?: string; status?: string; limit?: string; page?: string }) => void;
}) {
  const [search, setSearch] = useState(q);

  // Keep the local field in sync when the URL changes externally (deep-link).
  useEffect(() => setSearch(q), [q]);

  // Debounce search → URL.
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => onChange({ q: search || undefined, page: undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="sr-only" htmlFor="stock-search">
        Search by SKU or product
      </label>
      <div className="relative w-64">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint"
          aria-hidden="true"
        />
        <input
          id="stock-search"
          type="search"
          className="h-9 w-full rounded-md border border-border-strong bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1"
          placeholder="Search by SKU or product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div
        role="tablist"
        aria-label="Filter by stock status"
        className="inline-flex items-center gap-1 rounded-md bg-surface-subtle p-1"
      >
        {STATUS_OPTIONS.map((o) => {
          const selected = status === o.value;
          return (
            <button
              key={o.value || "all"}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange({ status: o.value || undefined, page: undefined })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1 text-[13px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
                selected
                  ? "bg-surface text-text shadow-xs"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              {o.dot && <span className={cn("h-1.5 w-1.5 rounded-full", o.dot)} aria-hidden="true" />}
              {o.label}
            </button>
          );
        })}
      </div>

      {resultLabel && (
        <span className="ml-auto whitespace-nowrap text-sm tabular-nums text-text-muted">
          {resultLabel}
        </span>
      )}

      <label className="flex items-center gap-2 text-sm text-text-muted">
        Per page
        <select
          className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm tabular-nums text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          value={limit}
          onChange={(e) => onChange({ limit: e.target.value, page: undefined })}
        >
          {LIMIT_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
