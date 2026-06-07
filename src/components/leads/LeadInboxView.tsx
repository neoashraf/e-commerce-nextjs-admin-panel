"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminLeads } from "@/lib/api/hooks/useLeadsAdmin";
import { formatDateTime } from "@/lib/format";

/**
 * Admin leads inbox (lead-inbox-fe). Reference/type/subject/submitter/status;
 * URL search + status/type filter. Rows link to the thread.
 */
const STATUS_STYLE: Record<string, string> = {
  new: "bg-blue-50 text-blue-700",
  open: "bg-green-50 text-green-700",
  awaiting_customer: "bg-amber-50 text-amber-700",
  resolved: "bg-gray-100 text-gray-500",
  closed: "bg-gray-100 text-gray-500",
};

export function LeadInboxView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "";
  const type = sp.get("type") ?? "";

  const { data, isLoading, isError, refetch } = useAdminLeads({ status: status || undefined, type: type || undefined, page: 1, limit: 50 });

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }
  const inp = "h-10 rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Leads</h1>
      <div className="flex flex-wrap items-center gap-3">
        <select className={inp} value={status} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">All statuses</option><option value="new">New</option><option value="open">Open</option><option value="awaiting_customer">Awaiting customer</option><option value="resolved">Resolved</option>
        </select>
        <select className={inp} value={type} onChange={(e) => setParam("type", e.target.value)}>
          <option value="">All types</option><option value="general">General</option><option value="order_issue">Order issue</option><option value="claim_return">Claim / return</option>
        </select>
      </div>

      {isLoading ? <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        : isError ? <div className="py-12 text-center"><p className="text-sm text-gray-600">Couldn&apos;t load leads.</p><button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button></div>
        : !data || data.length === 0 ? <p className="py-12 text-center text-sm text-gray-500">No leads match your filters.</p>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-4 font-medium">Reference</th><th className="py-2 pr-4 font-medium">Subject</th><th className="py-2 pr-4 font-medium">Submitter</th><th className="py-2 pr-4 font-medium">Status</th><th className="py-2 font-medium">Created</th>
            </tr></thead>
            <tbody>
              {data.map((l) => (
                <tr key={l.reference} className="border-b border-gray-100">
                  <td className="py-3 pr-4"><Link href={`/admin/leads/${l.reference}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">{l.reference}</Link></td>
                  <td className="py-3 pr-4 text-gray-900">{l.subject}<span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{l.type.replace(/_/g, " ")}</span></td>
                  <td className="py-3 pr-4 text-gray-600">{l.submitter?.name ?? l.submitter?.phone ?? "—"}</td>
                  <td className="py-3 pr-4"><span className={"rounded-full px-2 py-0.5 text-xs font-medium " + (STATUS_STYLE[l.status] ?? "bg-gray-100 text-gray-500")}>{l.status.replace(/_/g, " ")}</span></td>
                  <td className="py-3 text-gray-400">{formatDateTime(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}
