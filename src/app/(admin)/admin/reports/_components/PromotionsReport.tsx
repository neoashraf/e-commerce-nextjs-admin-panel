"use client";

import { usePromotionsReport } from "@/lib/api/hooks/reports";
import { formatBDT } from "@/lib/format";
import { BarBreakdownChart } from "@/components/charts";
import type { ReportMeta } from "./catalog";
import { useReportParams } from "./ReportControls";
import { DataTable, ReportState, Section } from "./primitives";

/**
 * Promotions report (FR-RPT-051) — per-coupon redemptions, discount given, and
 * attributed sales. Chart ranks coupons by attributed sales; table is the full
 * accessible equivalent.
 */
export function PromotionsReport({ meta }: { meta: ReportMeta }) {
  const { apiParams } = useReportParams(meta);
  const { data, isLoading, isError, refetch } = usePromotionsReport(apiParams);

  const rows = data ?? [];
  const chartData = rows
    .slice(0, 12)
    .map((r) => ({ name: r.coupon_code, value: Number(r.attributed_sales) }));

  return (
    <ReportState
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && rows.length === 0}
      onRetry={refetch}
    >
      <div className="space-y-6">
        {chartData.length > 0 && (
          <Section title="Attributed sales by coupon">
            <BarBreakdownChart data={chartData} valueLabel="Attributed sales" currency />
          </Section>
        )}
        <Section title="Coupons">
          <DataTable
            caption="Promotion report"
            columns={[
              { header: "Coupon", cell: (r) => r.coupon_code },
              { header: "Redemptions", align: "right", cell: (r) => r.redemptions },
              { header: "Discount given", align: "right", cell: (r) => formatBDT(Number(r.discount_given)) },
              { header: "Attributed sales", align: "right", cell: (r) => formatBDT(Number(r.attributed_sales)) },
            ]}
            rows={rows}
            rowKey={(r) => r.coupon_code}
          />
        </Section>
      </div>
    </ReportState>
  );
}
