"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Ban,
  Box,
  Clock,
  CreditCard,
  Package,
  Plus,
  Printer,
  Receipt,
  StickyNote,
  Truck,
  User,
  type LucideIcon,
} from "lucide-react";
import {
  useAdminOrder,
  useUpdateOrderStatus,
  useCancelOrderAdmin,
  useAddOrderNote,
} from "@/lib/api/hooks/useOrdersAdmin";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { formatBDT, formatDateTime } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/media";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/cn";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Skeleton,
  StatusPill,
} from "@/components/ui";
import { PaymentPanel } from "@/components/payments/PaymentPanel";
import { printInvoice } from "./printInvoice";

/**
 * Admin order detail (ord-admin-fe), styled to the Orders (ORD) design file as a single
 * scrolling column of sectioned cards — used inside the AD3 Drawer over the list (and as the
 * full-page fallback on direct load). Each section is a white card with an accent-iconed heading:
 * Status & fulfilment (select → courier/tracking revealed for shipped, status note, CTA),
 * Order items, Order summary, Payment (embedded PAY panel), Customer details, Status history
 * timeline, Internal notes (add via POST notes), and a red-bordered Cancel card + confirm dialog.
 * Data hooks, mutations, transition rules, and permission gates are unchanged.
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

/** "inside_dhaka" → "Inside Dhaka"; "PRED-BLK" stays as-is when there's nothing to humanize. */
function humanize(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Variant options map ({ color: "Black", size: "42" }) → chips ["Black", "42"]. */
function variantChips(options: Record<string, string> | null | undefined): string[] {
  if (!options) return [];
  return Object.values(options);
}

/** BDT from a decimal string (defaults to 0). */
function money(value: string | null | undefined): string {
  return formatBDT(Number(value ?? 0));
}

function num(value: string | null | undefined): number {
  return Number(value ?? 0);
}

/** Section card with an accent-iconed heading row, matching the design's card pattern. */
function Section({
  icon: Icon,
  title,
  count,
  danger = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  count?: React.ReactNode;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("p-4", danger && "border-error/40")}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-[18px] w-[18px] text-accent-600" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {count !== undefined && (
          <span className="text-xs tabular-nums text-text-faint">· {count}</span>
        )}
      </div>
      {children}
    </Card>
  );
}

/** Uppercase eyebrow label above a field/value (design's field labels). */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-eyebrow font-semibold uppercase tracking-wide text-text-faint">
      {children}
    </span>
  );
}

const textareaCls =
  "w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-sm leading-relaxed text-text placeholder:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600";
const selectCls =
  "h-9 w-full appearance-none rounded-md border border-border-strong bg-surface pl-3 pr-9 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600";

export function OrderDetailAdminView({
  orderNo,
  variant = "page",
}: {
  orderNo: string;
  /** "page" renders its own title + pills + Print; "drawer" omits them (the drawer chrome owns them). */
  variant?: "page" | "drawer";
}) {
  const inDrawer = variant === "drawer";
  const { data, isLoading, isError } = useAdminOrder(orderNo);
  const updateStatus = useUpdateOrderStatus(orderNo);
  const cancel = useCancelOrderAdmin(orderNo);
  const addNote = useAddOrderNote(orderNo);

  const [toStatus, setToStatus] = useState("");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  if (isLoading) {
    return (
      <div className="space-y-3.5">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
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
  const shipErr = error && needsCourier && (!courier.trim() || !tracking.trim());
  const itemCount = data.items.reduce((sum, it) => sum + it.quantity, 0);
  const discount = num(data.amounts?.discount);
  const codSurcharge = num(data.amounts?.cod_surcharge);
  const vat = num(data.amounts?.vat);
  const canCancel = data.status !== "cancelled" && data.status !== "delivered";

  async function advance() {
    setError(null);
    if (!toStatus || !data) return;
    if (toStatus === "cancelled") {
      setConfirmCancel(true);
      return;
    }
    if (needsCourier && (!courier.trim() || !tracking.trim())) {
      setError("Add courier and tracking to mark as shipped.");
      return;
    }
    try {
      await updateStatus.mutateAsync({
        to_status: toStatus,
        courier_name: courier.trim() || undefined,
        tracking_number: tracking.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast(
        toStatus === "shipped"
          ? "Order marked as shipped."
          : `Status updated to ${humanize(toStatus)}.`,
      );
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
        setError("Add courier and tracking to mark as shipped.");
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

  function onAddNote() {
    const body = noteDraft.trim();
    if (!body) return;
    addNote.mutate(body, {
      onSuccess: () => {
        setNoteDraft("");
        toast("Note added.");
      },
      onError: () => toast("Couldn't add the note. Try again.", "error"),
    });
  }

  return (
    <div className="space-y-3.5">
      {/* Full-page header — title + pills + meta + Print. In the drawer these live in the
          drawer chrome (OrderDrawer), so this whole block is omitted there. */}
      {!inDrawer && (
        <>
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

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={data.status} />
                {data.payment_state && (
                  <span className="inline-flex items-center gap-1.5">
                    <Badge tone="neutral">{data.payment_method?.toUpperCase() ?? "—"}</Badge>
                    <StatusPill status={data.payment_state} />
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                {data.placed_at && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Placed {formatDateTime(data.placed_at)}
                  </span>
                )}
                {data.delivery_zone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                    {humanize(data.delivery_zone)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" aria-hidden="true" />
                  {itemCount} item{itemCount === 1 ? "" : "s"}
                </span>
              </div>
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
        </>
      )}

      {/* 2. STATUS & FULFILMENT */}
      <Can permission="orders.order.update_status">
        {transitions.length > 0 && (
          <Section icon={Truck} title="Status & fulfilment">
            <div className="flex flex-col gap-3">
              <label className="block">
                <FieldLabel>Move order to</FieldLabel>
                <div className="relative">
                  <select
                    aria-label="Move order to status"
                    value={toStatus}
                    onChange={(e) => {
                      setToStatus(e.target.value);
                      setError(null);
                    }}
                    className={selectCls}
                  >
                    <option value="">Choose…</option>
                    {transitions.map((s) => (
                      <option key={s} value={s}>
                        {humanize(s)}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon />
                </div>
              </label>

              {/* Shipment fields — required to mark as shipped. */}
              {needsCourier && (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <label className="block">
                    <FieldLabel>
                      Courier <span className="text-error">*</span>
                    </FieldLabel>
                    <input
                      type="text"
                      aria-label="Courier"
                      placeholder="e.g. Sundarban Courier"
                      value={courier}
                      onChange={(e) => setCourier(e.target.value)}
                      className={cn(
                        "h-9 w-full rounded-md border bg-surface px-3 text-sm text-text placeholder:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
                        shipErr && !courier.trim() ? "border-error" : "border-border-strong",
                      )}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>
                      Tracking no <span className="text-error">*</span>
                    </FieldLabel>
                    <input
                      type="text"
                      aria-label="Tracking number"
                      placeholder="e.g. TRK90245"
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                      className={cn(
                        "h-9 w-full rounded-md border bg-surface px-3 text-sm tabular-nums text-text placeholder:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
                        shipErr && !tracking.trim() ? "border-error" : "border-border-strong",
                      )}
                    />
                  </label>
                </div>
              )}

              <label className="block">
                <FieldLabel>Status note (optional)</FieldLabel>
                <textarea
                  rows={2}
                  aria-label="Status note"
                  placeholder="Add context for this change…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={textareaCls}
                />
              </label>

              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-md border border-error/30 bg-error-50 px-3 py-2 text-[13px] text-error"
                >
                  {error}
                </div>
              )}

              <Button
                onClick={advance}
                disabled={!toStatus}
                loading={updateStatus.isPending}
                className="self-start"
                leadingIcon={needsCourier ? <Truck className="h-4 w-4" aria-hidden="true" /> : undefined}
              >
                {needsCourier ? "Mark as shipped" : "Update status"}
              </Button>
            </div>
          </Section>
        )}
      </Can>

      {/* 3. ORDER ITEMS */}
      <Section icon={Box} title="Order items" count={`${itemCount} item${itemCount === 1 ? "" : "s"}`}>
        <ul className="-mt-3 divide-y divide-border">
          {data.items.map((it, i) => (
            <li key={i} className="flex items-start gap-3 py-3">
              {it.product_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveMediaUrl(it.product_image)}
                  alt={it.product_title}
                  className="h-[46px] w-[46px] shrink-0 rounded-lg border border-border object-cover"
                />
              ) : (
                <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-faint">
                  <Package className="h-5 w-5" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-text">{it.product_title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {variantChips(it.variant_options).map((chip, ci) => (
                    <span
                      key={ci}
                      className="rounded-md bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-text-secondary"
                    >
                      {chip}
                    </span>
                  ))}
                  {it.sku_code && (
                    <span className="text-[11px] tabular-nums text-text-faint">
                      SKU {it.sku_code}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold tabular-nums text-text">
                  {money(it.line_total)}
                </div>
                <div className="mt-0.5 text-[11px] tabular-nums text-text-faint">
                  {money(it.unit_price)} × {it.quantity}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* 4. ORDER SUMMARY */}
      {data.amounts && (
        <Section icon={Receipt} title="Order summary">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Subtotal</span>
              <span className="tabular-nums text-text-secondary">{money(data.amounts.subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-text-muted">
                  Discount
                  {data.applied_coupon_code && (
                    <Badge tone="accent">{data.applied_coupon_code}</Badge>
                  )}
                </span>
                <span className="tabular-nums text-success">− {money(data.amounts.discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Delivery charge</span>
              <span className="tabular-nums text-text-secondary">
                {num(data.amounts.delivery_charge) > 0
                  ? money(data.amounts.delivery_charge)
                  : "Free"}
              </span>
            </div>
            {codSurcharge > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-text-muted">COD surcharge</span>
                <span className="tabular-nums text-text-secondary">
                  {money(data.amounts.cod_surcharge)}
                </span>
              </div>
            )}
            <div className="my-1 h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-text">Total</span>
              <span className="text-base font-bold tabular-nums text-text">
                {money(data.amounts.grand_total)}
              </span>
            </div>
            {vat > 0 && (
              <div className="flex items-center justify-between text-xs text-text-faint">
                <span>Incl. VAT</span>
                <span className="tabular-nums">{money(data.amounts.vat)}</span>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* 5. PAYMENT (embedded PAY panel) */}
      {data.payment_id && (
        <Section icon={CreditCard} title="Payment">
          <PaymentPanel paymentId={data.payment_id} />
        </Section>
      )}

      {/* 6. CUSTOMER DETAILS */}
      {data.address && (
        <Section icon={User} title="Customer details">
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Customer</FieldLabel>
              <div className="text-sm font-semibold text-text">
                {data.address.recipient_name}
              </div>
            </div>
            <div>
              <FieldLabel>Contact</FieldLabel>
              <div className="text-sm tabular-nums text-text-secondary">
                {data.address.recipient_phone}
              </div>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Shipping address</FieldLabel>
              <div className="text-[13px] leading-relaxed text-text-secondary">
                {[
                  data.address.address_line,
                  data.address.area,
                  data.address.district,
                  data.address.division,
                  data.address.postal_code,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* 7. STATUS HISTORY (append-only timeline) */}
      {data.history.length > 0 && (
        <Section icon={Clock} title="Status history">
          <ol className="-mb-4">
            {data.history.map((h, i) => {
              const last = i === data.history.length - 1;
              return (
                <li key={i} className="flex gap-3">
                  <div className="flex w-3 flex-shrink-0 flex-col items-center">
                    <span
                      className="mt-1 h-[11px] w-[11px] rounded-full bg-accent-600 ring-2 ring-surface"
                      aria-hidden="true"
                    />
                    {!last && <span className="my-1 w-0.5 flex-1 bg-border" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 pb-4">
                    <div className="text-[13px] font-semibold text-text">
                      {humanize(h.to_status)}
                    </div>
                    <div className="mt-0.5 text-[11px] tabular-nums text-text-faint">
                      {h.actor_type ? `${humanize(h.actor_type)} · ` : ""}
                      {formatDateTime(h.created_at)}
                    </div>
                    {h.note && <p className="mt-1 text-xs text-text-muted">{h.note}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      {/* 8. INTERNAL NOTES (append-only; not customer-visible) */}
      <Can permission="orders.order.update_status">
        <Section icon={StickyNote} title="Internal notes">
          {data.internal_notes.length > 0 ? (
            <div className="mb-3 flex flex-col gap-2.5">
              {data.internal_notes.map((n, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-surface-subtle px-3 py-2.5"
                >
                  <p className="text-[13px] leading-relaxed text-text-secondary">{n.body}</p>
                  {n.created_at && (
                    <p className="mt-1 text-[11px] tabular-nums text-text-faint">
                      {formatDateTime(n.created_at)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-[13px] text-text-faint">No internal notes yet.</p>
          )}
          <textarea
            rows={2}
            aria-label="Add an internal note"
            placeholder="Add an internal note…"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            className={textareaCls}
          />
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <span className="text-[11px] text-text-faint">Not visible to the customer.</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={onAddNote}
              disabled={!noteDraft.trim()}
              loading={addNote.isPending}
              leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              Add note
            </Button>
          </div>
        </Section>
      </Can>

      {/* 9. CANCEL ORDER (pre-shipped) */}
      <Can permission="orders.order.cancel">
        {canCancel && (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-error/40 p-4">
            <div>
              <div className="text-[13px] font-semibold text-text">Cancel this order</div>
              <div className="mt-0.5 text-xs text-text-muted">
                Only available before the order is shipped.
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => setConfirmCancel(true)}
              className="border-error/40 text-error hover:bg-error-50"
              leadingIcon={<Ban className="h-4 w-4" aria-hidden="true" />}
            >
              Cancel order
            </Button>
          </Card>
        )}
      </Can>

      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel order ${data.order_no}?`}
        message="Cancelling will restock items and refund the prepaid amount to the customer."
        confirmLabel="Cancel order"
        danger
        pending={cancel.isPending}
        onConfirm={() =>
          cancel.mutate("admin_cancelled", {
            onSuccess: () => {
              setConfirmCancel(false);
              setToStatus("");
              toast("Order cancelled — items restocked & refunded.");
            },
          })
        }
        onClose={() => setConfirmCancel(false)}
      />
    </div>
  );
}

/** Chevron overlay for the native status select (design's chevron affordance). */
function ChevronDownIcon() {
  return (
    <svg
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
