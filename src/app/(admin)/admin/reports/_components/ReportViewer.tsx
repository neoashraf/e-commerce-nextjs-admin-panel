"use client";

import type { ReportKey } from "@/lib/api/schemas/reports";
import { getReportMeta, type ReportMeta } from "./catalog";
import { ReportControls } from "./ReportControls";
import { SalesReport } from "./SalesReport";
import { OrdersReport } from "./OrdersReport";
import { ProductsReport } from "./ProductsReport";
import { InventoryReport } from "./InventoryReport";
import { CustomersReport } from "./CustomersReport";
import { PaymentsReport } from "./PaymentsReport";
import { PromotionsReport } from "./PromotionsReport";
import { SearchReport } from "./SearchReport";
import { ExportButton } from "./ExportButton";

/**
 * Report viewer host — renders the title, the controls (per the report's meta),
 * and the matching report body. Adding a report = a catalog entry + a body
 * component + a line in `BODIES`. The export action is added by
 * rpt-fe-export-schedules.
 */
type Body = React.ComponentType<{ meta: ReportMeta }>;

const BODIES: Record<ReportKey, Body> = {
  sales: SalesReport,
  orders: OrdersReport,
  products: ProductsReport,
  inventory: InventoryReport,
  customers: CustomersReport,
  payments: PaymentsReport,
  promotions: PromotionsReport,
  search: SearchReport,
};

export function ReportViewer({ reportKey }: { reportKey: ReportKey }) {
  const meta = getReportMeta(reportKey);
  if (!meta) return null;
  const Body = BODIES[reportKey];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{meta.label}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{meta.description}</p>
        </div>
        <ExportButton meta={meta} />
      </div>

      <ReportControls meta={meta} />
      <Body meta={meta} />
    </div>
  );
}
