"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useExchanges } from "@/lib/api/hooks/exchanges";
import {
  EXCHANGE_STATUSES,
  EXCHANGE_REASONS,
} from "@/lib/api/schemas/exchanges";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { formatDate } from "@/lib/format";
import { usePageParams } from "@/lib/usePageParams";
import {
  Card,
  EmptyState,
  ErrorState,
  Select,
  SkeletonRows,
  StatusPill,
  Table,
  TablePagination,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";

/**
 * Exchange queue (ord-exchange-admin-fe, AC1/FR-ORD-047) on the shared Data Table
 * primitive: Card-wrapped table, StatusPill, a QA-due highlight for quality-defect
 * reviews, and the shared TablePagination footer (DEFAULT_PAGE_SIZE/page). Filterable
 * (status, reason), URL-reflected; gated on `orders.exchange.read`; rows link to review.
 */
const humanize = (s: string) => s.replace(/_/g, " ");

/** Returns "overdue" | "soon" | null for a QA due date (≤2 days = soon). */
function qaUrgency(iso: string | null | undefined): "overdue" | "soon" | null {
  if (!iso) return null;
  const due = new Date(iso).getTime();
  if (Number.isNaN(due)) return null;
  const now = Date.now();
  if (due < now) return "overdue";
  if (due - now < 2 * 24 * 60 * 60 * 1000) return "soon";
  return null;
}

export function ExchangeQueueView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { can } = usePermissions();

  const status = sp.get("status") ?? "";
  const reason = sp.get("reason") ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const { pageSize, setPageSize } = usePageParams();

  const { data, isLoading, isError, refetch } = useExchanges({
    status: status || undefined,
    reason: reason || undefined,
    page,
    limit: pageSize,
  });

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  /** Filter changes reset to page 1. */
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(sp.toString());
    if (p > 1) next.set("page", String(p));
    else next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  if (!can("orders.exchange.read")) {
    return (
      <Card className="p-0">
        <EmptyState
          title="No access to exchanges"
          description="You don’t have permission to view exchanges."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold leading-7 tracking-tight text-text">Exchanges</h1>
        <p className="mt-0.5 text-sm text-text-muted">
          Exchange/replacement only — no cash refund. Quality claims must pass QA before approval.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44">
          <Select value={status} onChange={(e) => setParam("status", e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {EXCHANGE_STATUSES.map((s) => (
              <option key={s} value={s}>{humanize(s)}</option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <Select value={reason} onChange={(e) => setParam("reason", e.target.value)} aria-label="Filter by reason">
            <option value="">All reasons</option>
            {EXCHANGE_REASONS.map((r) => (
              <option key={r} value={r}>{humanize(r)}</option>
            ))}
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <SkeletonRows rows={pageSize} cols={6} />
        ) : isError ? (
          <ErrorState description="Couldn’t load exchanges." onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No exchange requests match your filters." />
        ) : (
          <>
            <Table>
              <THead>
                <TR hover={false}>
                  <TH>Exchange</TH>
                  <TH>Order</TH>
                  <TH>Item</TH>
                  <TH>Reason</TH>
                  <TH>Status</TH>
                  <TH>QA due</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((x) => {
                  const urgency = qaUrgency(x.qa_due_at);
                  return (
                    <TR
                      key={x.exchange_id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/admin/exchanges/${x.exchange_id}`)}
                    >
                      <TD>
                        <Link
                          href={`/admin/exchanges/${x.exchange_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-xs font-medium text-accent-700 hover:underline"
                        >
                          {x.exchange_id}
                        </Link>
                      </TD>
                      <TD>
                        <Link
                          href={`/admin/orders/${x.order_no}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-xs text-text-secondary hover:underline"
                        >
                          {x.order_no}
                        </Link>
                      </TD>
                      <TD>{x.order_item?.title ?? x.order_item?.sku_code ?? "—"}</TD>
                      <TD>{humanize(x.reason)}</TD>
                      <TD>
                        <StatusPill status={x.status} label={humanize(x.status)} />
                      </TD>
                      <TD>
                        {x.qa_due_at ? (
                          <span
                            className={
                              urgency === "overdue"
                                ? "font-medium text-error"
                                : urgency === "soon"
                                  ? "font-medium text-warning"
                                  : "text-text-muted"
                            }
                          >
                            {formatDate(x.qa_due_at)}
                            {urgency === "overdue" ? " · overdue" : urgency === "soon" ? " · soon" : ""}
                          </span>
                        ) : (
                          <span className="text-text-faint">—</span>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
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
