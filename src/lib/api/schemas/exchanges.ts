import { z } from "zod";

/**
 * Exchange admin schemas (ord-exchange-admin-fe). Mirrors the ORD exchange
 * admin contract (docs/api-contracts/06-orders-tracking.md): queue, detail,
 * decision, issue. The BE detail shape is treated as external input — fields
 * beyond the documented core are optional/nullable so contract drift surfaces
 * as a clear error rather than silently passing bad data downstream.
 */

export const EXCHANGE_STATUSES = [
  "requested",
  "under_qa_review",
  "approved",
  "replacement_issued",
  "completed",
  "rejected",
] as const;
export type ExchangeStatus = (typeof EXCHANGE_STATUSES)[number];

/** Rejection reasons (FR-ORD-046). */
export const REJECTION_REASONS = [
  "outside_window",
  "non_exchangeable",
  "discount_purchased",
  "already_exchanged",
  "other",
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

/** Returned-item disposition (FR-ORD-049): resellable → restock, defective → scrap. */
export const DISPOSITIONS = ["restocked", "scrapped"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

/** Common exchange reasons (display + filter); BE accepts the raw value. */
export const EXCHANGE_REASONS = [
  "quality_defect",
  "wrong_size",
  "wrong_item",
  "changed_mind",
  "other",
] as const;

export const exchangeRowSchema = z.object({
  exchange_id: z.string(),
  order_no: z.string(),
  order_item: z
    .object({ sku_code: z.string().optional(), title: z.string().optional() })
    .nullable()
    .optional(),
  reason: z.string(),
  status: z.string(),
  qa_due_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export type ExchangeRow = z.infer<typeof exchangeRowSchema>;
export const exchangeListSchema = z.array(exchangeRowSchema);

export const exchangeAttachmentSchema = z.object({
  id: z.string().optional(),
  url: z.string(),
  /** image | video (free-form; the viewer falls back to a link when unknown). */
  type: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
});
export type ExchangeAttachment = z.infer<typeof exchangeAttachmentSchema>;

export const exchangeDetailSchema = z.object({
  exchange_id: z.string(),
  order_no: z.string(),
  status: z.string(),
  reason: z.string(),
  customer_note: z.string().nullable().optional(),
  order_item: z
    .object({
      sku_code: z.string().optional(),
      title: z.string().optional(),
      unit_price: z.string().nullable().optional(),
      quantity: z.number().optional(),
      variant_options: z.record(z.string()).optional(),
    })
    .nullable()
    .optional(),
  attachments: z.array(exchangeAttachmentSchema).default([]),
  eligibility: z
    .object({
      is_eligible: z.boolean().optional(),
      flags: z.array(z.string()).optional(),
    })
    .nullable()
    .optional(),
  qa_due_at: z.string().nullable().optional(),
  /** Set once a higher-value replacement is chosen; "0.00" / null otherwise. */
  price_difference: z.string().nullable().optional(),
  /** paid | pending | … — when present, gates issuing a higher-value replacement. */
  difference_payment_state: z.string().nullable().optional(),
  replacement_order_no: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export type ExchangeDetail = z.infer<typeof exchangeDetailSchema>;

export const decisionResultSchema = z.object({
  exchange_id: z.string(),
  status: z.string(),
});

export const issueResultSchema = z.object({
  exchange_id: z.string(),
  status: z.string(),
  replacement_order_no: z.string().nullable().optional(),
  order_status: z.string().nullable().optional(),
  price_difference: z.string().nullable().optional(),
});
