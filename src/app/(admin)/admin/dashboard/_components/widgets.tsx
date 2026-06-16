"use client";

import Link from "next/link";
import {
  BarBreakdownChart,
  DonutChart,
  TrendChart,
  type TrendPoint as ChartTrendPoint,
} from "@/components/charts";
import type { Dashboard } from "@/lib/api/schemas/dashboard";
import { formatBDT } from "@/lib/format";

/**
 * Dashboard widgets (FR-DASH-001..022). Each renders from the already-fetched
 * summary; charts are paired with an accessible data table. KPI deltas use a
 * text arrow + sign (not color alone) per the a11y rule.
 */

// ── KPI cards (FR-DASH-001..003) ─────────────────────────────────────────────

const KPI_LABELS: Record<string, string> = {
  sales: "Sales",
  orders: "Orders",
  avg_order_value: "Avg. order value",
  new_customers: "New customers",
};

export function KpiCards({ kpis }: { kpis: NonNullable<Dashboard["kpis"]> }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Object.entries(kpis).map(([key, k]) => {
        const label = KPI_LABELS[key] ?? key.replace(/_/g, " ");
        const value = k.currency ? formatBDT(Number(k.value)) : String(k.value);
        const hasDelta = k.delta_pct != null && k.direction != null;
        const down = k.direction === "down";
        return (
          <div key={key} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
            {hasDelta ? (
              <p className={"mt-0.5 text-xs " + (down ? "text-red-600" : "text-green-600")}>
                {down ? "▼" : "▲"} {k.delta_pct! > 0 ? "+" : ""}
                {k.delta_pct}% vs prior
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-gray-400">— vs prior</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Alerts strip (FR-DASH-010..012) ──────────────────────────────────────────

const ALERTS: { key: string; label: string; href: string }[] = [
  { key: "orders_pending_payment", label: "Pending payment", href: "/admin/orders?status=pending_payment" },
  { key: "orders_to_process", label: "To process", href: "/admin/orders?status=confirmed" },
  { key: "orders_to_ship", label: "To ship", href: "/admin/orders?status=processing" },
  { key: "low_stock_skus", label: "Low stock", href: "/admin/inventory?status=low_stock" },
  { key: "out_of_stock_skus", label: "Out of stock", href: "/admin/inventory?status=out_of_stock" },
  { key: "new_leads", label: "New leads", href: "/admin/leads?status=new" },
];

export function AlertsStrip({ alerts }: { alerts: Record<string, number> }) {
  return (
    <section aria-label="Needs attention" className="space-y-2">
      <h2 className="text-base font-semibold text-gray-900">Needs attention</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ALERTS.filter((a) => alerts[a.key] != null).map((a) => (
          <Link
            key={a.key}
            href={a.href}
            className="rounded-lg border border-gray-200 bg-white p-3 hover:border-gray-400"
          >
            <p className="text-2xl font-bold text-gray-900">{alerts[a.key]}</p>
            <p className="text-xs text-gray-500">{a.label}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Trend panel (FR-DASH-022) ────────────────────────────────────────────────

export function TrendPanel({ trend }: { trend: NonNullable<NonNullable<Dashboard["breakdowns"]>["trend"]> }) {
  if (trend.length === 0) {
    return (
      <Panel title="Sales & orders trend">
        <Empty />
      </Panel>
    );
  }
  const data: ChartTrendPoint[] = trend.map((p) => ({
    bucket: p.date,
    revenue: Number(p.sales),
    orders: p.orders,
  }));
  return (
    <Panel title="Sales & orders trend">
      <TrendChart data={data} />
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <caption className="sr-only">Sales and orders over time</caption>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th scope="col" className="px-3 py-2 font-medium">Date</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Sales</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Orders</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((p) => (
              <tr key={p.date} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-2 text-gray-700">{p.date}</td>
                <td className="px-3 py-2 text-right text-gray-900">{formatBDT(Number(p.sales))}</td>
                <td className="px-3 py-2 text-right text-gray-700">{p.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── Breakdown panels: orders-by-status + payment split (FR-DASH-022) ──────────

export function BreakdownPanels({
  ordersByStatus,
  paymentSplit,
}: {
  ordersByStatus?: Record<string, number>;
  paymentSplit?: Record<string, number>;
}) {
  const toData = (m?: Record<string, number>) =>
    Object.entries(m ?? {}).map(([name, value]) => ({ name, value }));
  const statusData = toData(ordersByStatus);
  const paymentData = toData(paymentSplit);

  if (statusData.length === 0 && paymentData.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {statusData.length > 0 && (
        <Panel title="Orders by status">
          <DonutChart data={statusData} />
          <NameValueTable caption="Orders by status" rows={statusData} valueHeader="Orders" capitalize />
        </Panel>
      )}
      {paymentData.length > 0 && (
        <Panel title="Payment split">
          <DonutChart data={paymentData} />
          <NameValueTable caption="Payment split" rows={paymentData} valueHeader="Orders" />
        </Panel>
      )}
    </div>
  );
}

// ── Top products (FR-DASH-022) ───────────────────────────────────────────────

export function TopProducts({
  products,
}: {
  products: NonNullable<NonNullable<Dashboard["breakdowns"]>["top_products"]>;
}) {
  if (products.length === 0) return null;
  const chartData = products
    .slice(0, 10)
    .map((p) => ({ name: p.title, value: p.units }));
  return (
    <Panel title="Top products">
      <BarBreakdownChart data={chartData} valueLabel="Units" />
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {products.map((p) => (
          <li key={p.product_id} className="flex items-center justify-between p-3 text-sm">
            <span className="truncate text-gray-800">{p.title}</span>
            <span className="shrink-0 text-gray-500">
              {p.units} units · {formatBDT(Number(p.sales))}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

export function Empty() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 py-10 text-center">
      <p className="text-sm text-gray-500">No data for this period yet.</p>
    </div>
  );
}

function NameValueTable({
  caption,
  rows,
  valueHeader,
  capitalize,
}: {
  caption: string;
  rows: { name: string; value: number }[];
  valueHeader: string;
  capitalize?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <th scope="col" className="px-3 py-2 font-medium">Segment</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-gray-100 last:border-0">
              <td className={"px-3 py-2 text-gray-700 " + (capitalize ? "capitalize" : "")}>
                {capitalize ? r.name.replace(/_/g, " ") : r.name}
              </td>
              <td className="px-3 py-2 text-right text-gray-900">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
