"use client";

import { useSalesReport } from "@/lib/api/hooks/reports";
import { formatBDT } from "@/lib/format";
import { BarBreakdownChart, TrendChart, type TrendPoint } from "@/components/charts";
import type { ReportMeta } from "./catalog";
import { useReportParams } from "./ReportControls";
import { AsOf, Column, DataTable, ReportState, Section, Stat } from "./primitives";

/**
 * Sales report (FR-RPT-010/011) — totals, a revenue/orders trend chart over the
 * period, and the selected breakdown (payment/category/zone) as a bar chart +
 * table. The tables are the accessible equivalents of the charts.
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

  return (
    <ReportState
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && series.length === 0 && !data?.totals}
      onRetry={refetch}
    >
      <div className="space-y-6">
        <p className="text-xs text-gray-500">
          Revenue is net of refunds; gross placed value is shown separately.
        </p>

        {data?.totals && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Net revenue" value={formatBDT(Number(data.totals.net_revenue))} />
            {data.totals.gross_placed_value != null && (
              <Stat label="Gross placed" value={formatBDT(Number(data.totals.gross_placed_value))} />
            )}
            <Stat label="Orders" value={String(data.totals.orders)} />
            {data.totals.aov != null && (
              <Stat label="Avg order value" value={formatBDT(Number(data.totals.aov))} />
            )}
          </div>
        )}

        {trend.length > 0 && (
          <Section title="Over time">
            <TrendChart data={trend} />
            <DataTable
              caption="Sales over time"
              columns={seriesCols}
              rows={series}
              rowKey={(s) => s.bucket}
            />
          </Section>
        )}

        {breakdownRows.length > 0 && (
          <Section title={`By ${breakdown.replace(/_/g, " ")}`}>
            <BarBreakdownChart data={breakdownRows} valueLabel="Revenue" currency />
            <DataTable
              caption={`Sales by ${breakdown}`}
              columns={[
                { header: "Segment", cell: (r) => <span className="capitalize">{r.name}</span> },
                { header: "Revenue", align: "right", cell: (r) => formatBDT(r.value) },
              ]}
              rows={breakdownRows}
              rowKey={(r) => r.name}
            />
          </Section>
        )}

        <AsOf value={data?.as_of} />
      </div>
    </ReportState>
  );
}
