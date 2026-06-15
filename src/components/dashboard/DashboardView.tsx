"use client";

import { useState } from "react";
import {
  useDashboardRefresh,
  useDashboardSummary,
  type DashboardPeriod,
} from "@/lib/api/hooks/dashboard";
import { formatDateTime } from "@/lib/format";
import { rangeError } from "@/app/(admin)/admin/reports/_components/dates";
import { PeriodSelector } from "@/app/(admin)/admin/dashboard/_components/PeriodSelector";
import { RecentActivity } from "@/app/(admin)/admin/dashboard/_components/RecentActivity";
import {
  AlertsStrip,
  BreakdownPanels,
  KpiCards,
  TopProducts,
  TrendPanel,
} from "@/app/(admin)/admin/dashboard/_components/widgets";

/**
 * Admin dashboard (dash-fe + dash-fe-completion). Period-scoped, role-aware
 * composition: KPI cards, alerts strip, sales/orders trend, orders-by-status +
 * payment-split breakdowns, top products, and recent activity — each widget
 * rendered only if present in `meta.visible_widgets` (FR-DASH-030). A refresh
 * button recomputes the cached aggregates and updates the prominent "as of"
 * stamp (FR-DASH-032); a custom range is validated before the query runs.
 */
export function DashboardView() {
  const [period, setPeriod] = useState<DashboardPeriod>({ period: "last_7d" });

  // Hold the query when a custom range is incomplete/invalid (avoid a 400 loop).
  const customInvalid =
    period.period === "custom" &&
    (!period.from || !period.to || rangeError(period.from, period.to) != null);

  const { data, isLoading, isError, refetch } = useDashboardSummary(
    period,
    !customInvalid,
  );
  const refresh = useDashboardRefresh();

  const summary = data?.data;
  const visible = data?.meta?.visible_widgets;
  // If the BE omits `visible_widgets`, fall back to "show whatever data exists".
  const shows = (widget: string) => (visible ? visible.includes(widget) : true);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-end gap-3">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button
            type="button"
            onClick={() => refresh.mutate(period)}
            disabled={refresh.isPending || customInvalid}
            aria-busy={refresh.isPending}
            className="h-10 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {refresh.isPending ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Announce period/refresh changes for screen readers (FR-DASH a11y). */}
      <p aria-live="polite" className="sr-only">
        {summary?.as_of ? `Dashboard as of ${formatDateTime(summary.as_of)}` : ""}
      </p>

      {customInvalid ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-sm text-gray-500">Choose a valid date range to load the dashboard.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-lg bg-gray-100" />
        </div>
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">Couldn&apos;t load the dashboard.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 text-sm font-medium text-brand-700 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : summary ? (
        <>
          {shows("kpis") && summary.kpis && <KpiCards kpis={summary.kpis} />}
          {shows("alerts") && summary.alerts && <AlertsStrip alerts={summary.alerts} />}

          {shows("breakdowns") && summary.breakdowns?.trend && (
            <TrendPanel trend={summary.breakdowns.trend} />
          )}
          {shows("breakdowns") && (
            <BreakdownPanels
              ordersByStatus={summary.breakdowns?.orders_by_status}
              paymentSplit={summary.breakdowns?.payment_split}
            />
          )}
          {shows("breakdowns") && summary.breakdowns?.top_products && (
            <TopProducts products={summary.breakdowns.top_products} />
          )}

          <RecentActivity
            showOrders={shows("recent_orders")}
            showCustomers={shows("recent_customers")}
            showLeads={shows("recent_leads")}
          />

          {summary.as_of && (
            <p className="text-sm text-gray-500">As of {formatDateTime(summary.as_of)}</p>
          )}
        </>
      ) : null}
    </div>
  );
}
