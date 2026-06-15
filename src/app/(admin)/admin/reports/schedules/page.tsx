import type { Metadata } from "next";
import { SchedulesManager } from "../_components/SchedulesManager";

export const metadata: Metadata = { title: "Report schedules" };

/** Scheduled digests — /admin/reports/schedules (rpt-fe-export-schedules). */
export default function SchedulesPage() {
  return <SchedulesManager />;
}
