"use client";

import { useEffect, useState } from "react";
import type { StockStatus } from "@/lib/api/schemas/inventory";

const STATUS_OPTIONS: { value: "" | StockStatus; label: string }[] = [
  { value: "", label: "All" },
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low" },
  { value: "out_of_stock", label: "Out" },
];

const LIMIT_OPTIONS = [20, 50, 100];

/**
 * Search + status + per-page filter bar (design §5). All state lives in the URL
 * (shareable/restorable); search is debounced ~300ms before committing.
 */
export function StockFilters({
  q,
  status,
  limit,
  onChange,
}: {
  q: string;
  status: string;
  limit: number;
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

  const control =
    "h-10 rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="sr-only" htmlFor="stock-search">
        Search by SKU or product
      </label>
      <input
        id="stock-search"
        type="search"
        className={`${control} w-64`}
        placeholder="Search by SKU or product."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div role="group" aria-label="Status filter" className="inline-flex rounded-md border border-gray-300 p-0.5">
        {STATUS_OPTIONS.map((o) => (
          <button
            key={o.value || "all"}
            type="button"
            aria-pressed={status === o.value}
            onClick={() => onChange({ status: o.value || undefined, page: undefined })}
            className={
              "rounded px-3 py-1.5 text-sm font-medium " +
              (status === o.value ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-50")
            }
          >
            {o.label}
          </button>
        ))}
      </div>

      <label className="ml-auto flex items-center gap-2 text-sm text-gray-500">
        Per page
        <select
          className={control}
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
