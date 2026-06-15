"use client";

import { useCustomersReport } from "@/lib/api/hooks/reports";
import { formatBDT } from "@/lib/format";
import { DonutChart } from "@/components/charts";
import type { ReportMeta } from "./catalog";
import { useReportParams } from "./ReportControls";
import { AsOf, DataTable, ReportState, Section, Stat } from "./primitives";

/**
 * Customers report (FR-RPT-040/041). new_vs_returning shows the new/returning
 * counts + repeat rate (with a donut); top_ltv shows the ranked LTV table.
 */
export function CustomersReport({ meta }: { meta: ReportMeta }) {
  const { apiParams, view } = useReportParams(meta);
  const { data, isLoading, isError, refetch } = useCustomersReport(apiParams);

  const top = data?.top ?? [];
  const isTopLtv = view === "top_ltv";
  const donut = [
    { name: "New", value: data?.new_customers ?? 0 },
    { name: "Returning", value: data?.returning_customers ?? 0 },
  ];
  const pct = (n?: number) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

  const isEmpty =
    !isLoading && !isError &&
    (isTopLtv
      ? top.length === 0
      : data?.new_customers == null && data?.returning_customers == null);

  return (
    <ReportState isLoading={isLoading} isError={isError} isEmpty={isEmpty} onRetry={refetch}>
      <div className="space-y-6">
        {isTopLtv ? (
          <Section title="Top lifetime value">
            <DataTable
              caption="Top customers by lifetime value"
              columns={[
                { header: "Customer", cell: (r) => r.name },
                { header: "Orders", align: "right", cell: (r) => r.orders },
                { header: "Lifetime value", align: "right", cell: (r) => formatBDT(Number(r.ltv)) },
              ]}
              rows={top}
              rowKey={(r) => r.customer_id}
            />
          </Section>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="New customers" value={String(data?.new_customers ?? 0)} />
              <Stat label="Returning" value={String(data?.returning_customers ?? 0)} />
              <Stat label="Repeat rate" value={pct(data?.repeat_rate)} />
            </div>
            <Section title="New vs returning">
              <DonutChart data={donut} />
            </Section>
          </>
        )}
        <AsOf value={data?.as_of} />
      </div>
    </ReportState>
  );
}
