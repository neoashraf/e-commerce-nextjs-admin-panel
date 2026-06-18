"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Gauge, History, MoreHorizontal, SlidersHorizontal } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import type { StockRow } from "@/lib/api/schemas/inventory";
import { cn } from "@/lib/cn";
import { STOCK_MUTATE_PERMISSION } from "./shared";

/**
 * Per-row "⋯" actions menu (design §5). Set/adjust + Edit threshold are gated by
 * the mutate permission; "View movements" (read-only navigation) is always
 * shown so the menu still renders for read-only roles. Keyboard: Enter/Space
 * opens, Escape closes, focus returns to the trigger.
 */
const itemCls =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-text-secondary hover:bg-surface-subtle focus-visible:outline-none focus-visible:bg-surface-subtle";

export function RowActionsMenu({
  row,
  onSetAdjust,
  onEditThreshold,
}: {
  row: StockRow;
  onSetAdjust: (row: StockRow) => void;
  onEditThreshold: (row: StockRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function close() {
    setOpen(false);
    btnRef.current?.focus();
  }

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Stock actions for ${row.sku_code}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-subtle",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
          open && "bg-surface-subtle",
        )}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          onKeyDown={(e) => e.key === "Escape" && close()}
          className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          <Can permission={STOCK_MUTATE_PERMISSION}>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
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
                setOpen(false);
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
            onClick={() => setOpen(false)}
          >
            <History className="h-4 w-4 text-text-muted" aria-hidden="true" />
            View movements
          </Link>
        </div>
      )}
    </div>
  );
}
