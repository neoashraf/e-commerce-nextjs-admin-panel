"use client";

import { useSearchReport } from "@/lib/api/hooks/reports";
import { BarBreakdownChart } from "@/components/charts";
import type { ReportMeta } from "./catalog";
import { useReportParams } from "./ReportControls";
import { Column, DataTable, ReportState, Section } from "./primitives";

/**
 * Search insights (FR-RPT-060). popular ranks queries by occurrences; the
 * zero_results view lists queries that returned nothing (merchandising signal).
 */
export function SearchReport({ meta }: { meta: ReportMeta }) {
  const { apiParams, view } = useReportParams(meta);
  const { data, isLoading, isError, refetch } = useSearchReport(apiParams);

  const rows = data ?? [];
  const isZero = view === "zero_results";
  const chartData = rows
    .slice(0, 12)
    .map((r) => ({ name: r.query, value: r.occurrences }));

  const cols: Column<(typeof rows)[number]>[] = [
    { header: "Query", cell: (r) => r.query },
    { header: "Occurrences", align: "right", cell: (r) => r.occurrences },
    ...(!isZero
      ? [{ header: "Results", align: "right" as const, cell: (r: (typeof rows)[number]) => r.result_count ?? "—" }]
      : []),
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
          <Section title={isZero ? "Zero-result queries" : "Popular queries"}>
            <BarBreakdownChart data={chartData} valueLabel="Occurrences" />
          </Section>
        )}
        <Section title={isZero ? "Zero results" : "Popular searches"}>
          <DataTable
            caption="Search insights"
            columns={cols}
            rows={rows}
            rowKey={(r, i) => `${r.query}-${i}`}
          />
        </Section>
      </div>
    </ReportState>
  );
}
