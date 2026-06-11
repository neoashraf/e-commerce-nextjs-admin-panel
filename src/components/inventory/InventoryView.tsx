"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useInventory } from "@/lib/api/hooks/useInventory";
import type { StockRow, StockStatus } from "@/lib/api/schemas/inventory";
import { Can } from "@/lib/permissions/Can";
import { StockFilters } from "@/app/(admin)/admin/inventory/_components/StockFilters";
import { StockTable } from "@/app/(admin)/admin/inventory/_components/StockTable";
import { StockCard } from "@/app/(admin)/admin/inventory/_components/StockCard";
import { SetAdjustModal } from "@/app/(admin)/admin/inventory/_components/SetAdjustModal";
import { ThresholdModal } from "@/app/(admin)/admin/inventory/_components/ThresholdModal";
import {
  STOCK_MUTATE_PERMISSION,
  sortRows,
  type SortDir,
  type SortKey,
} from "@/app/(admin)/admin/inventory/_components/shared";

/**
 * Inventory → Stock index (inv-stock-fe; design docs/design/screens/11-inventory/
 * stock-management.md). Searchable/filterable/sortable list of every SKU's
 * stock — table @≥1024px, cards @≥360px — from which a Catalog Manager receives/
 * adjusts on-hand and edits the low-stock threshold in place. URL-driven
 * filters; all §6 states; mutate actions gated by `inventory.stock.update`.
 */
const STATUS_SUMMARY: Record<StockStatus, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function InventoryView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const online = useOnline();

  const q = sp.get("q") ?? "";
  const status = sp.get("status") ?? "";
  const limit = Number(sp.get("limit")) || 50;
  const page = Number(sp.get("page")) || 1;

  const [sort, setSort] = useState<SortKey | null>(null);
  const [dir, setDir] = useState<SortDir>("asc");
  const [stockTarget, setStockTarget] = useState<StockRow | null>(null);
  const [thresholdTarget, setThresholdTarget] = useState<StockRow | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useInventory({
    q: q || undefined,
    status: (status || undefined) as StockStatus | undefined,
    page,
    limit,
  });

  const hasFilters = q !== "" || status !== "";
  const rows = useMemo(() => (data && sort ? sortRows(data, sort, dir) : (data ?? [])), [data, sort, dir]);

  function patchQuery(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  function onSort(col: SortKey) {
    if (sort === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setDir("asc");
    }
  }

  function clearFilters() {
    router.push(pathname);
  }

  return (
    <div className="space-y-5">
      {/* Header — read-only (records are auto-created by CAT; no Create CTA). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Stock</h1>
          <p className="text-sm text-gray-500">
            {data ? `${data.length} SKU${data.length === 1 ? "" : "s"}` : "—"}
            {status && ` · ${STATUS_SUMMARY[status as StockStatus] ?? status}`}
          </p>
        </div>
        <Can permission={STOCK_MUTATE_PERMISSION}>
          <Link
            href="/admin/inventory/bulk"
            className="inline-flex h-10 items-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Bulk import
          </Link>
        </Can>
      </div>

      {!online && (
        <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Showing saved data — you&apos;re offline. Set/adjust and threshold edits are disabled until you reconnect.
        </p>
      )}

      <StockFilters q={q} status={status} limit={limit} onChange={patchQuery} />

      {isLoading ? (
        <SkeletonTable />
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">Couldn&apos;t load stock.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 text-sm font-medium text-brand-700 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        hasFilters ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-600">No SKUs match these filters.</p>
            <button type="button" onClick={clearFilters} className="mt-2 text-sm font-medium text-brand-700 hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-600">
              No stock yet. Stock records appear here once products and variants are created in Catalog.
            </p>
            <Link href="/admin/products" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
              Go to Catalog
            </Link>
          </div>
        )
      ) : (
        <div aria-busy={isFetching}>
          <StockTable
            rows={rows}
            sort={sort}
            dir={dir}
            onSort={onSort}
            onSetAdjust={setStockTarget}
            onEditThreshold={setThresholdTarget}
          />
          <div className="space-y-3 lg:hidden">
            {rows.map((r) => (
              <StockCard
                key={r.variant_id}
                row={r}
                onSetAdjust={setStockTarget}
                onEditThreshold={setThresholdTarget}
              />
            ))}
          </div>
        </div>
      )}

      {/* Mutations are disabled offline (no optimistic writes against stale cache). */}
      {online && stockTarget && <SetAdjustModal row={stockTarget} onClose={() => setStockTarget(null)} />}
      {online && thresholdTarget && <ThresholdModal row={thresholdTarget} onClose={() => setThresholdTarget(null)} />}
    </div>
  );
}

/** Loading skeleton — ~12 rows preserving column rhythm (design §6). */
function SkeletonTable() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-gray-100" />
      ))}
    </div>
  );
}
