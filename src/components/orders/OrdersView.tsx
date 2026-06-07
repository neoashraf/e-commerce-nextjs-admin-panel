"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminOrders } from "@/lib/api/hooks/useOrdersAdmin";
import { formatBDT, formatDateTime } from "@/lib/format";

/**
 * Admin orders list (ord-admin-fe). order_no/customer/status/payment/total +
 * filters (status, payment_state, search) URL-reflected. Rows → detail.
 */
const STATUS_STYLE: Record<string, string> = {
  pending_payment: "bg-blue-50 text-blue-700", confirmed: "bg-blue-50 text-blue-700",
  processing: "bg-amber-50 text-amber-700", shipped: "bg-indigo-50 text-indigo-700",
  delivered: "bg-green-50 text-green-700", cancelled: "bg-gray-100 text-gray-500", refunded: "bg-gray-100 text-gray-500",
};

export function OrdersView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "";
  const paymentState = sp.get("payment_state") ?? "";
  const q = sp.get("q") ?? "";

  const { data, isLoading, isError, refetch } = useAdminOrders({ status: status || undefined, payment_state: paymentState || undefined, q: q || undefined, page: 1, limit: 50 });

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }
  const inp = "h-10 rounded-md border border-gray-300 px-3 text-sm";

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Orders</h1>
      <div className="flex flex-wrap items-center gap-3">
        <input className={inp + " w-56"} placeholder="Search order no…" defaultValue={q} onKeyDown={(e) => e.key === "Enter" && setParam("q", (e.target as HTMLInputElement).value)} />
        <select className={inp} value={status} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">All statuses</option>{["pending_payment", "confirmed", "processing", "shipped", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <select className={inp} value={paymentState} onChange={(e) => setParam("payment_state", e.target.value)}>
          <option value="">All payments</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="cod_pending">COD pending</option>
        </select>
      </div>

      {isLoading ? <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        : isError ? <div className="py-12 text-center"><p className="text-sm text-gray-600">Couldn&apos;t load orders.</p><button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button></div>
        : !data || data.length === 0 ? <p className="py-12 text-center text-sm text-gray-500">No orders match your filters.</p>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400"><th className="py-2 pr-4 font-medium">Order</th><th className="py-2 pr-4 font-medium">Customer</th><th className="py-2 pr-4 font-medium">Total</th><th className="py-2 pr-4 font-medium">Payment</th><th className="py-2 pr-4 font-medium">Status</th><th className="py-2 font-medium">Placed</th></tr></thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.order_no} className="border-b border-gray-100">
                  <td className="py-3 pr-4"><Link href={`/admin/orders/${o.order_no}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">{o.order_no}</Link></td>
                  <td className="py-3 pr-4 text-gray-700">{o.customer?.name ?? o.customer?.phone ?? "—"}</td>
                  <td className="py-3 pr-4 text-gray-900">{o.grand_total ? formatBDT(Number(o.grand_total)) : "—"}</td>
                  <td className="py-3 pr-4 text-gray-500">{o.payment_method?.toUpperCase()} · {o.payment_state}</td>
                  <td className="py-3 pr-4"><span className={"rounded-full px-2 py-0.5 text-xs font-medium " + (STATUS_STYLE[o.status] ?? "bg-gray-100 text-gray-500")}>{o.status.replace(/_/g, " ")}</span></td>
                  <td className="py-3 text-gray-400">{o.placed_at ? formatDateTime(o.placed_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}
