import type { StockRow, StockStatus } from "@/lib/api/schemas/inventory";

/** Map a SKU/family to a category glyph for the thumbnail placeholder (design §C
 * uses footprints/shirt/circle-dot). Boots/turf → Footprints, jerseys → Shirt,
 * footballs → CircleDot, else Package. Best-effort from the SKU/title text. */
export function stockIconKey(row: {
  sku_code: string;
  product_title?: string | null;
}): "footprints" | "shirt" | "ball" | "package" {
  const hay = `${row.sku_code} ${row.product_title ?? ""}`.toLowerCase();
  if (/jersey|shirt|kit|tiro|hm24|home/.test(hay)) return "shirt";
  if (/football|ball|rihla|impel|academy|al-?rihla/.test(hay)) return "ball";
  if (/boot|turf|phantom|predator|mercurial|tiempo|future|king|footprint/.test(hay))
    return "footprints";
  return "package";
}

/** Mutate permission code — the seeded code the backend enforces
 * (`@Requires('inventory.stock.update')`); the API contract names it
 * `inventory.stock.adjust` but the running guard uses `.update`. Reads use
 * `inventory.stock.read`. (design §11/§14 open question, resolved against BE.) */
export const STOCK_MUTATE_PERMISSION = "inventory.stock.update";

/**
 * Status → label + semantic tone (design-system §8.7; never color alone).
 * Fed to the AD0 `StatusPill` (`status` normalises `in_stock`→`in-stock` etc.);
 * `label` overrides the humanised text to the short directory labels.
 */
export const STATUS_LABEL: Record<StockStatus, string> = {
  in_stock: "In stock",
  low_stock: "Low",
  out_of_stock: "Out",
};

/** Filter-chip dot color per status (design Stock toolbar). */
export const STATUS_DOT: Record<StockStatus, string> = {
  in_stock: "bg-success",
  low_stock: "bg-warning",
  out_of_stock: "bg-error",
};

/**
 * Product-family filter options for the Stock toolbar (design Stock §B —
 * "All products / Boots / Jerseys / Footballs / Turf shoes"). `value` is the
 * URL/`category` param; `""` is the "all" sentinel. These mirror the catalog's
 * top-level product families; once the backend accepts a real `category` filter
 * (brief: safwan-update-api/inv-category-filter-be.md) the same values forward
 * to the server and this list can be sourced from the categories endpoint.
 */
export const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All products" },
  { value: "boots", label: "Boots" },
  { value: "jerseys", label: "Jerseys" },
  { value: "footballs", label: "Footballs" },
  { value: "turf-shoes", label: "Turf shoes" },
];

/**
 * Best-effort product family derived from a row's SKU/title — the same text
 * heuristic as {@link stockIconKey}, mapped to the {@link CATEGORY_OPTIONS}
 * values. Used only to filter the **already-loaded page** client-side while the
 * backend `category` filter is pending; it is not authoritative and never
 * substitutes for a server-side filter over the full dataset.
 */
export function deriveFamily(row: { sku_code: string; product_title?: string | null }): string {
  const hay = `${row.sku_code} ${row.product_title ?? ""}`.toLowerCase();
  if (/turf|futsal/.test(hay)) return "turf-shoes";
  if (/jersey|shirt|kit|tiro|hm24|home/.test(hay)) return "jerseys";
  if (/football|ball|rihla|impel|academy|al-?rihla/.test(hay)) return "footballs";
  if (/boot|phantom|predator|mercurial|tiempo|future|king/.test(hay)) return "boots";
  return "";
}

/** Render the options map as "Color: Black · Size: 43"; "" when none/missing. */
export function optionsLabel(o?: Record<string, string> | null): string {
  if (!o || Object.keys(o).length === 0) return "";
  return Object.entries(o)
    .map(([k, v]) => `${k[0]?.toUpperCase()}${k.slice(1)}: ${v}`)
    .join(" · ");
}

/**
 * Options sub-line for a row. When CAT option labels are unavailable (partial
 * state, design §6/§13) the design falls back to the **SKU code** — never the
 * variant UUID — shown faint. Returns "" when there's nothing meaningful so the
 * caller can render a muted dash.
 */
export function optionsOrFallback(row: StockRow): string {
  return optionsLabel(row.options) || row.sku_code;
}

/** True when the row has real CAT option labels (vs. the SKU-code fallback) — drives the muted color. */
export function hasOptionLabels(row: StockRow): boolean {
  return optionsLabel(row.options).length > 0;
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
