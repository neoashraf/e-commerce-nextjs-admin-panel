"use client";

import Link from "next/link";
import type { StockRow } from "@/lib/api/schemas/inventory";
import {
  StatusPill,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  type SortDir as PillSortDir,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { RowActionsMenu } from "./RowActionsMenu";
import { optionsOrFallback, STATUS_LABEL, type SortDir, type SortKey } from "./shared";

/** Desktop stock data table (≥1024px) on the AD0 `Table` (design §8.6). */
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
  const sortFor = (col: SortKey): PillSortDir => (sort === col ? dir : null);

  return (
    <div className="hidden lg:block">
      <Table className="min-w-[920px]">
        <THead>
          <TR hover={false}>
            <TH sort={sortFor("product")} onSort={() => onSort("product")}>
              Product / SKU
            </TH>
            <TH>Options</TH>
            <TH numeric>On-hand</TH>
            <TH numeric>Reserved</TH>
            <TH numeric sort={sortFor("available")} onSort={() => onSort("available")}>
              Available
            </TH>
            <TH numeric>Threshold</TH>
            <TH sort={sortFor("status")} onSort={() => onSort("status")}>
              Status
            </TH>
            <TH className="w-14">
              <span className="sr-only">Actions</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => {
            const negative = r.available < 0;
            return (
              <TR key={r.variant_id}>
                <TD className="max-w-[16rem]">
                  {r.product_id ? (
                    <Link
                      href={`/admin/products/${r.product_id}`}
                      title={r.product_title ?? r.sku_code}
                      className="block truncate font-medium text-text hover:text-accent-700 hover:underline"
                    >
                      {r.product_title ?? r.sku_code}
                    </Link>
                  ) : (
                    <span title={r.product_title ?? r.sku_code} className="block truncate font-medium text-text">
                      {r.product_title ?? r.sku_code}
                    </span>
                  )}
                  <span className="block text-xs text-text-faint">{r.sku_code}</span>
                </TD>
                <TD className="text-xs text-text-muted">{optionsOrFallback(r)}</TD>
                <TD numeric>{r.on_hand}</TD>
                <TD numeric className="text-text-faint">{r.reserved}</TD>
                <TD numeric>
                  <span className="inline-flex items-center justify-end gap-1.5">
                    {negative && (
                      <span
                        title="Available is negative — reserved exceeds on-hand"
                        className="h-1.5 w-1.5 rounded-full bg-error ring-[3px] ring-error-50"
                        aria-hidden="true"
                      />
                    )}
                    <span className={cn("font-semibold", negative ? "text-error" : "text-text")}>
                      {r.available}
                    </span>
                  </span>
                </TD>
                <TD numeric className="text-text-muted">{r.low_stock_threshold}</TD>
                <TD>
                  <StatusPill status={r.status} label={STATUS_LABEL[r.status]} />
                </TD>
                <TD className="text-right">
                  <RowActionsMenu row={r} onSetAdjust={onSetAdjust} onEditThreshold={onEditThreshold} />
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
