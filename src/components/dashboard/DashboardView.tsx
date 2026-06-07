"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { dashboardSchema, type Dashboard } from "@/lib/api/schemas/dashboard";
import { formatBDT } from "@/lib/format";

/**
 * Admin dashboard (dash-fe). Period selector + permission-filtered widgets:
 * KPI cards, operational alerts (linking to filtered lists), orders-by-status
 * and payment-split breakdowns, top products. Widgets the admin can't see are
 * simply omitted by the server (meta.visible_widgets).
 */
const PERIODS = [
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "today", label: "Today" },
];

export function DashboardView() {
  const [period, setPeriod] = useState("last_7d");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-dashboard", period] as const,
    queryFn: (): Promise<Dashboard> => api.get("/admin/dashboard", { schema: dashboardSchema, params: { period } }) as Promise<Dashboard>,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="h-10 rounded-md border border-gray-300 px-3 text-sm">
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100" />)}</div>
      ) : isError ? (
        <div className="py-12 text-center"><p className="text-sm text-gray-600">Couldn&apos;t load the dashboard.</p><button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button></div>
      ) : (
        <>
          {data?.kpis && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Object.entries(data.kpis).map(([key, k]) => (
                <div key={key} className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400">{key.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{k.currency ? formatBDT(Number(k.value)) : k.value}</p>
                  {k.delta_pct != null && (
                    <p className={"mt-0.5 text-xs " + (k.direction === "down" ? "text-red-600" : "text-green-600")}>
                      {k.direction === "down" ? "▼" : "▲"} {Math.abs(k.delta_pct)}%
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {data?.alerts && (
            <section>
              <h2 className="mb-2 text-base font-semibold text-gray-900">Needs attention</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Alert label="Pending payment" value={data.alerts.orders_pending_payment} href="/admin/orders?status=pending_payment" />
                <Alert label="To process" value={data.alerts.orders_to_process} href="/admin/orders?status=confirmed" />
                <Alert label="To ship" value={data.alerts.orders_to_ship} href="/admin/orders?status=processing" />
                <Alert label="Low stock" value={data.alerts.low_stock_skus} href="/admin/inventory?status=low_stock" />
                <Alert label="Out of stock" value={data.alerts.out_of_stock_skus} href="/admin/inventory?status=out_of_stock" />
                <Alert label="New leads" value={data.alerts.new_leads} href="/admin/leads?status=new" />
              </div>
            </section>
          )}

          {data?.breakdowns?.top_products && data.breakdowns.top_products.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-semibold text-gray-900">Top products</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                {data.breakdowns.top_products.map((p) => (
                  <li key={p.product_id} className="flex items-center justify-between p-3 text-sm">
                    <span className="truncate text-gray-800">{p.title}</span>
                    <span className="shrink-0 text-gray-500">{p.units} units · {formatBDT(Number(p.sales))}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data?.as_of && <p className="text-xs text-gray-400">As of {new Date(data.as_of).toLocaleString()}</p>}
        </>
      )}
    </div>
  );
}

function Alert({ label, value, href }: { label: string; value?: number; href: string }) {
  if (value == null) return null;
  return (
    <Link href={href} className="rounded-lg border border-gray-200 bg-white p-3 hover:border-gray-400">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </Link>
  );
}
