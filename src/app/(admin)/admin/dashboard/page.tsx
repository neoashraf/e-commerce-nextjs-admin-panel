import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = { title: "Dashboard" };

/** Admin dashboard — /admin/dashboard (dash-fe). KPIs + alerts + breakdowns. */
export default function DashboardPage() {
  return <DashboardView />;
}
