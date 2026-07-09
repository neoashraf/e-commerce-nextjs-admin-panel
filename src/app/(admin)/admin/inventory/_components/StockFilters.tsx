"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { StockStatus } from "@/lib/api/schemas/inventory";
import { Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CATEGORY_OPTIONS } from "./shared";

const STATUS_OPTIONS: { value: "" | StockStatus; label: string; dot?: string }[] = [
  { value: "", label: "All" },
  { value: "in_stock", label: "In stock", dot: "bg-success" },
  { value: "low_stock", label: "Low", dot: "bg-warning" },
  { value: "out_of_stock", label: "Out", dot: "bg-error" },
];

/**
 * Search + status SegmentedControl filter bar (design Stock toolbar, §8.2). All
 * state lives in the URL (shareable/restorable); search is debounced ~300ms before
 * committing. Rows-per-page now lives in the shared table footer (AD7), not here.
 */
export function StockFilters({
  q,
  status,
  category,
  resultLabel,
  onChange,
}: {
  q: string;
  status: string;
  category: string;
  resultLabel?: string;
  onChange: (patch: { q?: string; status?: string; category?: string; page?: string }) => void;
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

      {/* Product/family filter (design Stock §B). URL-driven via `category`. */}
      <label className="sr-only" htmlFor="stock-category">
        Filter by product or family
      </label>
      <div className="w-40">
        <Select
          id="stock-category"
          className="font-medium text-text-secondary"
          value={category}
          onChange={(e) => onChange({ category: e.target.value || undefined, page: undefined })}
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {resultLabel && (
        <span className="ml-auto whitespace-nowrap text-sm tabular-nums text-text-muted">
          {resultLabel}
        </span>
      )}
    </div>
  );
}
