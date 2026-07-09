"use client";

import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { paginated } from "@/lib/api/schemas/pagination";

/** Admin orders hooks + schemas (ord-admin-fe). */
export const orderRowSchema = z.object({
  order_no: z.string(),
  customer: z.object({ name: z.string().optional(), phone: z.string().optional() }).nullable().optional(),
  status: z.string(),
  payment_method: z.string().optional(),
  payment_state: z.string().optional(),
  grand_total: z.string().optional(),
  placed_at: z.string().optional(),
});
export type OrderRow = z.infer<typeof orderRowSchema>;
const orderListSchema = z.array(orderRowSchema);
/** Paginated envelope for GET /admin/orders ({ data, meta }) — meta.total drives Next (not displayed). */
const orderPageSchema = paginated(orderListSchema);
export type OrderPage = z.infer<typeof orderPageSchema>;

export const adminOrderDetailSchema = z.object({
  order_no: z.string(),
  status: z.string(),
  placed_at: z.string().optional(),
  delivery_zone: z.string().optional(),
  payment_method: z.string().optional(),
  payment_state: z.string().optional(),
  payment_id: z.string().nullable().optional(),
  address: z
    .object({
      recipient_name: z.string(),
      recipient_phone: z.string(),
      address_line: z.string(),
      area: z.string().nullable().optional(),
      district: z.string().nullable().optional(),
      division: z.string().nullable().optional(),
      postal_code: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  items: z
    .array(
      z.object({
        product_title: z.string(),
        product_title_bn: z.string().nullable().optional(),
        product_image: z.string().nullable().optional(),
        sku_code: z.string().nullable().optional(),
        variant_options: z.record(z.string()).default({}),
        unit_price: z.string(),
        quantity: z.number(),
        line_total: z.string(),
      }),
    )
    .default([]),
  amounts: z
    .object({
      subtotal: z.string(),
      discount: z.string(),
      delivery_charge: z.string(),
      cod_surcharge: z.string(),
      vat: z.string(),
      grand_total: z.string(),
    })
    .partial()
    .optional(),
  applied_coupon_code: z.string().nullable().optional(),
  shipment: z
    .object({
      courier_name: z.string().nullable().optional(),
      tracking_number: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  history: z
    .array(
      z.object({
        from_status: z.string().nullable().optional(),
        to_status: z.string(),
        actor_type: z.string().nullable().optional(),
        note: z.string().nullable().optional(),
        created_at: z.string(),
      }),
    )
    .default([]),
  /** Legacy field — kept for backward compat; use `notes` for the attributed thread. */
  internal_notes: z.array(z.object({ body: z.string(), created_at: z.string().optional() })).default([]),
  /** Customer's checkout note (FR-ORD-072a). Null when not provided. */
  customer_note: z.string().nullable().optional(),
  /** Attributed notes thread: customer note + all admin notes with author info (FR-ORD-072b). */
  notes: z
    .array(
      z.object({
        id: z.string(),
        author_type: z.enum(["admin", "customer"]),
        author_name: z.string(),
        body: z.string(),
        created_at: z.string(),
      }),
    )
    .default([]),
});
export type AdminOrderDetail = z.infer<typeof adminOrderDetailSchema>;

export function useAdminOrders(params: Record<string, string | number | boolean | undefined>) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: ["admin-orders", qs] as const,
    // rawEnvelope so the list can read meta.total for the pager (Next disabled on the last page).
    queryFn: (): Promise<OrderPage> =>
      api.get("/admin/orders", { schema: orderPageSchema, params, rawEnvelope: true }) as Promise<OrderPage>,
    staleTime: 15_000,
  });
}
export function useAdminOrder(orderNo: string) {
  return useQuery({
    queryKey: ["admin-order", orderNo] as const,
    enabled: !!orderNo,
    queryFn: (): Promise<AdminOrderDetail> => api.get(`/admin/orders/${orderNo}`, { schema: adminOrderDetailSchema }) as Promise<AdminOrderDetail>,
    staleTime: 10_000,
  });
}
export function useUpdateOrderStatus(orderNo: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { to_status: string; courier_name?: string; tracking_number?: string; note?: string }) =>
      api.patch(`/admin/orders/${orderNo}/status`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-order", orderNo] }); qc.invalidateQueries({ queryKey: ["admin-orders"] }); },
  });
}
export function useCancelOrderAdmin(orderNo: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => api.post(`/admin/orders/${orderNo}/cancel`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-order", orderNo] }); qc.invalidateQueries({ queryKey: ["admin-orders"] }); },
  });
}
/** Add an internal note (FR-ORD-072) — POST /admin/orders/{orderNo}/notes → { id, created_at }. */
export function useAddOrderNote(orderNo: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post(`/admin/orders/${orderNo}/notes`, { body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-order", orderNo] }); },
  });
}
