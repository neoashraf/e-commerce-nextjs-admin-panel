"use client";

import { useProductsReport } from "@/lib/api/hooks/reports";
import { formatBDT } from "@/lib/format";
import { BarBreakdownChart } from "./charts";
import type { ReportMeta } from "./catalog";
import { useReportParams } from "./ReportControls";
import { Column, DataTable, ReportState, Section } from "./primitives";

/**
 * Products report (FR-RPT-020/021) — top_sellers / by_category / slow_movers,
 * ranked by units or revenue (top_n). Chart ranks the top rows; table is the
 * full accessible equivalent.
 */
export function ProductsReport({ meta }: { meta: ReportMeta }) {
  const { apiParams, metric } = useReportParams(meta);
  const { data, isLoading, isError, refetch } = useProductsReport(apiParams);

  const rows = data ?? [];
  const isRevenue = metric === "revenue";
  const chartData = rows.slice(0, 12).map((p) => ({
    name: p.title,
    value: isRevenue ? Number(p.revenue) : p.units,
  }));

  const cols: Column<(typeof rows)[number]>[] = [
    { header: "Product", cell: (p) => p.title },
    ...(rows.some((r) => r.category)
      ? [{ header: "Category", cell: (p: (typeof rows)[number]) => p.category ?? "—" }]
      : []),
    { header: "Units", align: "right" as const, cell: (p) => p.units },
    { header: "Revenue", align: "right" as const, cell: (p) => formatBDT(Number(p.revenue)) },
  ];

  return (
    <ReportState
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && rows.length === 0}
      onRetry={refetch}
    >
      <div className="space-y-6">
        {chartData.length > 0 && (
          <Section title={isRevenue ? "By revenue" : "By units"}>
            <BarBreakdownChart
              data={chartData}
              valueLabel={isRevenue ? "Revenue" : "Units"}
              currency={isRevenue}
            />
          </Section>
        )}

        <Section title="Products">
          <DataTable
            caption="Product report"
            columns={cols}
            rows={rows}
            rowKey={(p) => p.product_id}
          />
        </Section>
      </div>
    </ReportState>
  );
}
