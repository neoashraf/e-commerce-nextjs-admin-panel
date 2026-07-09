"use client";

import { Banknote, Layers, Receipt, ShoppingCart } from "lucide-react";
import { useSalesReport } from "@/lib/api/hooks/reports";
import { formatBDT } from "@/lib/format";
import {
  BarBreakdownChart,
  CHART_COLORS,
  TrendChart,
  type TrendPoint,
} from "@/components/charts";
import {
  Card,
  CardFooter,
  CardHeader,
  ChartCard,
  StatCard,
  Table,
  TableTotalsRow,
  TBody,
  TD,
  TH,
  THead,
  TR,
  type LegendItem,
} from "@/components/ui";
import type { ReportMeta } from "./catalog";
import { usePublishAsOf } from "./ReportAsOfContext";
import { useReportParams } from "./ReportControls";
import { Column, DataTable, ReportState, TotalsRow } from "./primitives";

/** Bucket → adverb used in the chart subtitle (design C4). */
const BUCKET_WORD: Record<string, string> = {
  day: "daily",
  week: "weekly",
  month: "monthly",
};

/**
 * Sales report (FR-RPT-010/011), re-skinned to the `Reports - Sales (RPT)`
 * design. StatCard totals carry period-over-period delta chips (BE-optional, so
 * they degrade to no chip), a revenue/orders trend ChartCard with a caption +
 * "Show data" table, the selected breakdown as a bar ChartCard, and a "By
 * period" card whose header shows the row count and whose footer echoes
 * "Showing N of N" (design C5). The tables are the accessible equivalents of the
 * charts. The hook + URL params are unchanged.
 */
export function SalesReport({ meta }: { meta: ReportMeta }) {
  const { apiParams, breakdown, bucket } = useReportParams(meta);
  const { data, isLoading, isError, refetch } = useSalesReport(apiParams);

  // The "as of" stamp lives in the filter row per the design (C2 controls row).
  usePublishAsOf(data?.as_of);

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

  // Chart captions (design C4). The trend card always plots net revenue +
  // orders; the breakdown (when active) is its own bar card below, so each
  // card's caption describes what that card actually shows.
  const bucketWord = BUCKET_WORD[bucket] ?? "daily";
  const breakdownLabel = meta.breakdowns?.find((b) => b.value === breakdown)?.label;
  const trendSubtitle = `Net revenue (৳) and orders · ${bucketWord}`;

  return (
    <ReportState
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && series.length === 0 && !data?.totals}
      onRetry={refetch}
    >
      <div className="space-y-6">
        {data?.totals && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Net revenue"
              value={formatBDT(Number(data.totals.net_revenue))}
              icon={Banknote}
              delta={data.totals.net_revenue_delta_pct}
            />
            {data.totals.gross_placed_value != null && (
              <StatCard
                label="Gross placed"
                value={formatBDT(Number(data.totals.gross_placed_value))}
                icon={Layers}
                iconTone="info"
              />
            )}
            <StatCard
              label="Orders"
              value={String(data.totals.orders)}
              icon={ShoppingCart}
              delta={data.totals.orders_delta_pct}
            />
            {data.totals.aov != null && (
              <StatCard
                label="Avg order value"
                value={formatBDT(Number(data.totals.aov))}
                icon={Receipt}
                delta={data.totals.aov_delta_pct}
              />
            )}
          </div>
        )}

        {trend.length > 0 && (
          <ChartCard
            title="Over time"
            subtitle={trendSubtitle}
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
            title={breakdownLabel ?? `By ${breakdown.replace(/_/g, " ")}`}
            subtitle={`Gross revenue · ${bucketWord}`}
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
          <Card>
            <CardHeader
              title="By period"
              divider
              action={
                <span className="text-xs tabular-nums text-text-muted">
                  {series.length} {series.length === 1 ? "row" : "rows"}
                </span>
              }
            />
            <Table>
              <caption className="sr-only">Sales by period</caption>
              <THead>
                <TR hover={false}>
                  <TH>Period</TH>
                  <TH numeric>Revenue ({"৳"})</TH>
                  <TH numeric>Orders</TH>
                </TR>
              </THead>
              <TBody>
                {series.map((s) => {
                  const revenue = Number(s.net_revenue);
                  return (
                    <TR key={s.bucket}>
                      <TD className="tabular-nums whitespace-nowrap">{s.bucket}</TD>
                      <TD
                        numeric
                        className={
                          "font-semibold " +
                          (revenue < 0 ? "text-error" : "text-text")
                        }
                      >
                        {formatBDT(revenue)}
                      </TD>
                      <TD numeric className="text-text">
                        {s.orders}
                      </TD>
                    </TR>
                  );
                })}
                <TableTotalsRow>
                  <td className="px-4 py-3">Total</td>
                  <td
                    className={
                      "px-4 py-3 text-right tabular-nums " +
                      (totalRevenue < 0 ? "text-error" : "")
                    }
                  >
                    {formatBDT(totalRevenue)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {totalOrders}
                  </td>
                </TableTotalsRow>
              </TBody>
            </Table>
            <CardFooter>
              Showing {series.length} of {series.length}
            </CardFooter>
          </Card>
        )}
      </div>
    </ReportState>
  );
}
