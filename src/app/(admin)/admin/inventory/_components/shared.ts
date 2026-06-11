import type { StockRow, StockStatus } from "@/lib/api/schemas/inventory";

/** Mutate permission code — the seeded code the backend enforces
 * (`@Requires('inventory.stock.update')`); the API contract names it
 * `inventory.stock.adjust` but the running guard uses `.update`. Reads use
 * `inventory.stock.read`. (design §11/§14 open question, resolved against BE.) */
export const STOCK_MUTATE_PERMISSION = "inventory.stock.update";

/** Status badge styling — label + color (never color alone, a11y §10). */
export const STATUS_BADGE: Record<StockStatus, { cls: string; label: string }> = {
  in_stock: { cls: "bg-green-50 text-green-700 ring-1 ring-green-600/20", label: "In stock" },
  low_stock: { cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20", label: "Low" },
  out_of_stock: { cls: "bg-red-50 text-red-700 ring-1 ring-red-600/20", label: "Out" },
};

/** Render the options map as "Color: Black · Size: 43"; "" when none/missing. */
export function optionsLabel(o?: Record<string, string> | null): string {
  if (!o || Object.keys(o).length === 0) return "";
  return Object.entries(o)
    .map(([k, v]) => `${k[0]?.toUpperCase()}${k.slice(1)}: ${v}`)
    .join(" · ");
}

/**
 * Options sub-line for a row. When CAT labels are unavailable (partial state,
 * design §6/§13) we fall back to the sku + variant id so qty/status still read.
 */
export function optionsOrFallback(row: StockRow): string {
  const labels = optionsLabel(row.options);
  if (labels) return labels;
  return `${row.sku_code} · ${row.variant_id}`;
}

export type SortKey = "product" | "available" | "status";
export type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<StockStatus, number> = { out_of_stock: 0, low_stock: 1, in_stock: 2 };

/** Client-side sort for the loaded page (server returns unsorted rows). */
export function sortRows(rows: StockRow[], key: SortKey, dir: SortDir): StockRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (key === "product") cmp = (a.product_title ?? a.sku_code).localeCompare(b.product_title ?? b.sku_code);
    else if (key === "available") cmp = a.available - b.available;
    else cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    return cmp * sign;
  });
}
