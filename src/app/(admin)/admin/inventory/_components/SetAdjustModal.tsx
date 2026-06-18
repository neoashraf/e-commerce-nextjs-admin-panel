"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useAdjustStock, useReceiveStock } from "@/lib/api/hooks/useInventory";
import type { StockRow } from "@/lib/api/schemas/inventory";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";
import { Button, Input, SegmentedControl } from "@/components/ui";
import { cn } from "@/lib/cn";

type Mode = "receive" | "adjust";

/**
 * Set / adjust stock modal (FR-INV-010/011/012, design §5/§7). One modal, two
 * modes: Receive (quantity > 0 → POST …/receive) and Adjust (signed delta ≠ 0 →
 * POST …/adjust). Live resulting on-hand/available preview, mandatory reason,
 * Save disabled until valid. Server-confirmed — waits for 200 then the list
 * refetch reconciles the row; 409 NEGATIVE_ON_HAND aborts without mutating.
 * Re-skinned onto the design tokens; data layer untouched (AD6).
 */
export function SetAdjustModal({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const receive = useReceiveStock();
  const adjust = useAdjustStock();
  const [mode, setMode] = useState<Mode>("receive");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [touchedReason, setTouchedReason] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const qtyId = useId();
  const reasonId = useId();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  // Restore focus to the triggering row's action on close (a11y §10).
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    return () => restoreFocusTo.current?.focus();
  }, []);

  const pending = receive.isPending || adjust.isPending;

  const raw = qty.trim();
  const n = Number(raw);
  const qtyIsInt = raw !== "" && Number.isInteger(n);
  const qtyError =
    raw === ""
      ? null
      : mode === "receive"
        ? !qtyIsInt || n <= 0
          ? "Enter a quantity greater than 0."
          : null
        : !qtyIsInt || n === 0
          ? "Enter a non-zero change."
          : null;
  const reasonError = reason.trim() === "" && touchedReason ? "A reason is required." : null;

  const qtyValid = mode === "receive" ? qtyIsInt && n > 0 : qtyIsInt && n !== 0;
  const valid = qtyValid && reason.trim() !== "";

  // Preview math: Receive adds, Adjust applies the signed delta. (design §7)
  const delta = qtyValid ? n : 0;
  const resultingOnHand = row.on_hand + (mode === "receive" ? Math.max(delta, 0) : delta);
  const resultingAvailable = resultingOnHand - row.reserved;

  function switchMode(m: Mode) {
    setMode(m);
    setQty("");
    setServerError(null);
  }

  async function onSave() {
    if (!valid) return;
    setServerError(null);
    try {
      if (mode === "receive") {
        await receive.mutateAsync({ variantId: row.variant_id, quantity: n, reason: reason.trim() });
      } else {
        await adjust.mutateAsync({ variantId: row.variant_id, quantity_delta: n, reason: reason.trim() });
      }
      toast("Stock updated.");
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "NEGATIVE_ON_HAND") {
        setServerError("Adjustment would make on-hand negative. On-hand can't go below 0.");
      } else if (err instanceof ApiError && err.status === 400) {
        setServerError(err.message || "Check the quantity and reason.");
      } else {
        setServerError("Couldn't update stock. Please try again.");
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    if (e.key !== "Tab") return;
    // Simple focus trap over the dialog's focusable elements.
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const negativeResult = resultingAvailable < 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onKeyDown={onKeyDown}>
      <div
        className="absolute inset-0 bg-black/40 [animation:scrimIn_180ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[460px] overflow-hidden rounded-xl bg-surface shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[15px] font-semibold text-text">
              Set / adjust stock — {row.sku_code}
            </h2>
            <p className="mt-0.5 text-sm text-text-muted">
              Current on-hand <strong className="font-semibold text-text-secondary tabular-nums">{row.on_hand}</strong> · reserved{" "}
              <span className="tabular-nums">{row.reserved}</span>
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
          <SegmentedControl<Mode>
            ariaLabel="Mode"
            options={[
              { value: "receive", label: "Receive" },
              { value: "adjust", label: "Adjust" },
            ]}
            value={mode}
            onChange={switchMode}
          />
          <p className="mt-1.5 text-xs text-text-muted">
            {mode === "receive"
              ? "Receive adds units to on-hand."
              : "Adjust corrects up or down (use a minus for losses)."}
          </p>

          <label htmlFor={qtyId} className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-text">
              {mode === "receive" ? "Quantity" : "Quantity delta"}
            </span>
            <Input
              ref={firstFieldRef}
              id={qtyId}
              type="number"
              inputMode="numeric"
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              error={qtyError ?? undefined}
              helper={
                mode === "receive" ? "Units to add to on-hand." : "Use a minus for losses (e.g. −2)."
              }
              placeholder={mode === "receive" ? "e.g. 20" : "e.g. -3"}
            />
          </label>

          <label htmlFor={reasonId} className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-text">Reason</span>
            <textarea
              id={reasonId}
              rows={2}
              maxLength={160}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouchedReason(true)}
              aria-invalid={reasonError ? true : undefined}
              aria-describedby={reasonError ? `${reasonId}-err` : undefined}
              placeholder="Why is stock changing?"
              className={cn(
                "w-full resize-y rounded-md border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1",
                reasonError ? "border-error" : "border-border-strong",
              )}
            />
            {reasonError && (
              <span id={`${reasonId}-err`} role="alert" className="mt-1 block text-xs text-error">
                {reasonError}
              </span>
            )}
          </label>

          <div
            aria-live="polite"
            className="mt-4 flex gap-3 rounded-lg border border-border bg-surface-subtle p-3"
          >
            <div className="flex-1">
              <p className="text-eyebrow uppercase tracking-wide text-text-muted">Resulting on-hand</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-text">{resultingOnHand}</p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1">
              <p className="text-eyebrow uppercase tracking-wide text-text-muted">Resulting available</p>
              <p className={cn("mt-0.5 text-xl font-bold tabular-nums", negativeResult ? "text-error" : "text-text")}>
                {resultingAvailable}
                <span className="ml-1 text-xs font-medium text-text-faint">· {row.reserved} reserved</span>
              </p>
            </div>
          </div>

          {serverError && (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-3 flex items-start gap-2 rounded-lg border border-error/30 bg-error-50 px-3 py-2.5 text-[13px] text-error"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{serverError}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!valid || pending} loading={pending}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
