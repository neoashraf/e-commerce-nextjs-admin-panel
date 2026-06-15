"use client";

import type { ReportKey } from "@/lib/api/schemas/reports";
import { getReportMeta, type ReportMeta } from "./catalog";
import { ReportControls } from "./ReportControls";
import { SalesReport } from "./SalesReport";
import { OrdersReport } from "./OrdersReport";
import { ProductsReport } from "./ProductsReport";

/**
 * Report viewer host — renders the title, the controls (per the report's meta),
 * and the matching report body. Adding a report = a catalog entry + a body
 * component + a line in `BODIES`.
 *
 * Sales/Orders/Products ship here (rpt-fe-shell-reports). The remaining five
 * (inventory/customers/payments/promotions/search) are added by
 * rpt-fe-remaining-reports; the export action by rpt-fe-export-schedules.
 */
type Body = React.ComponentType<{ meta: ReportMeta }>;

const BODIES: Partial<Record<ReportKey, Body>> = {
  sales: SalesReport,
  orders: OrdersReport,
  products: ProductsReport,
};

function ComingSoon({ meta }: { meta: ReportMeta }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
      <p className="text-sm text-gray-500">
        The {meta.label} report is coming soon.
      </p>
    </div>
  );
}

export function ReportViewer({ reportKey }: { reportKey: ReportKey }) {
  const meta = getReportMeta(reportKey);
  if (!meta) return null;
  const Body = BODIES[reportKey] ?? ComingSoon;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{meta.label}</h1>
        <p className="mt-0.5 text-sm text-gray-500">{meta.description}</p>
      </div>

      <ReportControls meta={meta} />
      <Body meta={meta} />
    </div>
  );
}
