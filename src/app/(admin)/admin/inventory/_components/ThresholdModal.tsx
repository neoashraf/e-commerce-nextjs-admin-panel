"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { useEditThreshold } from "@/lib/api/hooks/useInventory";
import type { StockRow, StockStatus } from "@/lib/api/schemas/inventory";
import { toast } from "@/lib/stores/toast";
import { Button, Input, StatusPill } from "@/components/ui";
import { STATUS_LABEL } from "./shared";

/**
 * Edit low-stock threshold modal (FR-INV-013, design §5/§7/§13.2). Integer ≥ 0;
 * a live preview shows the status this threshold would produce; on save the list
 * refetch reconciles the badge. Server-confirmed. Re-skinned onto the design
 * tokens; data layer untouched (AD6).
 */
function statusAt(available: number, threshold: number): StockStatus {
  if (available <= 0) return "out_of_stock";
  if (available <= threshold) return "low_stock";
  return "in_stock";
}

export function ThresholdModal({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const edit = useEditThreshold();
  const [value, setValue] = useState(String(row.low_stock_threshold));
  const fieldId = useId();
  const titleId = useId();
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
  const previewStatus = statusAt(row.available, valid ? n : row.low_stock_threshold);

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
      <div
        className="absolute inset-0 bg-black/40 [animation:scrimIn_180ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[420px] overflow-hidden rounded-xl bg-surface shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[15px] font-semibold text-text">
              Edit low-stock threshold — {row.sku_code}
            </h2>
            <p className="mt-0.5 truncate text-sm text-text-muted">
              {row.product_title ?? row.sku_code}
              <span className="text-text-faint"> · available </span>
              <span className="tabular-nums">{row.available}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-5">
          <label htmlFor={fieldId} className="block">
            <span className="mb-1.5 block text-sm font-medium text-text">Low-stock threshold</span>
            <Input
              ref={firstFieldRef}
              id={fieldId}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              error={error ?? undefined}
              helper="At/below this available, the SKU reads Low."
              placeholder="e.g. 10"
            />
          </label>

          <div
            aria-live="polite"
            className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface-subtle px-3 py-2.5"
          >
            <span className="text-sm text-text-muted">Status at this threshold</span>
            <span className="ml-auto">
              <StatusPill status={previewStatus} label={STATUS_LABEL[previewStatus]} />
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
          <Button variant="secondary" onClick={onClose} disabled={edit.isPending}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!valid || edit.isPending} loading={edit.isPending}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
