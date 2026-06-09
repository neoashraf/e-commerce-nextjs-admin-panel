"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useEditThreshold } from "@/lib/api/hooks/useInventory";
import type { StockRow } from "@/lib/api/schemas/inventory";
import { toast } from "@/lib/stores/toast";

/**
 * Edit low-stock threshold modal (FR-INV-013, design §5/§7/§13.2). Integer ≥ 0;
 * on save the list refetch may flip the status badge to Low/Out when
 * available ≤ threshold. Server-confirmed.
 */
export function ThresholdModal({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const edit = useEditThreshold();
  const [value, setValue] = useState(String(row.low_stock_threshold));
  const fieldId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    return () => restoreFocusTo.current?.focus();
  }, []);

  const raw = value.trim();
  const n = Number(raw);
  const isInt = raw !== "" && Number.isInteger(n);
  const error = raw !== "" && (!isInt || n < 0) ? "Threshold can't be negative." : null;
  const valid = isInt && n >= 0;

  async function onSave() {
    if (!valid) return;
    try {
      await edit.mutateAsync({ variantId: row.variant_id, threshold: n });
      toast("Threshold updated.");
      onClose();
    } catch {
      toast("Couldn't update the threshold.", "error");
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="threshold-title"
        className="relative w-full max-w-xs rounded-lg bg-white p-5 shadow-xl"
      >
        <h2 id="threshold-title" className="text-base font-semibold text-gray-900">
          Edit low-stock threshold — {row.sku_code}
        </h2>
        <label htmlFor={fieldId} className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Low-stock threshold</span>
          <input
            ref={firstFieldRef}
            id={fieldId}
            className="h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? `${fieldId}-err` : `${fieldId}-help`}
          />
          {error ? (
            <span id={`${fieldId}-err`} role="alert" className="mt-1 block text-xs text-red-600">
              {error}
            </span>
          ) : (
            <span id={`${fieldId}-help`} className="mt-1 block text-xs text-gray-400">
              At/below this available, the SKU reads Low.
            </span>
          )}
        </label>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!valid || edit.isPending}
            aria-busy={edit.isPending}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {edit.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
