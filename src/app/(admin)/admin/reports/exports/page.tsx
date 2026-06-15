import type { Metadata } from "next";
import { ExportManager } from "../_components/ExportManager";

export const metadata: Metadata = { title: "Exports" };

/** Export manager — /admin/reports/exports (rpt-fe-export-schedules). */
export default function ExportsPage() {
  return <ExportManager />;
}
