"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import {
  useAdminOrder,
  useUpdateOrderStatus,
  useCancelOrderAdmin,
} from "@/lib/api/hooks/useOrdersAdmin";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { formatBDT, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/stores/toast";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Select,
  Skeleton,
  StatusPill,
} from "@/components/ui";
import { PaymentPanel } from "@/components/payments/PaymentPanel";
import { printInvoice } from "./printInvoice";

/**
 * Admin order detail (ord-admin-fe), re-skinned to the design system as a single
 * scrolling column (used full-page on direct load and inside the AD3 Drawer over
 * the Orders list). Items/amounts/address/history; a status-advance form
 * (courier/tracking required for shipped; INVALID_TRANSITION / PAYMENT_REQUIRED
 * 409 guards); admin cancel; embedded PAY PaymentPanel. Presentation only — the
 * data hooks, mutations, transition rules, and permission gates are unchanged.
 */
// Mirrors the backend FORWARD_LIFECYCLE (fulfilment.service.ts): forward-only,
// one step at a time — confirmed → processing → packed → shipped →
// out_for_delivery → delivered. Admin cancel is allowed only pre-shipped.
const NEXT_STATUS: Record<string, string[]> = {
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-[15px] font-semibold text-text">{children}</h2>;
}

export function OrderDetailAdminView({
  orderNo,
  inDrawer = false,
}: {
  orderNo: string;
  inDrawer?: boolean;
}) {
  const { data, isLoading, isError } = useAdminOrder(orderNo);
  const updateStatus = useUpdateOrderStatus(orderNo);
  const cancel = useCancelOrderAdmin(orderNo);

  const [toStatus, setToStatus] = useState("");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [printing, setPrinting] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Card>
        <EmptyState
          title="We couldn't find that order."
          action={
            <Link href="/admin/orders">
              <Button variant="secondary" size="sm">
                Back to orders
              </Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const transitions = NEXT_STATUS[data.status] ?? [];
  const needsCourier = toStatus === "shipped";

  async function advance() {
    setError(null);
    if (!toStatus || !data) return;
    if (toStatus === "cancelled") {
      setConfirmCancel(true);
      return;
    }
    if (needsCourier && (!courier.trim() || !tracking.trim())) {
      setError("Courier and tracking number are required to mark as shipped.");
      return;
    }
    try {
      await updateStatus.mutateAsync({
        to_status: toStatus,
        courier_name: courier.trim() || undefined,
        tracking_number: tracking.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast(`Order marked ${toStatus.replace(/_/g, " ")}.`);
      setToStatus("");
      setCourier("");
      setTracking("");
      setNote("");
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_TRANSITION")
        setError("That status change isn't allowed from the current status.");
      else if (err instanceof ApiError && err.code === "PAYMENT_REQUIRED")
        setError("This online order must be paid before it can progress.");
      else if (err instanceof ApiError && err.status === 400)
        setError("Courier and tracking number are required for shipping.");
      else setError("Couldn't update the status. Try again.");
    }
  }

  const onPrint = async () => {
    setPrinting(true);
    try {
      await printInvoice(orderNo);
    } catch {
      toast("Couldn't open the invoice. Please try again.", "error");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header — full-page variant only; the Drawer chrome carries the title. */}
      {!inDrawer && (
        <div>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1 text-sm text-accent-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Orders
          </Link>
          <h1 className="mt-1 text-[22px] font-bold leading-7 text-text">
            Order {data.order_no}
          </h1>
        </div>
      )}

      {/* Status & payment badges + Print invoice */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={data.status} />
          {data.payment_state && (
            <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
              {data.payment_method?.toUpperCase() ?? "—"}
              <StatusPill status={data.payment_state} />
            </span>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onPrint}
          loading={printing}
          leadingIcon={<Printer className="h-4 w-4" aria-hidden="true" />}
        >
          Print invoice
        </Button>
      </div>

      {/* Status & fulfilment control */}
      <Can permission="orders.order.update_status">
        {transitions.length > 0 && (
          <Card className="p-4">
            <SectionTitle>Status &amp; fulfilment</SectionTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40">
                <Select
                  aria-label="Next status"
                  value={toStatus}
                  onChange={(e) => setToStatus(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {transitions.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </Select>
              </div>
              {needsCourier && (
                <>
                  <Input
                    className="w-36"
                    aria-label="Courier"
                    value={courier}
                    onChange={(e) => setCourier(e.target.value)}
                    placeholder="Courier"
                  />
                  <Input
                    className="w-40"
                    aria-label="Tracking number"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    placeholder="Tracking no."
                  />
                </>
              )}
              <Input
                className="min-w-[10rem] flex-1"
                aria-label="Note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
              />
              <Button
                onClick={advance}
                disabled={!toStatus}
                loading={updateStatus.isPending}
              >
                Apply
              </Button>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-sm text-error">
                {error}
              </p>
            )}
          </Card>
        )}
      </Can>

      {/* Items */}
      <section>
        <SectionTitle>Order items</SectionTitle>
        <Card>
          <ul className="divide-y divide-border">
            {data.items.map((it, i) => (
              <li key={i} className="flex justify-between gap-3 p-3 text-sm">
                <span>
                  <span className="block font-medium text-text">{it.product_title}</span>
                  <span className="text-xs text-text-muted">
                    {it.sku_code} · Qty {it.quantity}
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums text-text">
                  {formatBDT(Number(it.line_total))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Order summary */}
      {data.amounts && (
        <section>
          <SectionTitle>Order summary</SectionTitle>
          <Card className="p-4 text-sm">
            {data.amounts.subtotal != null && (
              <div className="flex justify-between py-1">
                <span className="text-text-muted">Subtotal</span>
                <span className="tabular-nums text-text-secondary">
                  {formatBDT(Number(data.amounts.subtotal))}
                </span>
              </div>
            )}
            {data.amounts.grand_total != null && (
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span className="text-text">Grand total</span>
                <span className="tabular-nums text-text">
                  {formatBDT(Number(data.amounts.grand_total))}
                </span>
              </div>
            )}
          </Card>
        </section>
      )}

      {/* Payment */}
      {data.payment_id && (
        <section>
          <SectionTitle>Payment</SectionTitle>
          <PaymentPanel paymentId={data.payment_id} />
        </section>
      )}

      {/* Customer & address */}
      {data.address && (
        <section>
          <SectionTitle>Customer &amp; delivery</SectionTitle>
          <Card className="p-4 text-sm text-text-secondary">
            <p className="font-medium text-text">{data.address.recipient_name}</p>
            <p>{data.address.recipient_phone}</p>
            <p className="mt-1">
              {data.address.address_line}
              {data.address.area ? `, ${data.address.area}` : ""}
              {data.address.district ? `, ${data.address.district}` : ""}
            </p>
          </Card>
        </section>
      )}

      {/* Status history timeline */}
      {data.history.length > 0 && (
        <section>
          <SectionTitle>Status history</SectionTitle>
          <Card className="p-4">
            <ol className="space-y-3">
              {data.history.map((h, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-600"
                    aria-hidden="true"
                  />
                  <div className="flex flex-1 flex-wrap items-baseline justify-between gap-2">
                    <span className="text-text-secondary">
                      {h.to_status.replace(/_/g, " ")}
                      {h.note ? ` — ${h.note}` : ""}
                    </span>
                    <span className="text-xs text-text-faint">
                      {formatDateTime(h.created_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      )}

      {/* Internal notes (read-only — no add hook in the data layer) */}
      {data.internal_notes.length > 0 && (
        <section>
          <SectionTitle>Internal notes</SectionTitle>
          <Card className="divide-y divide-border">
            {data.internal_notes.map((n, i) => (
              <div key={i} className="p-3 text-sm">
                <p className="text-text-secondary">{n.body}</p>
                {n.created_at && (
                  <p className="mt-0.5 text-xs text-text-faint">
                    {formatDateTime(n.created_at)}
                  </p>
                )}
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* Cancel */}
      <Can permission="orders.order.cancel">
        {data.status !== "cancelled" && data.status !== "delivered" && (
          <Button
            variant="secondary"
            className="w-full text-error hover:bg-error-50"
            onClick={() => setConfirmCancel(true)}
          >
            Cancel order
          </Button>
        )}
      </Can>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this order?"
        message="The order will be cancelled; stock is restocked and a prepaid payment is refunded."
        confirmLabel="Cancel order"
        danger
        pending={cancel.isPending}
        onConfirm={() =>
          cancel.mutate("admin_cancelled", {
            onSuccess: () => {
              setConfirmCancel(false);
              setToStatus("");
              toast("Order cancelled.");
            },
          })
        }
        onClose={() => setConfirmCancel(false)}
      />
    </div>
  );
}
