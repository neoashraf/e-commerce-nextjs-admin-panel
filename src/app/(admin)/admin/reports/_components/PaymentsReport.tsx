"use client";

import { Banknote, CreditCard, RotateCcw } from "lucide-react";
import { usePaymentsReport } from "@/lib/api/hooks/reports";
import { formatBDT } from "@/lib/format";
import { CHART_COLORS, DonutChart } from "@/components/charts";
import { ChartCard, StatCard, type LegendItem } from "@/components/ui";
import type { ReportMeta } from "./catalog";
import { useReportParams } from "./ReportControls";
import { AsOf, DataTable, ReportState, TotalsRow } from "./primitives";

/**
 * Payments report (FR-RPT-050). Method split (donut + table) plus paid-online /
 * COD-collected / refunds StatCards. Presentation only.
 */
export function PaymentsReport({ meta }: { meta: ReportMeta }) {
  const { apiParams } = useReportParams(meta);
  const { data, isLoading, isError, refetch } = usePaymentsReport(apiParams);

  const splitRows = Object.entries(data?.method_split ?? {}).map(
    ([name, value]) => ({ name, value }),
  );
  const totalOrders = splitRows.reduce((s, r) => s + r.value, 0);
  const legend: LegendItem[] = splitRows.map((r, i) => ({
    label: r.name,
    color: CHART_COLORS[i % CHART_COLORS.length],
    value: String(r.value),
  }));
  const isEmpty =
    !isLoading && !isError && splitRows.length === 0 &&
    data?.paid_online == null && data?.cod_collected == null;

  return (
    <ReportState isLoading={isLoading} isError={isError} isEmpty={isEmpty} onRetry={refetch}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {data?.paid_online != null && (
            <StatCard
              label="Paid online"
              value={formatBDT(Number(data.paid_online))}
              icon={CreditCard}
            />
          )}
          {data?.cod_collected != null && (
            <StatCard
              label="COD collected"
              value={formatBDT(Number(data.cod_collected))}
              icon={Banknote}
              iconTone="success"
            />
          )}
          {data?.refunds != null && (
            <StatCard
              label="Refunds"
              value={formatBDT(Number(data.refunds))}
              icon={RotateCcw}
              iconTone="warning"
            />
          )}
        </div>

        {splitRows.length > 0 && (
          <ChartCard
            title="Method split"
            legend={legend}
            dataTable={
              <DataTable
                caption="Payment method split"
                columns={[
                  { header: "Method", cell: (r) => <span className="capitalize">{r.name}</span> },
                  { header: "Orders", align: "right", cell: (r) => r.value },
                ]}
                rows={splitRows}
                rowKey={(r) => r.name}
                totalRow={
                  <TotalsRow
                    cells={[
                      { content: "Total" },
                      { content: totalOrders, align: "right" },
                    ]}
                  />
                }
              />
            }
          >
            <DonutChart data={splitRows} centerLabel="Orders" />
          </ChartCard>
        )}
        <AsOf value={data?.as_of} />
      </div>
    </ReportState>
  );
}
