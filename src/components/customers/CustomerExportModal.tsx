"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Download, Filter, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Export modal for the Customers directory (design §8.9, FR-CUST-040). A
 * non-sensitive field multi-select + the "current filter applies" note + the
 * background-prepare note. Presentation only — the data layer has no customers
 * export mutation yet, so `onConfirm` is wired by the parent to a toast.
 * TODO(design): wire to a real `useCustomerExport`/`POST /admin/customers/export`
 * mutation when the hook is added (out of scope for this presentation task).
 */

const EXPORT_FIELDS = [
  "Name",
  "Phone",
  "Email",
  "Status",
  "Orders",
  "Total spent",
  "Last order",
  "Customer ID",
] as const;

const DEFAULT_SELECTED: Record<string, boolean> = {
  Name: true,
  Phone: true,
  Email: true,
  Status: true,
  Orders: true,
  "Total spent": true,
  "Last order": true,
  "Customer ID": false,
};

export function CustomerExportModal({
  open,
  resultCount,
  onClose,
  onConfirm,
}: {
  open: boolean;
  /** The current filtered count to surface in the "current filter applies" note. */
  resultCount: number | null;
  onClose: () => void;
  onConfirm: (fields: string[]) => void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>(DEFAULT_SELECTED);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLElement>("button")?.focus(),
    );
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      prevFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const countLabel =
    resultCount === null ? "the current filter" : `${resultCount.toLocaleString("en-US")} customers`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[460px] overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-accent-50 text-accent-600">
              <Download className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div>
              <h2 id={titleId} className="text-base font-bold tracking-tight text-text">
                Export customers
              </h2>
              <p className="mt-0.5 text-[12.5px] text-text-muted">
                Choose the columns to include in the CSV.
              </p>
            </div>
          </div>
          <Button variant="icon" size="sm" aria-label="Close" onClick={onClose}>
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </Button>
        </div>

        {/* Field multi-select */}
        <div className="px-5 pb-1 pt-4">
          <div className="mb-2.5 text-eyebrow uppercase tracking-wide text-text-faint">
            Fields
          </div>
          <div className="mb-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
            {EXPORT_FIELDS.map((f) => {
              const on = !!selected[f];
              return (
                <button
                  key={f}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => setSelected((s) => ({ ...s, [f]: !s[f] }))}
                  className="flex h-[34px] w-full items-center gap-2.5 rounded-md px-1 text-left hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                >
                  <span
                    className={cn(
                      "flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-sm border-[1.5px] text-accent-fg",
                      on ? "border-accent-600 bg-accent-600" : "border-border-strong bg-surface",
                    )}
                  >
                    {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                  </span>
                  <span className="text-sm text-text-secondary">{f}</span>
                </button>
              );
            })}
          </div>
          {/* Current-filter note */}
          <div className="my-2 flex items-center gap-2 rounded-md border border-info/30 bg-info-50 px-3 py-2.5">
            <span className="flex-shrink-0 text-info">
              <Filter className="h-[15px] w-[15px]" aria-hidden="true" />
            </span>
            <span className="text-[12.5px] text-info">
              The current filter applies — {countLabel} will be exported.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-subtle px-5 py-3.5">
          <span className="min-w-[160px] flex-1 text-[11.5px] text-text-faint">
            Large exports are prepared in the background.
          </span>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => onConfirm(EXPORT_FIELDS.filter((f) => selected[f]))}
            >
              Export CSV
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
