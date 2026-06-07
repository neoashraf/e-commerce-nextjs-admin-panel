"use client";

import { z } from "zod";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { formatBDT } from "@/lib/format";

/**
 * Reports — sales (rpt-fe). Date range + bucket + breakdown; totals cards +
 * series table + breakdown table. Read-only. (Orders/products/inventory reports
 * follow the same shape — sales is the primary view here.)
 */
const salesSchema = z.object({
  totals: z.object({ net_revenue: z.string(), orders: z.number(), units: z.number().optional(), aov: z.string().optional() }).optional(),
  series: z.array(z.object({ bucket: z.string(), net_revenue: z.string(), orders: z.number(), aov: z.string().optional() })).default([]),
  breakdown: z.record(z.record(z.string())).optional(),
  as_of: z.string().optional(),
});
type Sales = z.infer<typeof salesSchema>;

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function ReportsView() {
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [bucket, setBucket] = useState("day");
  const [breakdown, setBreakdown] = useState("payment_method");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-sales", from, to, bucket, breakdown] as const,
    queryFn: (): Promise<Sales> => api.get("/admin/reports/sales", { schema: salesSchema, params: { from, to, bucket, breakdown } }) as Promise<Sales>,
    staleTime: 60_000,
  });

  const inp = "h-10 rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Sales report</h1>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-gray-600">From <input type="date" className={inp + " ml-1"} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm text-gray-600">To <input type="date" className={inp + " ml-1"} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <select className={inp} value={bucket} onChange={(e) => setBucket(e.target.value)}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select>
        <select className={inp} value={breakdown} onChange={(e) => setBreakdown(e.target.value)}><option value="none">No breakdown</option><option value="payment_method">By payment</option><option value="category">By category</option><option value="delivery_zone">By zone</option></select>
      </div>

      {isLoading ? <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        : isError ? <div className="py-12 text-center"><p className="text-sm text-gray-600">Couldn&apos;t load the report.</p><button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button></div>
        : (
          <>
            {data?.totals && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Net revenue" value={formatBDT(Number(data.totals.net_revenue))} />
                <Stat label="Orders" value={String(data.totals.orders)} />
                {data.totals.units != null && <Stat label="Units" value={String(data.totals.units)} />}
                {data.totals.aov && <Stat label="Avg order value" value={formatBDT(Number(data.totals.aov))} />}
              </div>
            )}

            {data?.series && data.series.length > 0 && (
              <section>
                <h2 className="mb-2 text-base font-semibold text-gray-900">Over time</h2>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400"><th className="py-2 pr-4 font-medium">Period</th><th className="py-2 pr-4 text-right font-medium">Revenue</th><th className="py-2 text-right font-medium">Orders</th></tr></thead>
                  <tbody>{data.series.map((s) => <tr key={s.bucket} className="border-b border-gray-100"><td className="py-2 pr-4 text-gray-600">{s.bucket}</td><td className="py-2 pr-4 text-right text-gray-900">{formatBDT(Number(s.net_revenue))}</td><td className="py-2 text-right text-gray-700">{s.orders}</td></tr>)}</tbody>
                </table>
              </section>
            )}

            {data?.breakdown && Object.entries(data.breakdown).map(([dim, rows]) => (
              <section key={dim}>
                <h2 className="mb-2 text-base font-semibold capitalize text-gray-900">{dim.replace(/_/g, " ")}</h2>
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                  {Object.entries(rows).map(([k, v]) => <li key={k} className="flex items-center justify-between p-3 text-sm"><span className="capitalize text-gray-700">{k}</span><span className="font-medium text-gray-900">{formatBDT(Number(v))}</span></li>)}
                </ul>
              </section>
            ))}
            {data?.as_of && <p className="text-xs text-gray-400">As of {new Date(data.as_of).toLocaleString()}</p>}
          </>
        )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-gray-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-gray-400">{label}</p><p className="mt-1 text-xl font-bold text-gray-900">{value}</p></div>;
}
