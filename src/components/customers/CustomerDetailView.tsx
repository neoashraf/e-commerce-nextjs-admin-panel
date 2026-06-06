"use client";

import Link from "next/link";
import { useState } from "react";
import { useCustomer, useAddNote, useCustomerStatus } from "@/lib/api/hooks/useCustomers";
import { Can } from "@/lib/permissions/Can";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/stores/toast";

/**
 * Customer 360 (cust-fe). Read-only profile + recent orders + admin notes
 * (add) + suspend/reactivate (delegated to AUTH). LTV from total_spent.
 */
export function CustomerDetailView({ id }: { id: string }) {
  const { data, isLoading, isError } = useCustomer(id);
  const addNote = useAddNote(id);
  const statusM = useCustomerStatus(id);
  const [note, setNote] = useState("");

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
  if (isError || !data) {
    return <div className="py-12 text-center"><p className="text-sm text-gray-600">We couldn&apos;t find that customer.</p><Link href="/admin/customers" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">Back to customers</Link></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/admin/customers" className="text-sm text-brand-700 hover:underline">← Customers</Link>
          <h1 className="mt-1 text-xl font-bold text-gray-900">{data.name ?? data.phone ?? "Customer"}</h1>
          <p className="text-sm text-gray-500">{data.phone}{data.email ? ` · ${data.email}` : ""}</p>
        </div>
        <Can permission="customers.customer.suspend">
          {data.status === "active"
            ? <button type="button" onClick={() => statusM.suspend.mutate(undefined, { onSuccess: () => toast("Customer suspended.") })} className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-amber-700 hover:bg-gray-50">Suspend</button>
            : <button type="button" onClick={() => statusM.reactivate.mutate(undefined, { onSuccess: () => toast("Customer reactivated.") })} className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-green-700 hover:bg-gray-50">Reactivate</button>}
        </Can>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Orders" value={String(data.order_count ?? 0)} />
        <Stat label="Lifetime value" value={data.total_spent ? formatBDT(Number(data.total_spent)) : "৳ 0"} />
        <Stat label="Last order" value={data.last_order_at ? formatDate(data.last_order_at) : "—"} />
      </div>

      {data.recent_orders.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">Recent orders</h2>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {data.recent_orders.map((o) => (
              <li key={o.order_no} className="flex items-center justify-between p-3 text-sm">
                <Link href={`/admin/orders/${o.order_no}`} className="font-medium text-brand-700 hover:underline">{o.order_no}</Link>
                <span className="text-gray-500">{o.status} · {o.grand_total ? formatBDT(Number(o.grand_total)) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-base font-semibold text-gray-900">Notes</h2>
        <Can permission="customers.customer.note">
          <div className="mb-3 flex gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" className="h-10 flex-1 rounded-md border border-gray-300 px-3 text-sm" />
            <button type="button" disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate(note.trim(), { onSuccess: () => { setNote(""); toast("Note added."); } })} className="h-10 rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Add</button>
          </div>
        </Can>
        {data.notes.length === 0 ? <p className="text-sm text-gray-400">No notes yet.</p> : (
          <ul className="space-y-2">
            {data.notes.map((n, i) => (
              <li key={n.id ?? i} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <p className="text-gray-700">{n.body}</p>
                {n.created_at && <p className="mt-1 text-xs text-gray-400">{formatDateTime(n.created_at)}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-gray-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-gray-400">{label}</p><p className="mt-1 text-lg font-bold text-gray-900">{value}</p></div>;
}
