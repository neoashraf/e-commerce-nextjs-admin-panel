"use client";

import { useState } from "react";
import Link from "next/link";
import { useHandoffExchange, type HandoffResult } from "@/lib/api/hooks/useLeadsAdmin";
import { ApiError } from "@/lib/api/errors";

/**
 * Claim → Orders handoff modal (FR-LEAD-016, BR-LEAD-3: exchange-only, no cash refund).
 * Initiates an exchange (post-delivery) or a pre-dispatch cancellation for an order item,
 * posting to POST /admin/leads/{reference}/handoff-exchange. On success it shows the returned
 * exchange linkage with a link into Orders; the backend records the linkage on the lead thread.
 */
export function LeadClaimHandoff({
  reference,
  defaultOrderRef,
  onClose,
}: {
  reference: string;
  defaultOrderRef?: string | null;
  onClose: () => void;
}) {
  const handoff = useHandoffExchange(reference);
  const [action, setAction] = useState<"exchange" | "cancel">("exchange");
  const [orderRef, setOrderRef] = useState(defaultOrderRef ?? "");
  const [orderItemId, setOrderItemId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HandoffResult | null>(null);

  const field = "h-10 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!orderRef.trim() || !orderItemId.trim() || !reason.trim()) {
      setError("Please fill in the order reference, item, and reason.");
      return;
    }
    try {
      const res = await handoff.mutateAsync({
        order_reference: orderRef.trim(),
        order_item_id: orderItemId.trim(),
        action,
        reason: reason.trim(),
      });
      setResult(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Couldn't process the handoff.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="handoff-title"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {result ? (
          <div className="text-center">
            <h2 id="handoff-title" className="text-lg font-semibold text-gray-900">Handoff started</h2>
            <p className="mt-2 text-sm text-gray-600">
              {result.handoff.replace(/_/g, " ")} for order {result.order_reference}.
            </p>
            {result.exchange_id && (
              <Link
                href={`/admin/exchanges/${result.exchange_id}`}
                className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline"
              >
                Open exchange {result.exchange_id} in Orders →
              </Link>
            )}
            <div className="mt-5">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <h2 id="handoff-title" className="text-lg font-semibold text-gray-900">Process exchange in Orders</h2>
              <p className="mt-1 text-xs text-gray-500">
                Exchange-only policy — no cash refund. This starts the process in Orders.
              </p>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Action</span>
              <select className={field} value={action} onChange={(e) => setAction(e.target.value as "exchange" | "cancel")}>
                <option value="exchange">Exchange (post-delivery)</option>
                <option value="cancel">Cancel (pre-dispatch)</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Order reference</span>
              <input className={field} value={orderRef} onChange={(e) => setOrderRef(e.target.value)} placeholder="SO-100245" />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Order item ID</span>
              <input className={field} value={orderItemId} onChange={(e) => setOrderItemId(e.target.value)} placeholder="oi_1" />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Reason</span>
              <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="wrong_size" />
            </label>

            {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button type="button" onClick={onClose} className="text-sm font-medium text-gray-500 hover:text-gray-700">
                Cancel
              </button>
              <button
                type="submit"
                disabled={handoff.isPending}
                className="h-9 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {handoff.isPending ? "Processing…" : "Start handoff"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
