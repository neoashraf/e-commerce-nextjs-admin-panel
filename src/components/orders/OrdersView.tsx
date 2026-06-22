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
  TablePagination,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
  type TabItem,
} from "@/components/ui";
import { usePageParams } from "@/lib/usePageParams";

/**
 * Admin orders list (ord-admin-fe) — LIST archetype on the AD0 Table.
 * Status is a Tab bar (All + lifecycle statuses; Exchanges live on their own page,
 * so there is no Exchanges tab). Search + payment-state + date-range filters are
 * URL-reflected. Paginated via the shared TablePagination footer (DEFAULT_PAGE_SIZE/page,
 * "Showing X–Y of N"). Rows open the order detail drawer (AD3). Presentation only.
 */
/** Status tabs — lifecycle statuses only; no Exchanges tab (separate module). */
const STATUS_TABS: TabItem[] = [
  { key: "all", label: "All" },
  { key: "pending_payment", label: "Pending payment" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
  { key: "refunded", label: "Refunded" },
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
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const { pageSize, setPageSize } = usePageParams();

  const { data, isLoading, isError, refetch } = useAdminOrders({
    status: status || undefined,
    payment_state: paymentState || undefined,
    q: q || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    limit: pageSize,
  });

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  /** Change a filter → reset to page 1 so we never land on an out-of-range page. */
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(sp.toString());
    if (p > 1) next.set("page", String(p));
    else next.delete("page");
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
            from: from || undefined,
            to: to || undefined,
          }}
        />
      </div>

      {/* Status tabs (no Exchanges tab — exchanges are a separate page). */}
      <Tabs
        items={STATUS_TABS}
        activeKey={status || "all"}
        onSelect={(key) => setFilter("status", key === "all" ? "" : key)}
      />

      {/* Search + payment-state + date-range — same params, URL-reflected. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <Input
            leadingIcon={<Search className="h-4 w-4" />}
            placeholder="Search order no…"
            aria-label="Search orders"
            defaultValue={q}
            onKeyDown={(e) =>
              e.key === "Enter" && setFilter("q", (e.target as HTMLInputElement).value)
            }
          />
        </div>
        <div className="w-40">
          <Select
            aria-label="Payment state"
            value={paymentState}
            onChange={(e) => setFilter("payment_state", e.target.value)}
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
            onChange={(e) => setFilter("from", e.target.value)}
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
            onChange={(e) => setFilter("to", e.target.value)}
          />
        </label>
      </div>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <SkeletonRows rows={pageSize} cols={6} />
        ) : isError ? (
          <ErrorState description="Couldn't load orders." onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No orders match these filters."
            description="Try a different tab, clear the search, or widen the date range."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
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
                  {rows.map((o) => (
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
            </div>

            <TablePagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={goPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </Card>
    </div>
  );
}
