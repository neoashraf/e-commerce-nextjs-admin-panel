"use client";

import Link from "next/link";
import type { StockRow } from "@/lib/api/schemas/inventory";
import { Card, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { RowActionsMenu } from "./RowActionsMenu";
import { StockThumb } from "./StockThumb";
import { optionsOrFallback, STATUS_LABEL } from "./shared";

/** Mobile/tablet stock card (≥360px, < lg) — design §4. Prominent Available +
 * status pill; on-hand / threshold sub-line; "⋯" actions. */
export function StockCard({
  row,
  onSetAdjust,
  onEditThreshold,
}: {
  row: StockRow;
  onSetAdjust: (row: StockRow) => void;
  onEditThreshold: (row: StockRow) => void;
}) {
  const negative = row.available < 0;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <StockThumb row={row} />
          <div className="min-w-0">
            {row.product_id ? (
              <Link
                href={`/admin/products/${row.product_id}`}
                title={row.product_title ?? row.sku_code}
                className="block truncate font-medium text-text hover:text-accent-700 hover:underline"
              >
                {row.product_title ?? row.sku_code}
              </Link>
            ) : (
              <span title={row.product_title ?? row.sku_code} className="block truncate font-medium text-text">
                {row.product_title ?? row.sku_code}
              </span>
            )}
            <span className="block text-xs tabular-nums text-text-faint">{row.sku_code}</span>
            <span className="mt-0.5 block text-xs text-text-muted">{optionsOrFallback(row)}</span>
          </div>
        </div>
        <RowActionsMenu row={row} onSetAdjust={onSetAdjust} onEditThreshold={onEditThreshold} />
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div className="flex items-end gap-1.5">
          {negative && (
            <span
              className="mb-1.5 h-2 w-2 rounded-full bg-error ring-[3px] ring-error-50"
              aria-hidden="true"
            />
          )}
          <span className={cn("text-2xl font-bold tabular-nums", negative ? "text-error" : "text-text")}>
            {row.available}
          </span>
          <span className="mb-1 text-xs text-text-faint">available</span>
        </div>
        <StatusPill status={row.status} label={STATUS_LABEL[row.status]} />
      </div>

      <p className="mt-2 text-xs tabular-nums text-text-muted">
        On-hand {row.on_hand} · Reserved {row.reserved} · Threshold {row.low_stock_threshold}
      </p>
    </Card>
  );
}
