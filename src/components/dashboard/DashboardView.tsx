"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
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
import { Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";

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
        <div>
          <h1 className="text-[22px] font-bold leading-7 text-text">Dashboard</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Store performance, alerts, and recent activity at a glance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector value={period} onChange={setPeriod} />
          <Button
            variant="secondary"
            onClick={() => refresh.mutate(period)}
            disabled={refresh.isPending || customInvalid}
            aria-busy={refresh.isPending}
            leadingIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
          >
            {refresh.isPending ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Announce period/refresh changes for screen readers (FR-DASH a11y). */}
      <p aria-live="polite" className="sr-only">
        {summary?.as_of ? `Dashboard as of ${formatDateTime(summary.as_of)}` : ""}
      </p>

      {customInvalid ? (
        <Card>
          <EmptyState title="Choose a valid date range to load the dashboard." />
        </Card>
      ) : isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-lg" />
        </div>
      ) : isError ? (
        <Card>
          <ErrorState
            description="Couldn't load the dashboard."
            onRetry={() => refetch()}
          />
        </Card>
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
            <p className="text-sm text-text-muted">As of {formatDateTime(summary.as_of)}</p>
          )}
        </>
      ) : null}
    </div>
  );
}
