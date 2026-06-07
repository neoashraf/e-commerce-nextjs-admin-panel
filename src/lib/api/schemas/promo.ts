import { z } from "zod";

/**
 * Zod schemas for admin coupons (GET/POST/PATCH/DELETE /admin/coupons —
 * docs/api-contracts/14-promotions.md).
 */
export const couponRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  discount_type: z.enum(["fixed", "percentage", "free_shipping"]),
  value: z.string().optional(),
  total_used: z.number().optional(),
  total_usage_limit: z.number().nullable().optional(),
  is_active: z.boolean().default(true),
  status: z.string().optional(),
});
export type CouponRow = z.infer<typeof couponRowSchema>;
export const couponListSchema = z.array(couponRowSchema);

export const couponDetailSchema = couponRowSchema.extend({
  description: z.string().nullable().optional(),
  max_discount_amount: z.string().nullable().optional(),
  min_order_subtotal: z.string().nullable().optional(),
  eligibility_scope: z.enum(["all", "include", "exclude"]).optional(),
  eligible_category_ids: z.array(z.string()).default([]),
  eligible_product_ids: z.array(z.string()).default([]),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  per_customer_limit: z.number().nullable().optional(),
  first_order_only: z.boolean().optional(),
});
export type CouponDetail = z.infer<typeof couponDetailSchema>;

export const createCouponResultSchema = z.object({ id: z.string(), code: z.string().optional() });
