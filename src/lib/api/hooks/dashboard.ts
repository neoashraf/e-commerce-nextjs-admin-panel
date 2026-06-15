"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  dashboardEnvelopeSchema,
  recentCustomersSchema,
  recentLeadsSchema,
  recentOrdersSchema,
  refreshResultSchema,
  type DashboardEnvelope,
  type RecentCustomer,
  type RecentLead,
  type RecentOrder,
  type RefreshResult,
} from "@/lib/api/schemas/dashboard";

/**
 * Admin dashboard hooks (docs/api-contracts/10-dashboard.md). The summary GET
 * carries `meta.visible_widgets`, so it fetches the raw envelope; activity is
 * fetched per type; refresh recomputes the cached aggregates for the period.
 */

export interface DashboardPeriod {
  period: string;
  from?: string;
  to?: string;
}

export const dashboardKeys = {
  summary: (p: DashboardPeriod) => ["admin-dashboard", p] as const,
  activity: (type: string) => ["admin-dashboard", "activity", type] as const,
};

function summaryParams(p: DashboardPeriod) {
  return p.period === "custom"
    ? { period: "custom", from: p.from, to: p.to }
    : { period: p.period };
}

export function useDashboardSummary(p: DashboardPeriod, enabled = true) {
  return useQuery({
    queryKey: dashboardKeys.summary(p),
    queryFn: (): Promise<DashboardEnvelope> =>
      api.get("/admin/dashboard", {
        schema: dashboardEnvelopeSchema,
        rawEnvelope: true,
        params: summaryParams(p),
      }) as Promise<DashboardEnvelope>,
    staleTime: 30_000,
    enabled,
  });
}

export function useRecentOrders(enabled = true) {
  return useQuery({
    queryKey: dashboardKeys.activity("orders"),
    queryFn: (): Promise<RecentOrder[]> =>
      api.get("/admin/dashboard/activity", {
        schema: recentOrdersSchema,
        params: { type: "orders", limit: 8 },
      }) as Promise<RecentOrder[]>,
    staleTime: 30_000,
    enabled,
  });
}

export function useRecentCustomers(enabled = true) {
  return useQuery({
    queryKey: dashboardKeys.activity("customers"),
    queryFn: (): Promise<RecentCustomer[]> =>
      api.get("/admin/dashboard/activity", {
        schema: recentCustomersSchema,
        params: { type: "customers", limit: 8 },
      }) as Promise<RecentCustomer[]>,
    staleTime: 30_000,
    enabled,
  });
}

export function useRecentLeads(enabled = true) {
  return useQuery({
    queryKey: dashboardKeys.activity("leads"),
    queryFn: (): Promise<RecentLead[]> =>
      api.get("/admin/dashboard/activity", {
        schema: recentLeadsSchema,
        params: { type: "leads", limit: 8 },
      }) as Promise<RecentLead[]>,
    staleTime: 30_000,
    enabled,
  });
}

/** Force a recompute of the period's cached aggregates (FR-DASH-032). */
export function useDashboardRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: DashboardPeriod): Promise<RefreshResult> =>
      api.post("/admin/dashboard/refresh", undefined, {
        schema: refreshResultSchema,
        params: summaryParams(p),
      }) as Promise<RefreshResult>,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] }),
  });
}
