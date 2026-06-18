"use client";

import { RotateCcw, XCircle } from "lucide-react";
import { useOrdersReport } from "@/lib/api/hooks/reports";
import { formatBDT } from "@/lib/format";
import { DonutChart, STATUS_COLORS } from "@/components/charts";
import { ChartCard, StatCard, type LegendItem } from "@/components/ui";
import type { ReportMeta } from "./catalog";
import { useReportParams } from "./ReportControls";
import { AsOf, DataTable, ReportState, TotalsRow } from "./primitives";

/**
 * Orders report (FR-RPT-012) — count + value by status (donut + table) and the
 * cancellation / return rates as percentage StatCards. Presentation only.
 */
export function OrdersReport({ meta }: { meta: ReportMeta }) {
  const { apiParams } = useReportParams(meta);
  const { data, isLoading, isError, refetch } = useOrdersReport(apiParams);

  const statusRows = Object.entries(data?.by_status ?? {}).map(
    ([status, v]) => ({ status, count: v.count, value: v.value }),
  );
  const donut = statusRows.map((r) => ({ name: r.status, value: r.count }));
  const pct = (n?: number) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

  const totalCount = statusRows.reduce((s, r) => s + r.count, 0);
  const totalValue = statusRows.reduce((s, r) => s + Number(r.value), 0);

  const legend: LegendItem[] = statusRows.map((r) => ({
    label: r.status.replace(/_/g, " "),
    color: STATUS_COLORS[r.status.toLowerCase()] ?? "#64748B",
    value: String(r.count),
  }));

  return (
    <ReportState
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && statusRows.length === 0}
      onRetry={refetch}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard
            label="Cancellation rate"
            value={pct(data?.cancellation_rate)}
            icon={XCircle}
            iconTone="error"
          />
          <StatCard
            label="Return rate"
            value={pct(data?.return_rate)}
            icon={RotateCcw}
            iconTone="warning"
          />
        </div>

        {statusRows.length > 0 && (
          <ChartCard
            title="By status"
            legend={legend}
            dataTable={
              <DataTable
                caption="Orders by status"
                columns={[
                  { header: "Status", cell: (r) => <span className="capitalize">{r.status.replace(/_/g, " ")}</span> },
                  { header: "Count", align: "right", cell: (r) => r.count },
                  { header: "Value", align: "right", cell: (r) => formatBDT(Number(r.value)) },
                ]}
                rows={statusRows}
                rowKey={(r) => r.status}
                totalRow={
                  <TotalsRow
                    cells={[
                      { content: "Total" },
                      { content: totalCount, align: "right" },
                      { content: formatBDT(totalValue), align: "right" },
                    ]}
                  />
                }
              />
            }
          >
            <DonutChart data={donut} centerLabel="Orders" colorByStatus />
          </ChartCard>
        )}

        <AsOf value={data?.as_of} />
      </div>
    </ReportState>
  );
}
