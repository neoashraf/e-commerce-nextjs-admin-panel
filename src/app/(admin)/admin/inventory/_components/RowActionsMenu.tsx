"use client";

import Link from "next/link";
import { Gauge, History, SlidersHorizontal } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { RowActions } from "@/components/ui";
import type { StockRow } from "@/lib/api/schemas/inventory";
import { STOCK_MUTATE_PERMISSION } from "./shared";

/**
 * Per-row "⋯" actions menu (design §5). Set/adjust + Edit threshold are gated by
 * the mutate permission; "View movements" (read-only navigation) is always shown
 * so the menu still renders for read-only roles. Built on the shared
 * {@link RowActions} primitive, so the dropdown is portaled and never clipped by
 * the table's overflow wrappers.
 */
const itemCls =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-text-secondary hover:bg-surface-subtle";

export function RowActionsMenu({
  row,
  onSetAdjust,
  onEditThreshold,
}: {
  row: StockRow;
  onSetAdjust: (row: StockRow) => void;
  onEditThreshold: (row: StockRow) => void;
}) {
  return (
    <RowActions label={`Stock actions for ${row.sku_code}`} width="w-48">
      {(close) => (
        <>
          <Can permission={STOCK_MUTATE_PERMISSION}>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                close();
                onSetAdjust(row);
              }}
              className={itemCls}
            >
              <SlidersHorizontal className="h-4 w-4 text-text-muted" aria-hidden="true" />
              Set / adjust qty
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                close();
                onEditThreshold(row);
              }}
              className={itemCls}
            >
              <Gauge className="h-4 w-4 text-text-muted" aria-hidden="true" />
              Edit threshold
            </button>
          </Can>
          <Link
            role="menuitem"
            href={`/admin/inventory/${row.variant_id}/movements`}
            className={itemCls}
            onClick={() => close()}
          >
            <History className="h-4 w-4 text-text-muted" aria-hidden="true" />
            View movements
          </Link>
        </>
      )}
    </RowActions>
  );
}
