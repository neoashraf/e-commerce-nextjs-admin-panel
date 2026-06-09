"use client";

import Link from "next/link";
import type { StockRow } from "@/lib/api/schemas/inventory";
import { RowActionsMenu } from "./RowActionsMenu";
import { optionsOrFallback, STATUS_BADGE, type SortDir, type SortKey } from "./shared";

/** Sortable column header (Enter/Space operable, a11y §10). */
function SortHeader({
  label,
  col,
  sort,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  col: SortKey;
  sort: SortKey | null;
  dir: SortDir;
  onSort: (col: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort === col;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={"py-2 font-medium " + (align === "right" ? "pr-3 text-right" : "pr-4")}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        className={"inline-flex items-center gap-1 hover:text-gray-700 " + (active ? "text-gray-700" : "")}
      >
        {label}
        <span aria-hidden className="text-[10px]">{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

/** Desktop stock data table (≥1024px) — design §4. */
export function StockTable({
  rows,
  sort,
  dir,
  onSort,
  onSetAdjust,
  onEditThreshold,
}: {
  rows: StockRow[];
  sort: SortKey | null;
  dir: SortDir;
  onSort: (col: SortKey) => void;
  onSetAdjust: (row: StockRow) => void;
  onEditThreshold: (row: StockRow) => void;
}) {
  return (
    <table className="hidden w-full text-sm lg:table">
      <thead>
        <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
          <SortHeader label="Product / SKU" col="product" sort={sort} dir={dir} onSort={onSort} />
          <th scope="col" className="py-2 pr-4 font-medium">Options</th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">On-hand</th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">Reserved</th>
          <SortHeader label="Available" col="available" sort={sort} dir={dir} onSort={onSort} align="right" />
          <th scope="col" className="py-2 pr-3 text-right font-medium">Threshold</th>
          <SortHeader label="Status" col="status" sort={sort} dir={dir} onSort={onSort} />
          <th scope="col" className="py-2 font-medium">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const badge = STATUS_BADGE[r.status];
          const negative = r.available < 0;
          return (
            <tr key={r.variant_id} className="border-b border-gray-100 align-top">
              <td className="max-w-[16rem] py-3 pr-4">
                {r.product_id ? (
                  <Link
                    href={`/admin/products/${r.product_id}`}
                    title={r.product_title ?? r.sku_code}
                    className="block truncate font-medium text-gray-900 hover:text-brand-700 hover:underline"
                  >
                    {r.product_title ?? r.sku_code}
                  </Link>
                ) : (
                  <span title={r.product_title ?? r.sku_code} className="block truncate font-medium text-gray-900">
                    {r.product_title ?? r.sku_code}
                  </span>
                )}
                <span className="block text-xs text-gray-400">{r.sku_code}</span>
              </td>
              <td className="py-3 pr-4 text-xs text-gray-500">{optionsOrFallback(r)}</td>
              <td className="py-3 pr-3 text-right text-gray-700">{r.on_hand}</td>
              <td className="py-3 pr-3 text-right text-gray-400">{r.reserved}</td>
              <td className={"py-3 pr-3 text-right " + (negative ? "font-semibold text-red-600" : "text-gray-700")}>
                {r.available}
                {negative && (
                  <span title="Available is negative — corrections needed" className="ml-1 text-red-600" aria-hidden>
                    ●
                  </span>
                )}
              </td>
              <td className="py-3 pr-3 text-right text-gray-500">{r.low_stock_threshold}</td>
              <td className="py-3 pr-4">
                <span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + badge.cls}>
                  {badge.label}
                </span>
              </td>
              <td className="py-3 text-right">
                <RowActionsMenu row={r} onSetAdjust={onSetAdjust} onEditThreshold={onEditThreshold} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
