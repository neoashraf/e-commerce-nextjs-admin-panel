import { z } from "zod";

/**
 * Zod schemas for the admin Reports module (docs/api-contracts/15-reports.md).
 * Each report endpoint gets its own response schema; the boundary client
 * (`api.get(..., { schema })`) validates the backend's shape as external input.
 *
 * Monetary values are BDT **strings** on the wire — parsed to numbers only at
 * render via `formatBDT`. Read-only across the module (BR-RPT-5).
 *
 * The five remaining reports (inventory/customers/payments/promotions/search)
 * are added by rpt-fe-remaining-reports; export/schedule shapes by
 * rpt-fe-export-schedules. Keep all RPT schemas here.
 */

// ── Report catalog ───────────────────────────────────────────────────────────

/** The eight report families the BE serves (api-contract §Sales–Search). */
export const REPORT_KEYS = [
  "sales",
  "orders",
  "products",
  "inventory",
  "customers",
  "payments",
  "promotions",
  "search",
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export function isReportKey(value: string): value is ReportKey {
  return (REPORT_KEYS as readonly string[]).includes(value);
}

// ── Metric definitions (FR-RPT-001/003) ──────────────────────────────────────

export const metricDefinitionSchema = z.object({
  key: z.string(),
  label: z.string(),
  formula: z.string().optional(),
  inclusion_rules: z.string().optional(),
});
export type MetricDefinition = z.infer<typeof metricDefinitionSchema>;
export const metricDefinitionsSchema = z.array(metricDefinitionSchema);

// ── Sales report (FR-RPT-010/011) ────────────────────────────────────────────

export const salesSchema = z.object({
  totals: z
    .object({
      net_revenue: z.string(),
      gross_placed_value: z.string().optional(),
      orders: z.number(),
      units: z.number().optional(),
      aov: z.string().optional(),
    })
    .optional(),
  series: z
    .array(
      z.object({
        bucket: z.string(),
        net_revenue: z.string(),
        orders: z.number(),
        units: z.number().optional(),
        aov: z.string().optional(),
      }),
    )
    .default([]),
  /** dimension → { key → BDT string } (e.g. { payment_method: { cod: "…" } }). */
  breakdown: z.record(z.record(z.string())).optional(),
  as_of: z.string().optional(),
});
export type Sales = z.infer<typeof salesSchema>;

// ── Orders report (FR-RPT-012) ───────────────────────────────────────────────

export const ordersReportSchema = z.object({
  by_status: z
    .record(z.object({ count: z.number(), value: z.string() }))
    .default({}),
  cancellation_rate: z.number().optional(),
  return_rate: z.number().optional(),
  as_of: z.string().optional(),
});
export type OrdersReport = z.infer<typeof ordersReportSchema>;

// ── Products report (FR-RPT-020/021) ─────────────────────────────────────────

export const productRowSchema = z.object({
  product_id: z.string(),
  title: z.string(),
  units: z.number(),
  revenue: z.string(),
  /** present in the by_category view */
  category: z.string().optional(),
});
export type ProductRow = z.infer<typeof productRowSchema>;
export const productsReportSchema = z.array(productRowSchema);

// ── Inventory report (FR-RPT-030/031) — rpt-fe-remaining-reports ──────────────

/**
 * levels/low_stock/out_of_stock return rows; movement returns a summary object.
 * Field names mirror the backend StockLevelRow (sku_code, low_stock_threshold, status) — the
 * same shape as GET /admin/inventory.
 */
export const inventoryLevelRowSchema = z.object({
  variant_id: z.string().optional(),
  product_id: z.string().nullable().optional(),
  sku_code: z.string(),
  product_title: z.string().nullable().optional(),
  on_hand: z.number().optional(),
  reserved: z.number().optional(),
  available: z.number().optional(),
  low_stock_threshold: z.number().optional(),
  status: z.string().optional(),
});
export type InventoryLevelRow = z.infer<typeof inventoryLevelRowSchema>;

export const inventoryMovementSchema = z.object({
  received: z.number(),
  sold: z.number(),
  adjusted: z.number(),
  restocked: z.number(),
  as_of: z.string().optional(),
});
export type InventoryMovement = z.infer<typeof inventoryMovementSchema>;

/** The endpoint returns either an array (levels/low/out) or the movement summary. */
export const inventoryReportSchema = z.union([
  z.array(inventoryLevelRowSchema),
  inventoryMovementSchema,
]);
export type InventoryReport = z.infer<typeof inventoryReportSchema>;

// ── Customers report (FR-RPT-040/041) — rpt-fe-remaining-reports ──────────────

export const customersReportSchema = z.object({
  new_customers: z.number().optional(),
  returning_customers: z.number().optional(),
  repeat_rate: z.number().optional(),
  top: z
    .array(
      z.object({
        customer_id: z.string(),
        name: z.string(),
        ltv: z.string(),
        orders: z.number(),
      }),
    )
    .optional(),
  as_of: z.string().optional(),
});
export type CustomersReport = z.infer<typeof customersReportSchema>;

// ── Payments report (FR-RPT-050) — rpt-fe-remaining-reports ───────────────────

export const paymentsReportSchema = z.object({
  method_split: z.record(z.number()).default({}),
  paid_online: z.string().optional(),
  cod_collected: z.string().optional(),
  refunds: z.string().optional(),
  as_of: z.string().optional(),
});
export type PaymentsReport = z.infer<typeof paymentsReportSchema>;

// ── Promotions report (FR-RPT-051) — rpt-fe-remaining-reports ─────────────────

export const promotionRowSchema = z.object({
  coupon_code: z.string(),
  redemptions: z.number(),
  discount_given: z.string(),
  attributed_sales: z.string(),
});
export type PromotionRow = z.infer<typeof promotionRowSchema>;
export const promotionsReportSchema = z.array(promotionRowSchema);

// ── Search insights (FR-RPT-060) — rpt-fe-remaining-reports ───────────────────

export const searchRowSchema = z.object({
  query: z.string(),
  occurrences: z.number(),
  result_count: z.number().optional(),
});
export type SearchRow = z.infer<typeof searchRowSchema>;
export const searchReportSchema = z.array(searchRowSchema);

// ── Export (FR-RPT-070) — rpt-fe-export-schedules ─────────────────────────────

export const EXPORT_FORMATS = ["csv", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const exportStatusSchema = z.enum(["processing", "ready", "failed"]);
export type ExportStatus = z.infer<typeof exportStatusSchema>;

/** `POST /admin/reports/export` → 202. */
export const exportAcceptedSchema = z.object({
  export_id: z.string(),
  status: exportStatusSchema,
});
export type ExportAccepted = z.infer<typeof exportAcceptedSchema>;

/** `GET /admin/reports/export/{id}` — poll for status + download link. */
export const exportStatusResultSchema = z.object({
  status: exportStatusSchema,
  file_url: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
});
export type ExportStatusResult = z.infer<typeof exportStatusResultSchema>;

/**
 * `GET /admin/reports/exports` — the export manager list (rpt-export-list-be, EB2).
 * Per the contract (api-contracts/15-reports.md) each list row is keyed `id`,
 * whereas the `POST …/export` 202 accept response uses `export_id`. We read the
 * list's `id` (tolerating `export_id` for forward-compat) and normalise to a
 * single `export_id` field so the manager has one stable key.
 */
export const exportRowSchema = z
  .object({
    id: z.string().optional(),
    export_id: z.string().optional(),
    report_key: z.string(),
    format: z.enum(EXPORT_FORMATS).or(z.string()),
    status: exportStatusSchema,
    file_url: z.string().nullable().optional(),
    created_at: z.string().optional(),
    expires_at: z.string().nullable().optional(),
    params: z.record(z.unknown()).optional(),
  })
  .transform(({ id, export_id, ...rest }) => ({
    export_id: export_id ?? id ?? "",
    ...rest,
  }));
export type ExportRow = z.infer<typeof exportRowSchema>;
export const exportListSchema = z.array(exportRowSchema);

// ── Schedules (FR-RPT-071) — rpt-fe-export-schedules ──────────────────────────

export const SCHEDULE_CADENCES = ["daily", "weekly", "monthly"] as const;
export type ScheduleCadence = (typeof SCHEDULE_CADENCES)[number];

export const scheduleSchema = z.object({
  id: z.string(),
  report_key: z.string(),
  params: z.record(z.unknown()).default({}),
  cadence: z.enum(SCHEDULE_CADENCES),
  recipients_admin_ids: z.array(z.string()).default([]),
  is_active: z.boolean(),
  last_run_at: z.string().nullable().optional(),
  last_run_skipped_admin_ids: z.array(z.string()).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Schedule = z.infer<typeof scheduleSchema>;
export const scheduleListSchema = z.array(scheduleSchema);

export const scheduleCreatedSchema = z.object({ id: z.string() });
