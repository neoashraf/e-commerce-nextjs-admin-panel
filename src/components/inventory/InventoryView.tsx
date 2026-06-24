"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PackageX, Upload, WifiOff } from "lucide-react";
import { useInventory, useStockStatusCounts } from "@/lib/api/hooks/useInventory";
import type { StockRow, StockStatus } from "@/lib/api/schemas/inventory";
import { Can } from "@/lib/permissions/Can";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { Button, Card, EmptyState, ErrorState, SkeletonRows, TablePagination } from "@/components/ui";
import { StockExportButton } from "@/app/(admin)/admin/inventory/_components/StockExportButton";
import { StockFilters } from "@/app/(admin)/admin/inventory/_components/StockFilters";
import { StockTable } from "@/app/(admin)/admin/inventory/_components/StockTable";
import { StockCard } from "@/app/(admin)/admin/inventory/_components/StockCard";
import { SetAdjustModal } from "@/app/(admin)/admin/inventory/_components/SetAdjustModal";
import { ThresholdModal } from "@/app/(admin)/admin/inventory/_components/ThresholdModal";
import {
  CATEGORY_OPTIONS,
  deriveFamily,
  STOCK_MUTATE_PERMISSION,
  sortRows,
  type SortDir,
  type SortKey,
} from "@/app/(admin)/admin/inventory/_components/shared";

/** Secondary-button styling for navigation anchors (mirrors `Button` secondary). */
const secondaryLink =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-text transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2";

/**
 * Inventory → Stock index (inv-stock-fe; design Stock (INV).dc.html). The LIST
 * archetype: toolbar + filters + AD0 `Table` (cards @<lg), from which a Catalog
 * Manager receives/adjusts on-hand and edits the low-stock threshold in place.
 * URL-driven filters; all §6 states; mutate actions gated by
 * `inventory.stock.update`. Re-skinned to the design system (AD6); data layer
 * untouched.
 */
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
  // Product-family filter (design Stock §B). Forwarded to the API as `category`;
  // until the backend accepts it (brief: safwan-update-api/inv-category-filter-be.md)
  // it falls back to filtering the loaded page client-side via `deriveFamily`.
  const category = sp.get("category") ?? "";
  const limit = Number(sp.get("limit")) || DEFAULT_PAGE_SIZE;
  const page = Number(sp.get("page")) || 1;

  const [sort, setSort] = useState<SortKey | null>(null);
  const [dir, setDir] = useState<SortDir>("asc");
  const [stockTarget, setStockTarget] = useState<StockRow | null>(null);
  const [thresholdTarget, setThresholdTarget] = useState<StockRow | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useInventory({
    q: q || undefined,
    status: (status || undefined) as StockStatus | undefined,
    category: category || undefined,
    page,
    limit,
  });
  const { low: lowCount, out: outCount } = useStockStatusCounts();

  const hasFilters = q !== "" || status !== "" || category !== "";
  const total = data?.meta.total ?? 0;
  // Header summary (design: "{total} SKUs total · {low} low · {out} out"). When a status
  // filter is active the design instead reads "Filtered to '<status>'".
  const statusLabel: Record<string, string> = {
    in_stock: "In stock",
    low_stock: "Low",
    out_of_stock: "Out",
  };
  const headerSummary = status
    ? `Filtered to ‘${statusLabel[status] ?? status}’`
    : data
      ? [
          `${total} SKU${total === 1 ? "" : "s"} total`,
          lowCount !== undefined ? `${lowCount} low` : null,
          outCount !== undefined ? `${outCount} out` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : undefined;
  const rows = useMemo(() => {
    let base = data?.data ?? [];
    // Client-side family fallback: until the backend honors `category`, narrow the
    // loaded page by the derived family. A no-op once the server filters (rows
    // already match); the dropdown stays correct without an empty list meanwhile.
    if (category) base = base.filter((r) => deriveFamily(r) === category);
    return sort ? sortRows(base, sort, dir) : base;
  }, [data, sort, dir, category]);
  const resultLabel = data ? `${total} SKU${total === 1 ? "" : "s"}` : undefined;

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold leading-7 tracking-tight text-text">Stock</h1>
          {headerSummary && (
            <p className="mt-0.5 text-[13px] tabular-nums text-text-muted">{headerSummary}</p>
          )}
        </div>
        <div className="flex items-start gap-2">
          <StockExportButton status={status} q={q} />
          <Can permission={STOCK_MUTATE_PERMISSION}>
            <Link href="/admin/inventory/bulk" className={secondaryLink}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Bulk update
            </Link>
          </Can>
        </div>
      </div>

      {!online && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning-50 px-3 py-2 text-sm text-warning"
        >
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          Showing saved data — you&apos;re offline. Set/adjust and threshold edits are disabled until you reconnect.
        </p>
      )}

      <StockFilters
        q={q}
        status={status}
        category={category}
        resultLabel={resultLabel}
        onChange={patchQuery}
      />

      {isLoading ? (
        <Card className="p-0">
          <SkeletonRows rows={10} cols={6} />
        </Card>
      ) : isError ? (
        <Card className="p-0">
          <ErrorState description="Couldn't load stock." onRetry={() => refetch()} />
        </Card>
      ) : !data || rows.length === 0 ? (
        <Card className="p-0">
          {hasFilters ? (
            <EmptyState
              icon={PackageX}
              title="No SKUs match these filters."
              description="Try a different search, status, or product."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={PackageX}
              title="No stock yet."
              description="Stock records appear here once products and variants are created in Catalog."
              action={
                <Link href="/admin/products" className={secondaryLink}>
                  Go to Catalog
                </Link>
              }
            />
          )}
        </Card>
      ) : (
        <div aria-busy={isFetching} className="space-y-3">
          {/* Desktop: card-wrapped table + pagination footer (design Stock (INV) §D). */}
          <Card className="hidden overflow-hidden p-0 lg:block">
            <div className="overflow-x-auto">
              <StockTable
                rows={rows}
                sort={sort}
                dir={dir}
                onSort={onSort}
                onSetAdjust={setStockTarget}
                onEditThreshold={setThresholdTarget}
              />
            </div>
            <TablePagination
              page={page}
              pageSize={limit}
              total={total}
              onPageChange={(p) => patchQuery({ page: String(p) })}
              onPageSizeChange={(s) => patchQuery({ limit: String(s), page: undefined })}
            />
          </Card>
          {/* Mobile: stacked cards + pagination. */}
          <div className="space-y-3 lg:hidden">
            {rows.map((r) => (
              <StockCard
                key={r.variant_id}
                row={r}
                onSetAdjust={setStockTarget}
                onEditThreshold={setThresholdTarget}
              />
            ))}
            <Card className="p-0">
              <TablePagination
                page={page}
                pageSize={limit}
                total={total}
                onPageChange={(p) => patchQuery({ page: String(p) })}
                onPageSizeChange={(s) => patchQuery({ limit: String(s), page: undefined })}
              />
            </Card>
          </div>
        </div>
      )}

      {/* Mutations are disabled offline (no optimistic writes against stale cache). */}
      {online && stockTarget && <SetAdjustModal row={stockTarget} onClose={() => setStockTarget(null)} />}
      {online && thresholdTarget && <ThresholdModal row={thresholdTarget} onClose={() => setThresholdTarget(null)} />}
    </div>
  );
}
