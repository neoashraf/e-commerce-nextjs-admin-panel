"use client";

import { usePaymentsReport } from "@/lib/api/hooks/reports";
import { formatBDT } from "@/lib/format";
import { DonutChart } from "@/components/charts";
import type { ReportMeta } from "./catalog";
import { useReportParams } from "./ReportControls";
import { AsOf, DataTable, ReportState, Section, Stat } from "./primitives";

/**
 * Payments report (FR-RPT-050). Method split (donut + table) plus paid-online /
 * COD-collected / refunds totals.
 */
export function PaymentsReport({ meta }: { meta: ReportMeta }) {
  const { apiParams } = useReportParams(meta);
  const { data, isLoading, isError, refetch } = usePaymentsReport(apiParams);

  const splitRows = Object.entries(data?.method_split ?? {}).map(
    ([name, value]) => ({ name, value }),
  );
  const isEmpty =
    !isLoading && !isError && splitRows.length === 0 &&
    data?.paid_online == null && data?.cod_collected == null;

  return (
    <ReportState isLoading={isLoading} isError={isError} isEmpty={isEmpty} onRetry={refetch}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {data?.paid_online != null && (
            <Stat label="Paid online" value={formatBDT(Number(data.paid_online))} />
          )}
          {data?.cod_collected != null && (
            <Stat label="COD collected" value={formatBDT(Number(data.cod_collected))} />
          )}
          {data?.refunds != null && (
            <Stat label="Refunds" value={formatBDT(Number(data.refunds))} />
          )}
        </div>

        {splitRows.length > 0 && (
          <Section title="Method split">
            <DonutChart data={splitRows} />
            <DataTable
              caption="Payment method split"
              columns={[
                { header: "Method", cell: (r) => <span className="capitalize">{r.name}</span> },
                { header: "Orders", align: "right", cell: (r) => r.value },
              ]}
              rows={splitRows}
              rowKey={(r) => r.name}
            />
          </Section>
        )}
        <AsOf value={data?.as_of} />
      </div>
    </ReportState>
  );
}
