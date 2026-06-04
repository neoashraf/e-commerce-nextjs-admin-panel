import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Dashboard placeholder for the foundation build. The real KPI cards, alert
 * counters, and recent-activity feed (SRS 10, docs/api-contracts/10-dashboard.md)
 * are scaffolded later following fe-page-scaffold + fe-api-integration.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome to the Sports E-Commerce admin panel.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <p className="text-sm text-gray-500">
          Foundation is in place. Module pages (KPIs, orders, inventory,
          customers, reports) will be built here.
        </p>
      </div>
    </div>
  );
}
