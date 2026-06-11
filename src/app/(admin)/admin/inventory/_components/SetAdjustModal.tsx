"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useAdjustStock, useReceiveStock } from "@/lib/api/hooks/useInventory";
import type { StockRow } from "@/lib/api/schemas/inventory";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";

type Mode = "receive" | "adjust";

/**
 * Set / adjust stock modal (FR-INV-010/011/012, design §5/§7). One modal, two
 * modes: Receive (quantity > 0 → POST …/receive) and Adjust (signed delta ≠ 0 →
 * POST …/adjust). Live resulting on-hand/available preview, mandatory reason,
 * Save disabled until valid. Server-confirmed — waits for 200 then the list
 * refetch reconciles the row; 409 NEGATIVE_ON_HAND aborts without mutating.
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

  const inp =
    "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="set-adjust-title"
        className="relative w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
      >
        <h2 id="set-adjust-title" className="text-base font-semibold text-gray-900">
          Set / adjust stock — {row.sku_code}
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Current on-hand: <strong>{row.on_hand}</strong> · reserved: {row.reserved}
        </p>

        {/* Mode segmented control (arrow-navigable via Tab between buttons). */}
        <div className="mt-4 inline-flex rounded-md border border-gray-300 p-0.5 text-sm" role="group" aria-label="Mode">
          {(["receive", "adjust"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => switchMode(m)}
              className={
                "rounded px-3 py-1.5 font-medium capitalize " +
                (mode === m ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-50")
              }
            >
              {m}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {mode === "receive" ? "Receive adds units to on-hand." : "Adjust corrects up or down (use a minus for losses)."}
        </p>

        <label htmlFor={qtyId} className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-gray-900">
            {mode === "receive" ? "Quantity" : "Quantity delta"}
          </span>
          <input
            ref={firstFieldRef}
            id={qtyId}
            className={inp}
            type="number"
            inputMode="numeric"
            step={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            aria-invalid={!!qtyError}
            aria-describedby={qtyError ? `${qtyId}-err` : `${qtyId}-help`}
            placeholder={mode === "receive" ? "e.g. 20" : "e.g. -3"}
          />
          {qtyError ? (
            <span id={`${qtyId}-err`} role="alert" className="mt-1 block text-xs text-red-600">
              {qtyError}
            </span>
          ) : (
            <span id={`${qtyId}-help`} className="mt-1 block text-xs text-gray-400">
              {mode === "receive" ? "Units to add to on-hand." : "Use a minus for losses (e.g. −2)."}
            </span>
          )}
        </label>

        <label htmlFor={reasonId} className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Reason</span>
          <input
            id={reasonId}
            className={inp}
            maxLength={160}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouchedReason(true)}
            aria-invalid={!!reasonError}
            aria-describedby={reasonError ? `${reasonId}-err` : `${reasonId}-help`}
            placeholder="e.g. supplier delivery, damaged, recount"
          />
          {reasonError ? (
            <span id={`${reasonId}-err`} role="alert" className="mt-1 block text-xs text-red-600">
              {reasonError}
            </span>
          ) : (
            <span id={`${reasonId}-help`} className="mt-1 block text-xs text-gray-400">
              e.g. supplier delivery, damaged, recount.
            </span>
          )}
        </label>

        <p aria-live="polite" className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Resulting on-hand: <strong>{resultingOnHand}</strong> · available: <strong>{resultingAvailable}</strong>
        </p>

        {serverError && (
          <p role="alert" aria-live="assertive" className="mt-2 text-sm text-red-600">
            {serverError}
          </p>
        )}

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
            disabled={!valid || pending}
            aria-busy={pending}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
