"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  customersReportSchema,
  exportAcceptedSchema,
  exportListSchema,
  exportStatusResultSchema,
  inventoryReportSchema,
  metricDefinitionsSchema,
  ordersReportSchema,
  paymentsReportSchema,
  productsReportSchema,
  promotionsReportSchema,
  salesSchema,
  scheduleCreatedSchema,
  scheduleListSchema,
  searchReportSchema,
  type CustomersReport,
  type ExportAccepted,
  type ExportFormat,
  type ExportRow,
  type ExportStatusResult,
  type InventoryReport,
  type MetricDefinition,
  type OrdersReport,
  type PaymentsReport,
  type ProductRow,
  type PromotionRow,
  type Sales,
  type Schedule,
  type ScheduleCadence,
  type SearchRow,
} from "@/lib/api/schemas/reports";

/**
 * React Query hooks for the admin Reports module (docs/api-contracts/15-reports.md).
 * Every report is read-only and cached for a minute; query params come straight
 * from the URL-reflected `ReportControls`, so the key is the params object.
 *
 * The single endpoint base is `/admin/reports/<key>`; each hook validates the
 * matching schema at the boundary. Inventory/customers/payments/promotions/search
 * hooks are consumed by rpt-fe-remaining-reports.
 */

/** Params shared across report GETs (omitted when undefined by the client). */
export type ReportParams = Record<
  string,
  string | number | boolean | undefined
>;

export const reportKeys = {
  all: ["reports"] as const,
  metrics: ["reports", "metrics"] as const,
  report: (key: string, params: ReportParams) =>
    ["reports", key, params] as const,
};

/** Canonical metric definitions (FR-RPT-001/003) — for tooltips/legend. */
export function useMetricDefinitions() {
  return useQuery({
    queryKey: reportKeys.metrics,
    queryFn: (): Promise<MetricDefinition[]> =>
      api.get("/admin/reports/metrics", {
        schema: metricDefinitionsSchema,
      }) as Promise<MetricDefinition[]>,
    staleTime: 30 * 60_000,
  });
}

export function useSalesReport(params: ReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.report("sales", params),
    queryFn: (): Promise<Sales> =>
      api.get("/admin/reports/sales", {
        schema: salesSchema,
        params,
      }) as Promise<Sales>,
    staleTime: 60_000,
    enabled,
  });
}

export function useOrdersReport(params: ReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.report("orders", params),
    queryFn: (): Promise<OrdersReport> =>
      api.get("/admin/reports/orders", {
        schema: ordersReportSchema,
        params,
      }) as Promise<OrdersReport>,
    staleTime: 60_000,
    enabled,
  });
}

export function useProductsReport(params: ReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.report("products", params),
    queryFn: (): Promise<ProductRow[]> =>
      api.get("/admin/reports/products", {
        schema: productsReportSchema,
        params,
      }) as Promise<ProductRow[]>,
    staleTime: 60_000,
    enabled,
  });
}

export function useInventoryReport(params: ReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.report("inventory", params),
    queryFn: (): Promise<InventoryReport> =>
      api.get("/admin/reports/inventory", {
        schema: inventoryReportSchema,
        params,
      }) as Promise<InventoryReport>,
    staleTime: 60_000,
    enabled,
  });
}

export function useCustomersReport(params: ReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.report("customers", params),
    queryFn: (): Promise<CustomersReport> =>
      api.get("/admin/reports/customers", {
        schema: customersReportSchema,
        params,
      }) as Promise<CustomersReport>,
    staleTime: 60_000,
    enabled,
  });
}

export function usePaymentsReport(params: ReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.report("payments", params),
    queryFn: (): Promise<PaymentsReport> =>
      api.get("/admin/reports/payments", {
        schema: paymentsReportSchema,
        params,
      }) as Promise<PaymentsReport>,
    staleTime: 60_000,
    enabled,
  });
}

export function usePromotionsReport(params: ReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.report("promotions", params),
    queryFn: (): Promise<PromotionRow[]> =>
      api.get("/admin/reports/promotions", {
        schema: promotionsReportSchema,
        params,
      }) as Promise<PromotionRow[]>,
    staleTime: 60_000,
    enabled,
  });
}

export function useSearchReport(params: ReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.report("search", params),
    queryFn: (): Promise<SearchRow[]> =>
      api.get("/admin/reports/search", {
        schema: searchReportSchema,
        params,
      }) as Promise<SearchRow[]>,
    staleTime: 60_000,
    enabled,
  });
}

// ── Export + schedules (rpt-fe-export-schedules) ──────────────────────────────

export const exportKeys = {
  list: ["reports", "exports"] as const,
  status: (id: string) => ["reports", "export", id] as const,
};
export const scheduleKeys = {
  list: ["reports", "schedules"] as const,
};

/** Submit an async export (FR-RPT-070) → 202 with the export id to poll. */
export function useCreateExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      report_key: string;
      params: Record<string, unknown>;
      format: ExportFormat;
    }): Promise<ExportAccepted> =>
      api.post("/admin/reports/export", body, {
        schema: exportAcceptedSchema,
      }) as Promise<ExportAccepted>,
    onSuccess: () => qc.invalidateQueries({ queryKey: exportKeys.list }),
  });
}

/** Poll an export's status until it's ready/failed (FR-RPT-070). */
export function useExportStatus(id: string | null) {
  return useQuery({
    queryKey: exportKeys.status(id ?? ""),
    enabled: !!id,
    queryFn: (): Promise<ExportStatusResult> =>
      api.get(`/admin/reports/export/${id}`, {
        schema: exportStatusResultSchema,
      }) as Promise<ExportStatusResult>,
    // Poll while processing; stop once a terminal status is reached.
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 2500 : false,
  });
}

/** Export manager list (rpt-export-list-be, EB2). Degrades to empty until shipped. */
export function useExportList(enabled = true) {
  return useQuery({
    queryKey: exportKeys.list,
    enabled,
    retry: false,
    queryFn: (): Promise<ExportRow[]> =>
      api.get("/admin/reports/exports", {
        schema: exportListSchema,
      }) as Promise<ExportRow[]>,
    staleTime: 15_000,
  });
}

export function useSchedules(enabled = true) {
  return useQuery({
    queryKey: scheduleKeys.list,
    enabled,
    queryFn: (): Promise<Schedule[]> =>
      api.get("/admin/reports/schedules", {
        schema: scheduleListSchema,
      }) as Promise<Schedule[]>,
    staleTime: 15_000,
  });
}

export interface ScheduleInput {
  report_key: string;
  params: Record<string, unknown>;
  cadence: ScheduleCadence;
  recipients_admin_ids: string[];
  is_active: boolean;
}

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ScheduleInput) =>
      api.post(
        "/admin/reports/schedules",
        body as unknown as Record<string, unknown>,
        { schema: scheduleCreatedSchema },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.list }),
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<ScheduleInput> }) =>
      api.patch(
        `/admin/reports/schedules/${id}`,
        body as Record<string, unknown>,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.list }),
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(`/admin/reports/schedules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.list }),
  });
}
