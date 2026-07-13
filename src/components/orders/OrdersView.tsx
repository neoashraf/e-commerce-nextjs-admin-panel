"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, Check, Download, Filter as FilterIcon, Search, X } from "lucide-react";
import { useAdminOrders, type OrderRow } from "@/lib/api/hooks/useOrdersAdmin";
import { OrdersExportButton } from "@/components/orders/OrdersExportButton";
import { OrderRowMenu } from "@/components/orders/OrderRowMenu";
import { OrderDrawer } from "@/components/orders/OrderDrawer";
import { useAsyncExport } from "@/lib/api/hooks/reports";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { toast } from "@/lib/stores/toast";
import { formatBDT, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  Button,
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
  type SortDir,
  type TabItem,
} from "@/components/ui";
import { usePageParams } from "@/lib/usePageParams";

/**
 * Admin orders list (ord-admin-fe) — LIST archetype on the AD0 Table.
 * Status is a Tab bar (All + lifecycle statuses; Exchanges live on their own page,
 * so there is no Exchanges tab); the active tab carries a count badge (meta.total for
 * the current filter). Search + payment-state + date-range filters and the column sort
 * (sort/dir) are URL-reflected; a "{N} orders" readout sits at the end of the toolbar.
 * Columns are sortable via the shared TH (aria-sort + chevron); since the contract has no
 * `sort` param, the loaded page is sorted client-side. Paginated via the shared
 * TablePagination footer ("Showing X–Y of N"). Rows open the order detail drawer (AD3).
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

/**
 * Sortable columns (design: sortable headers w/ aria-sort + chevron). The contract's
 * GET /admin/orders has no `sort` param, so we sort the loaded page client-side rather
 * than invent a backend capability — the toolbar result-count + pager communicate the
 * full set. Each column maps to a comparator over the row; `placed`/`desc` is the default.
 */
type SortKey = "no" | "name" | "status" | "pay" | "total" | "placed";
const SORT_ACCESSORS: Record<SortKey, (o: OrderRow) => string | number> = {
  no: (o) => o.order_no,
  name: (o) => (o.customer?.name ?? "").toLowerCase(),
  status: (o) => o.status,
  pay: (o) => o.payment_state ?? o.payment_method ?? "",
  total: (o) => Number(o.grand_total ?? 0),
  placed: (o) => (o.placed_at ? Date.parse(o.placed_at) : 0),
};
const DEFAULT_SORT: SortKey = "placed";
const DEFAULT_DIR: SortDir = "desc";

/**
 * Display labels for known payment methods (design renders "bKash"/"SSLCommerz"/
 * "COD", not a naive uppercase). Unknown methods fall back to their upper-cased
 * value so a new BE method still reads sensibly without a code change.
 */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bkash: "bKash",
  sslcommerz: "SSLCommerz",
  cod: "COD",
};
function paymentMethodLabel(method?: string): string {
  if (!method) return "—";
  return PAYMENT_METHOD_LABELS[method.toLowerCase()] ?? method.toUpperCase();
}

function compareRows(a: OrderRow, b: OrderRow, key: SortKey, dir: SortDir): number {
  const av = SORT_ACCESSORS[key](a);
  const bv = SORT_ACCESSORS[key](b);
  const cmp =
    typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv));
  return dir === "asc" ? cmp : -cmp;
}

/** 18px rounded checkbox (design's selection box); `indeterminate` shows a dash. */
function CheckBox({
  checked,
  indeterminate = false,
  onClick,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onClick: () => void;
  label: string;
}) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1",
        on ? "border-accent-600 bg-accent-600 text-accent-fg" : "border-border-strong bg-surface",
      )}
    >
      {indeterminate ? (
        <span className="h-0.5 w-2.5 rounded-full bg-accent-fg" />
      ) : checked ? (
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      ) : null}
    </button>
  );
}

export function OrdersView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "";
  const paymentState = sp.get("payment_state") ?? "";
  const paymentMethod = sp.get("payment_method") ?? "";
  const q = sp.get("q") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const { pageSize, setPageSize } = usePageParams();
  // Order whose detail drawer is open over the list. Driven by `?order=` so a reload
  // re-opens the SAME drawer (instead of falling through to the full detail page);
  // copying the link still yields the canonical `/admin/orders/<no>` full page.
  const openOrderNo = sp.get("order");

  const sortParam = sp.get("sort") ?? "";
  const sortKey: SortKey =
    sortParam in SORT_ACCESSORS ? (sortParam as SortKey) : DEFAULT_SORT;
  const sortDir: SortDir = sp.get("dir") === "asc" ? "asc" : DEFAULT_DIR;

  // Staged filter values (design: explicit Filter/Clear). The status/payment/date
  // dropdowns edit LOCAL state and only hit the URL when "Filter" is clicked, so the
  // list doesn't refetch on every keystroke. Search (Enter) and the status Tabs stay
  // instant — they're their own affordances. We seed from the URL and re-sync whenever
  // the applied params change (Filter/Clear/tab/back-forward), so staged === applied
  // right after an apply and the "unapplied changes" hint clears.
  const [draft, setDraft] = useState({
    status,
    paymentState,
    paymentMethod,
    from,
    to,
  });
  useEffect(() => {
    setDraft({ status, paymentState, paymentMethod, from, to });
  }, [status, paymentState, paymentMethod, from, to]);

  /** Any staged dropdown/date filter differs from what's applied in the URL. */
  const isDirty =
    draft.status !== status ||
    draft.paymentState !== paymentState ||
    draft.paymentMethod !== paymentMethod ||
    draft.from !== from ||
    draft.to !== to;
  /** Any filter (staged or the instant search) is active — enables Clear. */
  const hasActiveFilter = Boolean(
    q ||
      draft.status ||
      draft.paymentState ||
      draft.paymentMethod ||
      draft.from ||
      draft.to,
  );

  const { data, isLoading, isError, refetch } = useAdminOrders({
    status: status || undefined,
    payment_state: paymentState || undefined,
    // payment_method filter is not yet supported by GET /admin/orders (see brief
    // briefs/safwan update api/ord-payment-method-filter-be.md) — sent so the wiring
    // works the moment the BE adds it; ignored by the API until then.
    payment_method: paymentMethod || undefined,
    q: q || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    limit: pageSize,
  });

  const total = data?.meta.total ?? 0;
  // Sort the loaded page client-side (no backend `sort` param in the contract).
  const rows = useMemo(() => {
    const list = data?.data ?? [];
    return [...list].sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [data, sortKey, sortDir]);

  // Row selection (client-side, current page). Drives the bulk-action bar. Bulk Export
  // runs the same filtered `orders_list` export as the toolbar (no bulk-by-id endpoint).
  const { can } = usePermissions();
  const canExport = can("reports.report.export");
  const { start: startExport, busy: exporting } = useAsyncExport();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pageNos = rows.map((o) => o.order_no);
  const allChecked = pageNos.length > 0 && pageNos.every((no) => selected.has(no));
  const someChecked = pageNos.some((no) => selected.has(no));

  function toggleRow(no: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (pageNos.every((no) => prev.has(no))) {
        const next = new Set(prev);
        pageNos.forEach((no) => next.delete(no));
        return next;
      }
      return new Set([...prev, ...pageNos]);
    });
  }
  function bulkExport() {
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (status) params.status = status;
    if (paymentState) params.payment_state = paymentState;
    if (from) params.from = from;
    if (to) params.to = to;
    startExport({ report_key: "orders_list", params, format: "csv" });
    toast("Preparing your CSV — it'll download and appear in Exports.");
  }

  /** Header click: same column flips direction; a new column starts on its default dir. */
  function setSort(key: SortKey) {
    const next = new URLSearchParams(sp.toString());
    const nextDir: "asc" | "desc" =
      key === sortKey ? (sortDir === "asc" ? "desc" : "asc") : "desc";
    if (key === DEFAULT_SORT && nextDir === DEFAULT_DIR) {
      next.delete("sort");
      next.delete("dir");
    } else {
      next.set("sort", key);
      next.set("dir", nextDir);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  /** Change a filter → reset to page 1 so we never land on an out-of-range page. */
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  /**
   * Apply the staged dropdown/date filters in one push (design: "Filter" button).
   * Search (`q`), sort and the open drawer are preserved; page resets to 1.
   */
  function applyFilters() {
    const next = new URLSearchParams(sp.toString());
    const set = (key: string, value: string) => {
      if (value) next.set(key, value);
      else next.delete(key);
    };
    set("status", draft.status);
    set("payment_state", draft.paymentState);
    set("payment_method", draft.paymentMethod);
    set("from", draft.from);
    set("to", draft.to);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  /**
   * Clear every filter — the staged dropdowns/dates AND the instant search (`q`).
   * Sort, page-size and the open drawer are kept; the effect above re-seeds the
   * draft from the now-empty URL so the toolbar resets in step.
   */
  function clearFilters() {
    setDraft({ status: "", paymentState: "", paymentMethod: "", from: "", to: "" });
    const next = new URLSearchParams(sp.toString());
    ["status", "payment_state", "payment_method", "from", "to", "q", "page"].forEach(
      (key) => next.delete(key),
    );
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(sp.toString());
    if (p > 1) next.set("page", String(p));
    else next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  /** Open the detail drawer over the list (adds `?order=`; keeps all other filters). */
  function openDrawer(orderNo: string) {
    const next = new URLSearchParams(sp.toString());
    next.set("order", orderNo);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }
  /** Close the drawer — drop `?order=` and return to the list it was opened from. */
  function closeDrawer() {
    const next = new URLSearchParams(sp.toString());
    next.delete("order");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold leading-7 text-text">Orders</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Search, filter and open orders — start with the ones that need action.
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

      {/* Status tabs (no Exchanges tab — exchanges are a separate page). The active
          tab shows a count badge — meta.total is truthful for the current filter; we
          don't fabricate per-tab totals the contract can't supply. */}
      <Tabs
        items={STATUS_TABS.map((t) =>
          (t.key === "all" ? !status : t.key === status) && !isLoading
            ? { ...t, count: total }
            : t,
        )}
        activeKey={status || "all"}
        onSelect={(key) => setFilter("status", key === "all" ? "" : key)}
      />

      {/* Search + payment-state + date-range — same params, URL-reflected. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <Input
            // Uncontrolled (defaultValue) so typing doesn't refetch on each keystroke;
            // key=q remounts it when the applied search changes (e.g. Clear) so the box
            // empties in step with the URL instead of keeping a stale value.
            key={q}
            leadingIcon={<Search className="h-4 w-4" />}
            placeholder="Search order no, customer name or phone…"
            aria-label="Search orders"
            defaultValue={q}
            onKeyDown={(e) =>
              e.key === "Enter" && setFilter("q", (e.target as HTMLInputElement).value)
            }
          />
        </div>
        {/* Status filter (design D) — staged: edits local draft and only takes effect
            when "Filter" is clicked. Shows the applied `status` until then, so it stays
            in sync with the tabs above (which apply the status param instantly). */}
        <div className="w-40">
          <Select
            aria-label="Filter by status"
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
          >
            <option value="">All status</option>
            <option value="pending_payment">Pending payment</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </Select>
        </div>
        <div className="w-40">
          <Select
            aria-label="Filter by payment state"
            value={draft.paymentState}
            onChange={(e) => setDraft((d) => ({ ...d, paymentState: e.target.value }))}
          >
            <option value="">All payments</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="cod_pending">COD pending</option>
          </Select>
        </div>
        {/* Payment-method filter (design D) — not yet honoured by the backend
            (no `payment_method` param on GET /admin/orders); see the BE brief. */}
        <div className="w-40">
          <Select
            aria-label="Filter by payment method"
            value={draft.paymentMethod}
            onChange={(e) => setDraft((d) => ({ ...d, paymentMethod: e.target.value }))}
          >
            <option value="">All methods</option>
            <option value="bkash">bKash</option>
            <option value="sslcommerz">SSLCommerz</option>
            <option value="cod">COD</option>
          </Select>
        </div>

        {/* Date range — one bordered pill (design D) wrapping the two native date
            pickers with a calendar icon + en-dash; staged into the draft. */}
        <div className="flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3">
          <Calendar className="h-4 w-4 shrink-0 text-text-faint" aria-hidden="true" />
          <input
            type="date"
            aria-label="Placed from"
            value={draft.from}
            max={draft.to || undefined}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            className="w-[120px] border-0 bg-transparent p-0 text-sm tabular-nums text-text outline-none focus:outline-none focus-visible:outline-none"
          />
          <span className="text-sm text-text-faint" aria-hidden="true">
            –
          </span>
          <input
            type="date"
            aria-label="Placed to"
            value={draft.to}
            min={draft.from || undefined}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            className="w-[120px] border-0 bg-transparent p-0 text-sm tabular-nums text-text outline-none focus:outline-none focus-visible:outline-none"
          />
        </div>

        {/* Filter / Clear (design D) — apply the staged dropdowns/dates in one push, or
            reset every filter (incl. the instant search). Filter is disabled until a
            staged value differs from what's applied; Clear until some filter is active. */}
        <Button
          variant="primary"
          size="md"
          leadingIcon={<FilterIcon className="h-4 w-4" aria-hidden="true" />}
          onClick={applyFilters}
          disabled={!isDirty}
        >
          Filter
        </Button>
        <Button
          variant="secondary"
          size="md"
          leadingIcon={<X className="h-4 w-4" aria-hidden="true" />}
          onClick={clearFilters}
          disabled={!hasActiveFilter}
        >
          Clear
        </Button>

        {/* Result count for the current filter (meta.total) — mirrors the design's
            "{N} orders" readout; aria-live so it's announced as filters change. */}
        {!isLoading && !isError && (
          <span
            aria-live="polite"
            className="ml-auto whitespace-nowrap text-sm tabular-nums text-text-muted"
          >
            {total} order{total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <SkeletonRows rows={pageSize} cols={7} />
        ) : isError ? (
          <ErrorState description="Couldn't load orders." onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No orders match these filters."
            description="Try a different tab, clear the search, or widen the date range."
          />
        ) : (
          <>
            {/* Bulk-action bar — appears on selection. Export runs the filtered orders_list
                CSV (no bulk-by-id endpoint), so it matches the on-screen filtered list. */}
            {someChecked && (
              <div className="flex items-center gap-3.5 border-b border-accent-100 bg-accent-50 px-4 py-2.5">
                <span className="text-[13px] font-semibold tabular-nums text-accent-700">
                  {selected.size} selected
                </span>
                {canExport && (
                  <button
                    type="button"
                    onClick={bulkExport}
                    disabled={exporting}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-accent-600 bg-surface px-2.5 text-[12.5px] font-semibold text-accent-700 hover:bg-accent-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    {exporting ? "Exporting…" : "Export"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-semibold text-text-muted hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR hover={false}>
                    <TH className="w-11 pr-0">
                      <CheckBox
                        checked={allChecked}
                        indeterminate={someChecked && !allChecked}
                        onClick={toggleAll}
                        label="Select all orders on this page"
                      />
                    </TH>
                    <TH sort={sortKey === "no" ? sortDir : null} onSort={() => setSort("no")}>
                      Order
                    </TH>
                    <TH sort={sortKey === "name" ? sortDir : null} onSort={() => setSort("name")}>
                      Customer
                    </TH>
                    <TH
                      sort={sortKey === "status" ? sortDir : null}
                      onSort={() => setSort("status")}
                    >
                      Status
                    </TH>
                    <TH sort={sortKey === "pay" ? sortDir : null} onSort={() => setSort("pay")}>
                      Payment
                    </TH>
                    <TH numeric sort={sortKey === "total" ? sortDir : null} onSort={() => setSort("total")}>
                      Total
                    </TH>
                    <TH
                      sort={sortKey === "placed" ? sortDir : null}
                      onSort={() => setSort("placed")}
                    >
                      Placed
                    </TH>
                    <TH className="text-right">
                      <span className="sr-only">Actions</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((o) => (
                    <TR
                      key={o.order_no}
                      className={cn(
                        "cursor-pointer",
                        selected.has(o.order_no) && "bg-accent-50/60",
                      )}
                      onClick={() => openDrawer(o.order_no)}
                    >
                      <TD className="pr-0" onClick={(e) => e.stopPropagation()}>
                        <CheckBox
                          checked={selected.has(o.order_no)}
                          onClick={() => toggleRow(o.order_no)}
                          label={`Select order ${o.order_no}`}
                        />
                      </TD>
                      <TD>
                        {/* Opens the detail as a drawer over the list via ?order= (survives
                            reload as a drawer). The href stays the canonical detail path so
                            middle-click / "open in new tab" / copy-link still reach the full page. */}
                        <Link
                          href={`/admin/orders/${o.order_no}`}
                          onClick={(e) => {
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                            e.preventDefault();
                            e.stopPropagation();
                            openDrawer(o.order_no);
                          }}
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
                        <div className="flex items-center gap-2">
                          <span className="whitespace-nowrap text-text-secondary">
                            {paymentMethodLabel(o.payment_method)}
                          </span>
                          {o.payment_state && (
                            <StatusPill status={o.payment_state} />
                          )}
                        </div>
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

      {/* Detail drawer over the list, opened/closed via the `?order=` param so a reload
          re-opens it. Keyed by order no so switching rows remounts (fresh focus trap). */}
      {openOrderNo && (
        <OrderDrawer key={openOrderNo} orderNo={openOrderNo} onClose={closeDrawer} />
      )}
    </div>
  );
}
