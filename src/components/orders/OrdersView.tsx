"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useAdminOrders } from "@/lib/api/hooks/useOrdersAdmin";
import { OrdersExportButton } from "@/components/orders/OrdersExportButton";
import { OrderRowMenu } from "@/components/orders/OrderRowMenu";
import { formatBDT, formatDate } from "@/lib/format";
import {
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  SkeletonRows,
  StatusPill,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";

/**
 * Admin orders list (ord-admin-fe), re-skinned to the LIST archetype on the AD0
 * Table primitive. Filters (status, payment_state, q, from/to date range) are
 * URL-reflected; rows open the order detail (rendered as a drawer over this list
 * by AD3). Presentation only — the query hook + params are unchanged.
 */
const STATUS_OPTIONS = [
  "pending_payment",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

export function OrdersView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "";
  const paymentState = sp.get("payment_state") ?? "";
  const q = sp.get("q") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  const { data, isLoading, isError, refetch } = useAdminOrders({
    status: status || undefined,
    payment_state: paymentState || undefined,
    q: q || undefined,
    from: from || undefined,
    to: to || undefined,
    page: 1,
    limit: 50,
  });

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold leading-7 text-text">Orders</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Search, filter, and open orders for fulfilment.
          </p>
        </div>
        <OrdersExportButton
          filters={{
            q: q || undefined,
            status: status || undefined,
            payment_state: paymentState || undefined,
          }}
        />
      </div>

      {/* Filter / search toolbar — same params, URL-reflected. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <Input
            leadingIcon={<Search className="h-4 w-4" />}
            placeholder="Search order no…"
            aria-label="Search orders"
            defaultValue={q}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              setParam("q", (e.target as HTMLInputElement).value)
            }
          />
        </div>
        <div className="w-40">
          <Select
            aria-label="Status"
            value={status}
            onChange={(e) => setParam("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Select
            aria-label="Payment state"
            value={paymentState}
            onChange={(e) => setParam("payment_state", e.target.value)}
          >
            <option value="">All payments</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="cod_pending">COD pending</option>
          </Select>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-text-muted">
          From
          <Input
            type="date"
            className="w-auto"
            aria-label="Placed from"
            value={from}
            max={to || undefined}
            onChange={(e) => setParam("from", e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-text-muted">
          To
          <Input
            type="date"
            className="w-auto"
            aria-label="Placed to"
            value={to}
            min={from || undefined}
            onChange={(e) => setParam("to", e.target.value)}
          />
        </label>
      </div>

      <Card>
        {isLoading ? (
          <SkeletonRows rows={8} cols={6} />
        ) : isError ? (
          <ErrorState description="Couldn't load orders." onRetry={() => refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="No orders match these filters."
            description="Try clearing search or widening the date range."
          />
        ) : (
          <Table>
            <THead>
              <TR hover={false}>
                <TH>Order</TH>
                <TH>Customer</TH>
                <TH>Status</TH>
                <TH>Payment</TH>
                <TH numeric>Total</TH>
                <TH>Placed</TH>
                <TH className="text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {data.map((o) => (
                <TR
                  key={o.order_no}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/orders/${o.order_no}`)}
                >
                  <TD>
                    <Link
                      href={`/admin/orders/${o.order_no}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-accent-700 hover:underline"
                    >
                      {o.order_no}
                    </Link>
                  </TD>
                  <TD>
                    <span className="block font-medium text-text">
                      {o.customer?.name ?? "—"}
                    </span>
                    {o.customer?.phone && (
                      <span className="block text-xs text-text-muted">
                        {o.customer.phone}
                      </span>
                    )}
                  </TD>
                  <TD>
                    <StatusPill status={o.status} />
                  </TD>
                  <TD>
                    <span className="block text-text-secondary">
                      {o.payment_method?.toUpperCase() ?? "—"}
                    </span>
                    {o.payment_state && (
                      <StatusPill status={o.payment_state} className="mt-0.5" />
                    )}
                  </TD>
                  <TD numeric className="text-text">
                    {o.grand_total ? formatBDT(Number(o.grand_total)) : "—"}
                  </TD>
                  <TD>{o.placed_at ? formatDate(o.placed_at) : "—"}</TD>
                  <TD className="text-right">
                    <OrderRowMenu orderNo={o.order_no} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {data && data.length > 0 && (
        <p className="text-sm text-text-muted tabular-nums">
          Showing {data.length} order{data.length === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}
