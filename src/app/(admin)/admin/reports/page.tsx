import type { Metadata } from "next";
import { ReportsCatalog } from "./_components/ReportsCatalog";

export const metadata: Metadata = { title: "Reports" };

/**
 * Reports catalog — /admin/reports (rpt-fe-shell-reports). Permission-filtered
 * grid of report cards; picking one opens /admin/reports/[reportKey].
 */
export default function ReportsPage() {
  return <ReportsCatalog />;
}
