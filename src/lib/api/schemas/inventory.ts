import { z } from "zod";

/**
 * Zod schemas for admin inventory — the stock list + receive/adjust/threshold
 * mutations (docs/api-contracts/11-inventory.md; backend
 * InventoryRow / StockMutationResult). Validated at the API boundary.
 */
export const stockStatusSchema = z.enum(["in_stock", "low_stock", "out_of_stock"]);
export type StockStatus = z.infer<typeof stockStatusSchema>;

/**
 * One row of GET /admin/inventory. `product_title`/`options` degrade to null
 * when the CAT label join is unavailable (design §6 partial state); qty/status
 * always render. `reserved` is read-only (owned by checkout/orders).
 */
export const stockRowSchema = z.object({
  variant_id: z.string(),
  sku_code: z.string(),
  product_title: z.string().nullable().optional(),
  product_id: z.string().nullable().optional(),
  options: z.record(z.string()).nullable().optional(),
  on_hand: z.number().default(0),
  reserved: z.number().default(0),
  available: z.number().default(0),
  low_stock_threshold: z.number().default(0),
  status: stockStatusSchema.default("in_stock"),
});
export type StockRow = z.infer<typeof stockRowSchema>;
export const stockListSchema = z.array(stockRowSchema);

/** `{ page, limit, total }` from the paginated envelope's `meta`. */
export const listMetaSchema = z.object({
  page: z.number().default(1),
  limit: z.number().default(50),
  total: z.number().default(0),
});
export type ListMeta = z.infer<typeof listMetaSchema>;

/**
 * Receive/adjust/threshold mutation response — the updated figures
 * (StockMutationResult). Does NOT carry `status`/`threshold`, so the row's new
 * status is reconciled by refetching the list (server-confirmed, no optimistic
 * mutation).
 */
export const stockMutationResultSchema = z.object({
  variant_id: z.string(),
  on_hand: z.number(),
  available: z.number(),
  movement_id: z.string().nullable().optional(),
});
export type StockMutationResult = z.infer<typeof stockMutationResultSchema>;

/** Query params for GET /admin/inventory (mirrored to the URL). */
export interface StockListParams {
  q?: string;
  status?: StockStatus;
  page?: number;
  limit?: number;
}
