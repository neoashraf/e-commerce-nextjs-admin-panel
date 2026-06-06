"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCustomers } from "@/lib/api/hooks/useCustomers";
import { formatBDT, formatDate } from "@/lib/format";

/**
 * Customers list (cust-fe). Name/phone/email, status, tags, order count, total
 * spent, last order; URL search + status filter + include-guests. Rows link to
 * the 360 profile.
 */
export function CustomersView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "";
  const q = sp.get("q") ?? "";
  const includeGuests = sp.get("include_guests") === "1";

  const { data, isLoading, isError, refetch } = useCustomers({ q: q || undefined, status: status || undefined, include_guests: includeGuests || undefined, page: 1, limit: 50 });

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }
  const inp = "h-10 rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Customers</h1>
      <div className="flex flex-wrap items-center gap-3">
        <input className={inp + " w-64"} placeholder="Search name, phone, email…" defaultValue={q} onKeyDown={(e) => e.key === "Enter" && setParam("q", (e.target as HTMLInputElement).value)} />
        <select className={inp} value={status} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={includeGuests} onChange={(e) => setParam("include_guests", e.target.checked ? "1" : "")} className="h-4 w-4" /> Include guests</label>
      </div>

      {isLoading ? <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        : isError ? <div className="py-12 text-center"><p className="text-sm text-gray-600">Couldn&apos;t load customers.</p><button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button></div>
        : !data || data.length === 0 ? <p className="py-12 text-center text-sm text-gray-500">No customers match your filters.</p>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-4 font-medium">Customer</th><th className="py-2 pr-4 font-medium">Orders</th><th className="py-2 pr-4 font-medium">Spent</th><th className="py-2 pr-4 font-medium">Last order</th><th className="py-2 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/customers/${c.id}`} className="block font-medium text-gray-900 hover:text-brand-700">{c.name ?? c.phone ?? c.email ?? "Guest"}{c.is_guest && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">Guest</span>}</Link>
                    <span className="block text-xs text-gray-400">{c.phone ?? ""}{c.email ? ` · ${c.email}` : ""}</span>
                    {c.tags.length > 0 && <span className="mt-0.5 flex gap-1">{c.tags.map((t) => <span key={t} className="rounded bg-brand-50 px-1.5 text-xs text-brand-700">{t}</span>)}</span>}
                  </td>
                  <td className="py-3 pr-4 text-gray-700">{c.order_count ?? 0}</td>
                  <td className="py-3 pr-4 text-gray-700">{c.total_spent ? formatBDT(Number(c.total_spent)) : "—"}</td>
                  <td className="py-3 pr-4 text-gray-400">{c.last_order_at ? formatDate(c.last_order_at) : "—"}</td>
                  <td className="py-3"><span className={"rounded-full px-2 py-0.5 text-xs font-medium " + (c.status === "active" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}
