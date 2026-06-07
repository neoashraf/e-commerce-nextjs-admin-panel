import { z } from "zod";

/**
 * Zod schemas for admin inventory (GET /admin/inventory + receive/adjust/
 * threshold — docs/api-contracts/11-inventory.md).
 */
export const stockStatusSchema = z.enum(["in_stock", "low_stock", "out_of_stock"]);
export type StockStatus = z.infer<typeof stockStatusSchema>;

export const stockRowSchema = z.object({
  variant_id: z.string(),
  sku_code: z.string(),
  product_title: z.string().optional(),
  product_id: z.string().optional(),
  options: z.record(z.string()).nullable().optional(),
  on_hand: z.number().default(0),
  reserved: z.number().default(0),
  available: z.number().default(0),
  low_stock_threshold: z.number().default(0),
  status: stockStatusSchema.default("in_stock"),
});
export type StockRow = z.infer<typeof stockRowSchema>;
export const stockListSchema = z.array(stockRowSchema);

/** Receive/adjust/threshold responses return the updated row figures. */
export const stockMutationResultSchema = z.object({
  variant_id: z.string().optional(),
  on_hand: z.number().optional(),
  available: z.number().optional(),
  status: stockStatusSchema.optional(),
  low_stock_threshold: z.number().optional(),
});
