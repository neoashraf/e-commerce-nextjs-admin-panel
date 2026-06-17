"use client";

import { Banknote, Receipt, ShoppingCart, Wallet } from "lucide-react";
import { useSalesReport } from "@/lib/api/hooks/reports";
import { formatBDT } from "@/lib/format";
import {
  BarBreakdownChart,
  CHART_COLORS,
  TrendChart,
  type TrendPoint,
} from "@/components/charts";
import { ChartCard, StatCard, type LegendItem } from "@/components/ui";
import type { ReportMeta } from "./catalog";
import { useReportParams } from "./ReportControls";
import {
  AsOf,
  Column,
  DataTable,
  ReportState,
  Section,
  TotalsRow,
} from "./primitives";

/**
 * Sales report (FR-RPT-010/011), re-skinned to the design system. StatCard
 * totals, a revenue/orders trend ChartCard (restrained palette + "Show data"
 * table), the selected breakdown as a bar ChartCard, and a by-period table with
 * a totals row. The tables are the accessible equivalents of the charts.
 * Presentation only — the hook + params are unchanged.
 */
export function SalesReport({ meta }: { meta: ReportMeta }) {
  const { apiParams, breakdown } = useReportParams(meta);
  const { data, isLoading, isError, refetch } = useSalesReport(apiParams);

  const series = data?.series ?? [];
  const trend: TrendPoint[] = series.map((s) => ({
    bucket: s.bucket,
    revenue: Number(s.net_revenue),
    orders: s.orders,
  }));

  const breakdownRows =
    breakdown !== "none" && data?.breakdown?.[breakdown]
      ? Object.entries(data.breakdown[breakdown]).map(([name, v]) => ({
          name,
          value: Number(v),
        }))
      : [];

  const seriesCols: Column<(typeof series)[number]>[] = [
    { header: "Period", cell: (s) => s.bucket },
    { header: "Revenue", align: "right", cell: (s) => formatBDT(Number(s.net_revenue)) },
    { header: "Orders", align: "right", cell: (s) => s.orders },
  ];

  const totalRevenue = series.reduce((sum, s) => sum + Number(s.net_revenue), 0);
  const totalOrders = series.reduce((sum, s) => sum + s.orders, 0);

  const trendLegend: LegendItem[] = [
    { label: "Revenue", color: CHART_COLORS[0] },
    { label: "Orders", color: CHART_COLORS[1] },
  ];

  return (
    <ReportState
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && series.length === 0 && !data?.totals}
      onRetry={refetch}
    >
      <div className="space-y-6">
        <p className="text-xs text-text-muted">
          Revenue is net of refunds; gross placed value is shown separately.
        </p>

        {data?.totals && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Net revenue"
              value={formatBDT(Number(data.totals.net_revenue))}
              icon={Banknote}
            />
            {data.totals.gross_placed_value != null && (
              <StatCard
                label="Gross placed"
                value={formatBDT(Number(data.totals.gross_placed_value))}
                icon={Wallet}
                iconTone="info"
              />
            )}
            <StatCard
              label="Orders"
              value={String(data.totals.orders)}
              icon={ShoppingCart}
            />
            {data.totals.aov != null && (
              <StatCard
                label="Avg order value"
                value={formatBDT(Number(data.totals.aov))}
                icon={Receipt}
              />
            )}
          </div>
        )}

        {trend.length > 0 && (
          <ChartCard
            title="Over time"
            legend={trendLegend}
            dataTable={
              <DataTable
                caption="Sales over time"
                columns={seriesCols}
                rows={series}
                rowKey={(s) => s.bucket}
                totalRow={
                  <TotalsRow
                    cells={[
                      { content: "Total" },
                      { content: formatBDT(totalRevenue), align: "right" },
                      { content: totalOrders, align: "right" },
                    ]}
                  />
                }
              />
            }
          >
            <TrendChart data={trend} />
          </ChartCard>
        )}

        {breakdownRows.length > 0 && (
          <ChartCard
            title={`By ${breakdown.replace(/_/g, " ")}`}
            dataTable={
              <DataTable
                caption={`Sales by ${breakdown}`}
                columns={[
                  { header: "Segment", cell: (r) => <span className="capitalize">{r.name}</span> },
                  { header: "Revenue", align: "right", cell: (r) => formatBDT(r.value) },
                ]}
                rows={breakdownRows}
                rowKey={(r) => r.name}
              />
            }
          >
            <BarBreakdownChart data={breakdownRows} valueLabel="Revenue" currency />
          </ChartCard>
        )}

        {series.length > 0 && (
          <Section title="By period">
            <DataTable
              caption="Sales by period"
              columns={seriesCols}
              rows={series}
              rowKey={(s) => s.bucket}
              totalRow={
                <TotalsRow
                  cells={[
                    { content: "Total" },
                    { content: formatBDT(totalRevenue), align: "right" },
                    { content: totalOrders, align: "right" },
                  ]}
                />
              }
            />
          </Section>
        )}

        <AsOf value={data?.as_of} />
      </div>
    </ReportState>
  );
}
