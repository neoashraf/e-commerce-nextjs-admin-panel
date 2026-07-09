"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import type { ReportKey } from "@/lib/api/schemas/reports";
import { Can } from "@/lib/permissions/Can";
import { Button } from "@/components/ui";
import {
  getReportMeta,
  REPORTS_SCHEDULE_PERMISSION,
  type ReportMeta,
} from "./catalog";
import { ReportAsOfProvider } from "./ReportAsOfContext";
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
          <h1 className="text-[22px] font-bold leading-7 text-text">{meta.label}</h1>
          <p className="mt-0.5 text-sm text-text-muted">{meta.description}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ExportButton meta={meta} />
          {/* Schedule digest — opens the schedules manager (design C1 header, ghost button). */}
          <Can permission={REPORTS_SCHEDULE_PERMISSION}>
            <Link href="/admin/reports/schedules">
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
              >
                Schedule digest
              </Button>
            </Link>
          </Can>
        </div>
      </div>

      <ReportAsOfProvider>
        <ReportControls meta={meta} />
        <Body meta={meta} />
      </ReportAsOfProvider>
    </div>
  );
}
