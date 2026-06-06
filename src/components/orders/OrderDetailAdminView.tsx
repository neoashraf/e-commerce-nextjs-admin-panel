"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminOrder, useUpdateOrderStatus, useCancelOrderAdmin } from "@/lib/api/hooks/useOrdersAdmin";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { formatBDT, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/stores/toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PaymentPanel } from "@/components/payments/PaymentPanel";

/**
 * Admin order detail (ord-admin-fe). Items/amounts/address/history; a status-
 * advance form (courier/tracking required for shipped; INVALID_TRANSITION /
 * PAYMENT_REQUIRED 409 guards); admin cancel; embedded PAY PaymentPanel.
 */
const NEXT_STATUS: Record<string, string[]> = {
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
};

export function OrderDetailAdminView({ orderNo }: { orderNo: string }) {
  const { data, isLoading, isError } = useAdminOrder(orderNo);
  const updateStatus = useUpdateOrderStatus(orderNo);
  const cancel = useCancelOrderAdmin(orderNo);

  const [toStatus, setToStatus] = useState("");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
  if (isError || !data) {
    return <div className="py-12 text-center"><p className="text-sm text-gray-600">We couldn&apos;t find that order.</p><Link href="/admin/orders" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">Back to orders</Link></div>;
  }

  const transitions = NEXT_STATUS[data.status] ?? [];
  const needsCourier = toStatus === "shipped";

  async function advance() {
    setError(null);
    if (!toStatus) return;
    if (toStatus === "cancelled") { setConfirmCancel(true); return; }
    if (needsCourier && (!courier.trim() || !tracking.trim())) { setError("Courier and tracking number are required to mark as shipped."); return; }
    try {
      await updateStatus.mutateAsync({ to_status: toStatus, courier_name: courier.trim() || undefined, tracking_number: tracking.trim() || undefined, note: note.trim() || undefined });
      toast(`Order marked ${toStatus.replace(/_/g, " ")}.`);
      setToStatus(""); setCourier(""); setTracking(""); setNote("");
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_TRANSITION") setError("That status change isn't allowed from the current status.");
      else if (err instanceof ApiError && err.code === "PAYMENT_REQUIRED") setError("This online order must be paid before it can progress.");
      else if (err instanceof ApiError && err.status === 400) setError("Courier and tracking number are required for shipping.");
      else setError("Couldn't update the status. Try again.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/orders" className="text-sm text-brand-700 hover:underline">← Orders</Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">Order {data.order_no}</h1>
        <p className="text-sm text-gray-500">{data.status.replace(/_/g, " ")} · {data.payment_method?.toUpperCase()} · {data.payment_state}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Status advance */}
          <Can permission="orders.order.update_status">
            {transitions.length > 0 && (
              <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                <h2 className="text-base font-semibold text-gray-900">Update status</h2>
                <div className="flex flex-wrap gap-2">
                  <select value={toStatus} onChange={(e) => setToStatus(e.target.value)} className="h-9 rounded-md border border-gray-300 px-2 text-sm">
                    <option value="">Choose…</option>{transitions.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                  {needsCourier && <>
                    <input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Courier" className="h-9 rounded-md border border-gray-300 px-2 text-sm" />
                    <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking no." className="h-9 rounded-md border border-gray-300 px-2 text-sm" />
                  </>}
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-9 flex-1 rounded-md border border-gray-300 px-2 text-sm" />
                  <button type="button" onClick={advance} disabled={!toStatus || updateStatus.isPending} className="h-9 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">Apply</button>
                </div>
                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              </section>
            )}
          </Can>

          {/* Items */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">Items</h2>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {data.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3 p-3 text-sm">
                  <span><span className="block font-medium text-gray-900">{it.product_title}</span><span className="text-xs text-gray-500">{it.sku_code} · Qty {it.quantity}</span></span>
                  <span className="shrink-0 font-medium text-gray-900">{formatBDT(Number(it.line_total))}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* History */}
          {data.history.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-semibold text-gray-900">History</h2>
              <ol className="space-y-1.5">{data.history.map((h, i) => <li key={i} className="flex justify-between text-sm"><span className="text-gray-700">{h.to_status.replace(/_/g, " ")}{h.note ? ` — ${h.note}` : ""}</span><span className="text-gray-400">{formatDateTime(h.created_at)}</span></li>)}</ol>
            </section>
          )}
        </div>

        <div className="space-y-4">
          {data.payment_id && <PaymentPanel paymentId={data.payment_id} />}
          {data.address && (
            <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
              <h2 className="mb-2 text-base font-semibold text-gray-900">Delivery</h2>
              <p className="font-medium text-gray-900">{data.address.recipient_name}</p>
              <p>{data.address.recipient_phone}</p>
              <p className="mt-1">{data.address.address_line}{data.address.area ? `, ${data.address.area}` : ""}{data.address.district ? `, ${data.address.district}` : ""}</p>
            </section>
          )}
          <Can permission="orders.order.cancel">
            {data.status !== "cancelled" && data.status !== "delivered" && (
              <button type="button" onClick={() => setConfirmCancel(true)} className="h-10 w-full rounded-md border border-gray-300 text-sm font-medium text-red-600 hover:bg-gray-50">Cancel order</button>
            )}
          </Can>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this order?"
        message="The order will be cancelled; stock is restocked and a prepaid payment is refunded."
        confirmLabel="Cancel order"
        danger
        pending={cancel.isPending}
        onConfirm={() => cancel.mutate("admin_cancelled", { onSuccess: () => { setConfirmCancel(false); setToStatus(""); toast("Order cancelled."); } })}
        onClose={() => setConfirmCancel(false)}
      />
    </div>
  );
}
