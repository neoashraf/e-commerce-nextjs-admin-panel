import { z } from "zod";

/** Zod schema for the admin dashboard summary (GET /admin/dashboard). */
const kpiSchema = z.object({
  value: z.union([z.string(), z.number()]),
  currency: z.string().optional(),
  delta_pct: z.number().optional(),
  direction: z.enum(["up", "down", "flat"]).optional(),
});

/** A point on the sales/orders trend (breakdowns.trend, FR-DASH-022). */
export const trendPointSchema = z.object({
  date: z.string(),
  sales: z.string(),
  orders: z.number(),
});
export type TrendPoint = z.infer<typeof trendPointSchema>;

export const dashboardSchema = z.object({
  period: z
    .object({
      preset: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      compare_from: z.string().optional(),
      compare_to: z.string().optional(),
    })
    .optional(),
  kpis: z.record(kpiSchema).optional(),
  alerts: z.record(z.number()).optional(),
  breakdowns: z
    .object({
      trend: z.array(trendPointSchema).optional(),
      orders_by_status: z.record(z.number()).optional(),
      payment_split: z.record(z.number()).optional(),
      top_products: z
        .array(
          z.object({
            product_id: z.string(),
            title: z.string(),
            units: z.number(),
            sales: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
  as_of: z.string().optional(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

/**
 * The summary envelope carries `meta.visible_widgets` alongside `data`
 * (FR-DASH-030). The api client unwraps `data` by default, so we fetch the raw
 * envelope here to read both. Unknown widget keys are tolerated (string array).
 */
export const dashboardEnvelopeSchema = z.object({
  data: dashboardSchema,
  meta: z
    .object({ visible_widgets: z.array(z.string()).optional() })
    .optional(),
});
export type DashboardEnvelope = z.infer<typeof dashboardEnvelopeSchema>;

/** GET /admin/dashboard/activity?type=orders|customers|leads (FR-DASH-020/021). */
export const recentOrderSchema = z.object({
  order_no: z.string(),
  customer: z.string().optional(),
  grand_total: z.string().optional(),
  status: z.string().optional(),
  placed_at: z.string().optional(),
});
export const recentCustomerSchema = z.object({
  customer_id: z.string(),
  name: z.string().optional(),
  phone: z.string().optional(),
  created_at: z.string().optional(),
});
export const recentLeadSchema = z.object({
  reference: z.string().optional(),
  subject: z.string().optional(),
  name: z.string().optional(),
  status: z.string().optional(),
  created_at: z.string().optional(),
});

export type RecentOrder = z.infer<typeof recentOrderSchema>;
export type RecentCustomer = z.infer<typeof recentCustomerSchema>;
export type RecentLead = z.infer<typeof recentLeadSchema>;

export const recentOrdersSchema = z.array(recentOrderSchema);
export const recentCustomersSchema = z.array(recentCustomerSchema);
export const recentLeadsSchema = z.array(recentLeadSchema);

/** POST /admin/dashboard/refresh (FR-DASH-032). */
export const refreshResultSchema = z.object({ as_of: z.string().optional() });
export type RefreshResult = z.infer<typeof refreshResultSchema>;
