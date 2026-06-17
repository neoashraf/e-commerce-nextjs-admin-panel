"use client";

import { Repeat, UserPlus, Users } from "lucide-react";
import { useCustomersReport } from "@/lib/api/hooks/reports";
import { formatBDT } from "@/lib/format";
import { CHART_COLORS, DonutChart } from "@/components/charts";
import { ChartCard, StatCard, type LegendItem } from "@/components/ui";
import type { ReportMeta } from "./catalog";
import { useReportParams } from "./ReportControls";
import { AsOf, DataTable, ReportState, Section } from "./primitives";

/**
 * Customers report (FR-RPT-040/041). new_vs_returning shows the new/returning
 * counts + repeat rate (with a donut); top_ltv shows the ranked LTV table.
 * Presentation only.
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
  const legend: LegendItem[] = [
    { label: "New", color: CHART_COLORS[0], value: String(data?.new_customers ?? 0) },
    { label: "Returning", color: CHART_COLORS[1], value: String(data?.returning_customers ?? 0) },
  ];

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
              <StatCard
                label="New customers"
                value={String(data?.new_customers ?? 0)}
                icon={UserPlus}
              />
              <StatCard
                label="Returning"
                value={String(data?.returning_customers ?? 0)}
                icon={Users}
                iconTone="info"
              />
              <StatCard
                label="Repeat rate"
                value={pct(data?.repeat_rate)}
                icon={Repeat}
                iconTone="success"
              />
            </div>
            <ChartCard
              title="New vs returning"
              legend={legend}
              dataTable={
                <DataTable
                  caption="New vs returning customers"
                  columns={[
                    { header: "Segment", cell: (r) => r.name },
                    { header: "Customers", align: "right", cell: (r) => r.value },
                  ]}
                  rows={donut}
                  rowKey={(r) => r.name}
                />
              }
            >
              <DonutChart data={donut} centerLabel="Customers" />
            </ChartCard>
          </>
        )}
        <AsOf value={data?.as_of} />
      </div>
    </ReportState>
  );
}
