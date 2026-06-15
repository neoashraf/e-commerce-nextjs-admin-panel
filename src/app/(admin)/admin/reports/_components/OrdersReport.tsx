"use client";

import { useOrdersReport } from "@/lib/api/hooks/reports";
import { formatBDT } from "@/lib/format";
import { DonutChart } from "@/components/charts";
import type { ReportMeta } from "./catalog";
import { useReportParams } from "./ReportControls";
import { AsOf, DataTable, ReportState, Section, Stat } from "./primitives";

/**
 * Orders report (FR-RPT-012) — count + value by status (donut + table) and the
 * cancellation / return rates as percentage stats.
 */
export function OrdersReport({ meta }: { meta: ReportMeta }) {
  const { apiParams } = useReportParams(meta);
  const { data, isLoading, isError, refetch } = useOrdersReport(apiParams);

  const statusRows = Object.entries(data?.by_status ?? {}).map(
    ([status, v]) => ({ status, count: v.count, value: v.value }),
  );
  const donut = statusRows.map((r) => ({ name: r.status, value: r.count }));
  const pct = (n?: number) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

  return (
    <ReportState
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && statusRows.length === 0}
      onRetry={refetch}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Cancellation rate" value={pct(data?.cancellation_rate)} />
          <Stat label="Return rate" value={pct(data?.return_rate)} />
        </div>

        {statusRows.length > 0 && (
          <Section title="By status">
            <DonutChart data={donut} />
            <DataTable
              caption="Orders by status"
              columns={[
                { header: "Status", cell: (r) => <span className="capitalize">{r.status.replace(/_/g, " ")}</span> },
                { header: "Count", align: "right", cell: (r) => r.count },
                { header: "Value", align: "right", cell: (r) => formatBDT(Number(r.value)) },
              ]}
              rows={statusRows}
              rowKey={(r) => r.status}
            />
          </Section>
        )}

        <AsOf value={data?.as_of} />
      </div>
    </ReportState>
  );
}
