"use client";

import { useEffect, useRef, useState } from "react";
import { Can } from "@/lib/permissions/Can";
import type { StockRow } from "@/lib/api/schemas/inventory";
import { STOCK_MUTATE_PERMISSION } from "./shared";

/**
 * Per-row "⋯" actions menu (design §5). Gated by the mutate permission — when
 * absent the menu is not rendered, leaving the row read-only. Keyboard:
 * Enter/Space opens, Escape closes, focus returns to the trigger.
 */
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
    <Can permission={STOCK_MUTATE_PERMISSION}>
      <div ref={ref} className="relative inline-block text-left">
        <button
          ref={btnRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Actions for ${row.sku_code}`}
          onClick={() => setOpen((v) => !v)}
          className="grid h-11 w-11 place-items-center rounded-md text-gray-500 hover:bg-gray-100"
        >
          <span aria-hidden className="text-lg leading-none">⋯</span>
        </button>
        {open && (
          <div
            role="menu"
            onKeyDown={(e) => e.key === "Escape" && close()}
            className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          >
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onSetAdjust(row);
              }}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Set / adjust qty
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onEditThreshold(row);
              }}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Edit threshold
            </button>
          </div>
        )}
      </div>
    </Can>
  );
}
