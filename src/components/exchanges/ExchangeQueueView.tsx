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

/**
 * Exchange queue (ord-exchange-admin-fe, AC1/FR-ORD-047). Filterable table
 * (status, reason) with a QA-due highlight for quality-defect reviews. Gated on
 * `orders.exchange.read`; rows link to the review screen.
 */
const STATUS_STYLE: Record<string, string> = {
  requested: "bg-blue-50 text-blue-700",
  under_qa_review: "bg-amber-50 text-amber-700",
  approved: "bg-indigo-50 text-indigo-700",
  replacement_issued: "bg-green-50 text-green-700",
  completed: "bg-green-50 text-green-700",
  rejected: "bg-gray-100 text-gray-500",
};

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

  const { data, isLoading, isError, refetch } = useExchanges({
    status: status || undefined,
    reason: reason || undefined,
    page: 1,
    limit: 50,
  });

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  if (!can("orders.exchange.read")) {
    return (
      <div className="py-12 text-center">
        <h1 className="text-xl font-bold text-gray-900">Exchanges</h1>
        <p className="mt-2 text-sm text-gray-500">You don&apos;t have permission to view exchanges.</p>
      </div>
    );
  }

  const inp = "h-10 rounded-md border border-gray-300 px-3 text-sm";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Exchanges</h1>
        <p className="text-sm text-gray-500">
          Exchange/replacement only — no cash refund. Quality claims must pass QA before approval.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select className={inp} value={status} onChange={(e) => setParam("status", e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {EXCHANGE_STATUSES.map((s) => (
            <option key={s} value={s}>{humanize(s)}</option>
          ))}
        </select>
        <select className={inp} value={reason} onChange={(e) => setParam("reason", e.target.value)} aria-label="Filter by reason">
          <option value="">All reasons</option>
          {EXCHANGE_REASONS.map((r) => (
            <option key={r} value={r}>{humanize(r)}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">Couldn&apos;t load exchanges.</p>
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">
            Try again
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">No exchange requests match your filters.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-4 font-medium">Exchange</th>
              <th className="py-2 pr-4 font-medium">Order</th>
              <th className="py-2 pr-4 font-medium">Item</th>
              <th className="py-2 pr-4 font-medium">Reason</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium">QA due</th>
            </tr>
          </thead>
          <tbody>
            {data.map((x) => {
              const urgency = qaUrgency(x.qa_due_at);
              return (
                <tr key={x.exchange_id} className="border-b border-gray-100">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/exchanges/${x.exchange_id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">
                      {x.exchange_id}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <Link href={`/admin/orders/${x.order_no}`} className="font-mono text-xs text-gray-600 hover:underline">
                      {x.order_no}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-gray-700">
                    {x.order_item?.title ?? x.order_item?.sku_code ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-gray-700">{humanize(x.reason)}</td>
                  <td className="py-3 pr-4">
                    <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + (STATUS_STYLE[x.status] ?? "bg-gray-100 text-gray-500")}>
                      {humanize(x.status)}
                    </span>
                  </td>
                  <td className="py-3">
                    {x.qa_due_at ? (
                      <span
                        className={
                          urgency === "overdue"
                            ? "font-medium text-red-600"
                            : urgency === "soon"
                              ? "font-medium text-amber-600"
                              : "text-gray-400"
                        }
                      >
                        {formatDate(x.qa_due_at)}
                        {urgency === "overdue" ? " · overdue" : urgency === "soon" ? " · soon" : ""}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
