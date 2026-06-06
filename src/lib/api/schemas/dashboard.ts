import { z } from "zod";

/** Zod schema for the admin dashboard summary (GET /admin/dashboard). */
const kpiSchema = z.object({
  value: z.union([z.string(), z.number()]),
  currency: z.string().optional(),
  delta_pct: z.number().optional(),
  direction: z.enum(["up", "down", "flat"]).optional(),
});

export const dashboardSchema = z.object({
  period: z.object({ preset: z.string().optional(), from: z.string().optional(), to: z.string().optional() }).optional(),
  kpis: z.record(kpiSchema).optional(),
  alerts: z.record(z.number()).optional(),
  breakdowns: z
    .object({
      orders_by_status: z.record(z.number()).optional(),
      payment_split: z.record(z.number()).optional(),
      top_products: z.array(z.object({ product_id: z.string(), title: z.string(), units: z.number(), sales: z.string() })).optional(),
    })
    .optional(),
  as_of: z.string().optional(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
