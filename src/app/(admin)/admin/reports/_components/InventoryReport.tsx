"use client";

import { useInventoryReport } from "@/lib/api/hooks/reports";
import type { InventoryLevelRow, InventoryMovement } from "@/lib/api/schemas/reports";
import { BarBreakdownChart } from "@/components/charts";
import type { ReportMeta } from "./catalog";
import { useReportParams } from "./ReportControls";
import { Column, DataTable, ReportState, Section, Stat } from "./primitives";

/**
 * Inventory report (FR-RPT-030/031). levels/low_stock/out_of_stock return a row
 * list; movement returns a received/sold/adjusted/restocked summary (and needs
 * a from/to range, supplied by ReportControls for the movement view).
 */
function isMovement(
  data: InventoryLevelRow[] | InventoryMovement | undefined,
): data is InventoryMovement {
  return !!data && !Array.isArray(data);
}

export function InventoryReport({ meta }: { meta: ReportMeta }) {
  const { apiParams, view } = useReportParams(meta);
  const { data, isLoading, isError, refetch } = useInventoryReport(apiParams);

  const movement = isMovement(data) ? data : undefined;
  const rows = Array.isArray(data) ? data : [];

  const cols: Column<InventoryLevelRow>[] = [
    { header: "SKU", cell: (r) => r.sku },
    { header: "Product", cell: (r) => r.product_title ?? "—" },
    { header: "Variant", cell: (r) => r.variant ?? "—" },
    { header: "On hand", align: "right", cell: (r) => r.on_hand ?? "—" },
    { header: "Reserved", align: "right", cell: (r) => r.reserved ?? "—" },
    { header: "Available", align: "right", cell: (r) => r.available ?? "—" },
  ];

  const movementChart = movement
    ? [
        { name: "Received", value: movement.received },
        { name: "Sold", value: movement.sold },
        { name: "Adjusted", value: movement.adjusted },
        { name: "Restocked", value: movement.restocked },
      ]
    : [];

  const isEmpty =
    !isLoading && !isError && !movement && rows.length === 0;

  return (
    <ReportState isLoading={isLoading} isError={isError} isEmpty={isEmpty} onRetry={refetch}>
      {view === "movement" && movement ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Received" value={String(movement.received)} />
            <Stat label="Sold" value={String(movement.sold)} />
            <Stat label="Adjusted" value={String(movement.adjusted)} />
            <Stat label="Restocked" value={String(movement.restocked)} />
          </div>
          <Section title="Movement">
            <BarBreakdownChart data={movementChart} valueLabel="Units" />
          </Section>
        </div>
      ) : (
        <Section title="Stock">
          <DataTable
            caption="Inventory levels"
            columns={cols}
            rows={rows}
            rowKey={(r) => r.sku}
          />
        </Section>
      )}
    </ReportState>
  );
}
