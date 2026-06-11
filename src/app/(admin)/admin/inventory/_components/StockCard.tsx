"use client";

import Link from "next/link";
import type { StockRow } from "@/lib/api/schemas/inventory";
import { RowActionsMenu } from "./RowActionsMenu";
import { optionsOrFallback, STATUS_BADGE } from "./shared";

/** Mobile/tablet stock card (≥360px, < lg) — design §4. Prominent Available +
 * status badge; on-hand / threshold sub-line; "⋯" actions. */
export function StockCard({
  row,
  onSetAdjust,
  onEditThreshold,
}: {
  row: StockRow;
  onSetAdjust: (row: StockRow) => void;
  onEditThreshold: (row: StockRow) => void;
}) {
  const badge = STATUS_BADGE[row.status];
  const negative = row.available < 0;

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {row.product_id ? (
            <Link
              href={`/admin/products/${row.product_id}`}
              title={row.product_title ?? row.sku_code}
              className="block truncate font-medium text-gray-900 hover:underline"
            >
              {row.product_title ?? row.sku_code}
            </Link>
          ) : (
            <span title={row.product_title ?? row.sku_code} className="block truncate font-medium text-gray-900">
              {row.product_title ?? row.sku_code}
            </span>
          )}
          <span className="block text-xs text-gray-400">{row.sku_code}</span>
          <span className="mt-0.5 block text-xs text-gray-500">{optionsOrFallback(row)}</span>
        </div>
        <RowActionsMenu row={row} onSetAdjust={onSetAdjust} onEditThreshold={onEditThreshold} />
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <span className={"text-2xl font-bold " + (negative ? "text-red-600" : "text-gray-900")}>
            {row.available}
            {negative && <span className="ml-1 text-base" aria-hidden>●</span>}
          </span>
          <span className="ml-1 text-xs text-gray-400">available</span>
        </div>
        <span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + badge.cls}>{badge.label}</span>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        On-hand {row.on_hand} · Reserved {row.reserved} · Threshold {row.low_stock_threshold}
      </p>
    </div>
  );
}
