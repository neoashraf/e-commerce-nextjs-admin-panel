"use client";

import { AlertTriangle, Boxes, PackageX, Layers } from "lucide-react";
import { useInventoryReport } from "@/lib/api/hooks/reports";
import type { InventoryLevelRow, InventoryMovement } from "@/lib/api/schemas/reports";
import { BarBreakdownChart } from "@/components/charts";
import { ChartCard, StatCard, StatusPill } from "@/components/ui";
import type { ReportMeta } from "./catalog";
import { useReportParams } from "./ReportControls";
import { Column, DataTable, ReportState, Section } from "./primitives";

/**
 * Inventory report (FR-RPT-030/031). levels/low_stock/out_of_stock return a row
 * list; movement returns a received/sold/adjusted/restocked summary (and needs
 * a from/to range, supplied by ReportControls for the movement view). KPI
 * StatCards + Low/Out stock pills are derived from the rows (available vs
 * reorder_point) — no data-layer change. Presentation only.
 */
function isMovement(
  data: InventoryLevelRow[] | InventoryMovement | undefined,
): data is InventoryMovement {
  return !!data && !Array.isArray(data);
}

/** Prefer the backend-derived status; fall back to available vs low-stock threshold. */
function stockStatus(r: InventoryLevelRow): "out-of-stock" | "low-stock" | "in-stock" {
  if (r.status === "out_of_stock") return "out-of-stock";
  if (r.status === "low_stock") return "low-stock";
  if (r.status === "in_stock") return "in-stock";
  const avail = r.available ?? r.on_hand;
  if (avail != null && avail <= 0) return "out-of-stock";
  if (avail != null && r.low_stock_threshold != null && avail <= r.low_stock_threshold) return "low-stock";
  return "in-stock";
}

export function InventoryReport({ meta }: { meta: ReportMeta }) {
  const { apiParams, view } = useReportParams(meta);
  const { data, isLoading, isError, refetch } = useInventoryReport(apiParams);

  const movement = isMovement(data) ? data : undefined;
  const rows = Array.isArray(data) ? data : [];

  const lowCount = rows.filter((r) => stockStatus(r) === "low-stock").length;
  const outCount = rows.filter((r) => stockStatus(r) === "out-of-stock").length;
  const onHandTotal = rows.reduce((s, r) => s + (r.on_hand ?? 0), 0);

  const cols: Column<InventoryLevelRow>[] = [
    { header: "SKU", cell: (r) => r.sku_code },
    { header: "Product", cell: (r) => r.product_title ?? "—" },
    { header: "On hand", align: "right", cell: (r) => r.on_hand ?? "—" },
    { header: "Reserved", align: "right", cell: (r) => r.reserved ?? "—" },
    { header: "Available", align: "right", cell: (r) => r.available ?? "—" },
    { header: "Threshold", align: "right", cell: (r) => r.low_stock_threshold ?? "—" },
    { header: "Stock", cell: (r) => <StatusPill status={stockStatus(r)} /> },
  ];

  const movementChart = movement
    ? [
        { name: "Received", value: movement.received },
        { name: "Sold", value: movement.sold },
        { name: "Adjusted", value: movement.adjusted },
        { name: "Restocked", value: movement.restocked },
      ]
    : [];

  const isEmpty = !isLoading && !isError && !movement && rows.length === 0;

  return (
    <ReportState isLoading={isLoading} isError={isError} isEmpty={isEmpty} onRetry={refetch}>
      {view === "movement" && movement ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Received" value={String(movement.received)} icon={Boxes} iconTone="success" />
            <StatCard label="Sold" value={String(movement.sold)} icon={Layers} />
            <StatCard label="Adjusted" value={String(movement.adjusted)} icon={AlertTriangle} iconTone="warning" />
            <StatCard label="Restocked" value={String(movement.restocked)} icon={Boxes} iconTone="info" />
          </div>
          <ChartCard
            title="Movement"
            dataTable={
              <DataTable
                caption="Inventory movement"
                columns={[
                  { header: "Type", cell: (r) => r.name },
                  { header: "Units", align: "right", cell: (r) => r.value },
                ]}
                rows={movementChart}
                rowKey={(r) => r.name}
              />
            }
          >
            <BarBreakdownChart data={movementChart} valueLabel="Units" />
          </ChartCard>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total SKUs" value={String(rows.length)} icon={Layers} />
            <StatCard label="Low stock" value={String(lowCount)} icon={AlertTriangle} iconTone="warning" />
            <StatCard label="Out of stock" value={String(outCount)} icon={PackageX} iconTone="error" />
            <StatCard label="On-hand units" value={onHandTotal.toLocaleString("en-BD")} icon={Boxes} iconTone="info" />
          </div>
          <Section title="Stock">
            <DataTable
              caption="Inventory levels"
              columns={cols}
              rows={rows}
              rowKey={(r) => r.variant_id ?? r.sku_code}
            />
          </Section>
        </div>
      )}
    </ReportState>
  );
}
