"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Banknote,
  Receipt,
  ShoppingCart,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import {
  BarBreakdownChart,
  CHART_COLORS,
  DonutChart,
  STATUS_COLORS,
  TrendChart,
  type TrendPoint as ChartTrendPoint,
} from "@/components/charts";
import {
  Card,
  CardHeader,
  ChartCard,
  EmptyState,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  type LegendItem,
} from "@/components/ui";
import type { Dashboard } from "@/lib/api/schemas/dashboard";
import { formatBDT } from "@/lib/format";

/**
 * Dashboard widgets (FR-DASH-001..022), re-skinned to the design system using
 * the AD0 primitives. Each renders from the already-fetched summary; charts are
 * paired with an accessible data table. KPI deltas use the DeltaChip (arrow +
 * sign + color, never color alone). No data/logic change.
 */

// ── KPI cards (FR-DASH-001..003) ─────────────────────────────────────────────

const KPI_META: Record<string, { label: string; icon: LucideIcon }> = {
  sales: { label: "Net revenue", icon: Banknote },
  orders: { label: "Orders", icon: ShoppingCart },
  avg_order_value: { label: "Avg. order value", icon: Receipt },
  new_customers: { label: "New customers", icon: UserPlus },
};

export function KpiCards({ kpis }: { kpis: NonNullable<Dashboard["kpis"]> }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Object.entries(kpis).map(([key, k]) => {
        const meta = KPI_META[key];
        const label = meta?.label ?? key.replace(/_/g, " ");
        const value = k.currency ? formatBDT(Number(k.value)) : String(k.value);
        // direction carries the sign the BE computed; flat/no-basis → "—".
        const delta =
          k.delta_pct != null && (k.direction === "up" || k.direction === "down")
            ? k.direction === "down"
              ? -Math.abs(k.delta_pct)
              : Math.abs(k.delta_pct)
            : null;
        return (
          <StatCard
            key={key}
            label={label}
            value={value}
            icon={meta?.icon}
            delta={delta}
          />
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
      <h2 className="text-[18px] font-semibold text-text">Needs attention</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ALERTS.filter((a) => alerts[a.key] != null).map((a) => {
          const count = alerts[a.key];
          const calm = count === 0;
          return (
            <Link
              key={a.key}
              href={a.href}
              className="rounded-lg border border-border bg-surface p-4 shadow-sm transition-shadow hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={
                    "h-1.5 w-1.5 rounded-full " +
                    (calm ? "bg-text-faint" : "bg-warning")
                  }
                  aria-hidden="true"
                />
                <p className="text-2xl font-bold tabular-nums text-text">{count}</p>
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
                {a.label}
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ── Trend panel (FR-DASH-022) ────────────────────────────────────────────────

export function TrendPanel({ trend }: { trend: NonNullable<NonNullable<Dashboard["breakdowns"]>["trend"]> }) {
  const legend: LegendItem[] = [
    { label: "Revenue", color: CHART_COLORS[0] },
    { label: "Orders", color: CHART_COLORS[1] },
  ];
  if (trend.length === 0) {
    return <ChartCard title="Sales & orders trend" state="empty" legend={legend} />;
  }
  const data: ChartTrendPoint[] = trend.map((p) => ({
    bucket: p.date,
    revenue: Number(p.sales),
    orders: p.orders,
  }));
  return (
    <ChartCard
      title="Sales & orders trend"
      legend={legend}
      dataTable={
        <Table>
          <caption className="sr-only">Sales and orders over time</caption>
          <THead>
            <TR hover={false}>
              <TH>Date</TH>
              <TH numeric>Sales</TH>
              <TH numeric>Orders</TH>
            </TR>
          </THead>
          <TBody>
            {trend.map((p) => (
              <TR key={p.date}>
                <TD>{p.date}</TD>
                <TD numeric className="text-text">{formatBDT(Number(p.sales))}</TD>
                <TD numeric>{p.orders}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      }
    >
      <TrendChart data={data} />
    </ChartCard>
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
        <ChartCard
          title="Orders by status"
          legend={statusData.map((d) => ({
            label: d.name.replace(/_/g, " "),
            color: STATUS_COLORS[d.name.toLowerCase()] ?? "#64748B",
            value: String(d.value),
          }))}
          dataTable={
            <NameValueTable caption="Orders by status" rows={statusData} valueHeader="Orders" capitalize />
          }
        >
          <DonutChart data={statusData} centerLabel="Orders" colorByStatus />
        </ChartCard>
      )}
      {paymentData.length > 0 && (
        <ChartCard
          title="Payment split"
          legend={paymentData.map((d, i) => ({
            label: d.name,
            color: CHART_COLORS[i % CHART_COLORS.length],
            value: String(d.value),
          }))}
          dataTable={
            <NameValueTable caption="Payment split" rows={paymentData} valueHeader="Orders" />
          }
        >
          <DonutChart data={paymentData} centerLabel="Orders" />
        </ChartCard>
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
    <ChartCard
      title="Top products"
      dataTable={
        <Table>
          <caption className="sr-only">Top products by units sold</caption>
          <THead>
            <TR hover={false}>
              <TH>Product</TH>
              <TH numeric>Units</TH>
              <TH numeric>Sales</TH>
            </TR>
          </THead>
          <TBody>
            {products.map((p) => (
              <TR key={p.product_id}>
                <TD className="font-medium text-text">{p.title}</TD>
                <TD numeric>{p.units}</TD>
                <TD numeric className="text-text">{formatBDT(Number(p.sales))}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      }
    >
      <BarBreakdownChart data={chartData} valueLabel="Units" />
    </ChartCard>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────

/** Section wrapper (title + body) reused by RecentActivity list cards. */
export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} divider />
      <div className="p-3">{children}</div>
    </Card>
  );
}

export function Empty() {
  return <EmptyState title="No data for this period yet." />;
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
    <Table>
      <caption className="sr-only">{caption}</caption>
      <THead>
        <TR hover={false}>
          <TH>Segment</TH>
          <TH numeric>{valueHeader}</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((r) => (
          <TR key={r.name}>
            <TD className={capitalize ? "capitalize" : ""}>
              {capitalize ? r.name.replace(/_/g, " ") : r.name}
            </TD>
            <TD numeric className="text-text">{r.value}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
