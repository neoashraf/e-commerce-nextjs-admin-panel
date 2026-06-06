"use client";

import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

/** Admin settings hooks — delivery (CART), payment (PAY), notification (NOTIF). */

// ---- Delivery settings (delivery-settings-fe) ----
export const deliveryZoneSchema = z.object({
  zone: z.string(),
  delivery_charge: z.string().default("0"),
  cod_surcharge_pct: z.string().default("0"),
  cod_surcharge_flat: z.string().default("0"),
  free_shipping_threshold: z.string().nullable().optional(),
  cod_enabled: z.boolean().default(true),
  is_active: z.boolean().default(true),
});
export type DeliveryZone = z.infer<typeof deliveryZoneSchema>;
const deliverySettingsSchema = z.object({ zones: z.array(deliveryZoneSchema).default([]) });

export function useDeliverySettings() {
  return useQuery({
    queryKey: ["admin-delivery-settings"] as const,
    queryFn: (): Promise<{ zones: DeliveryZone[] }> => api.get("/admin/delivery-settings", { schema: deliverySettingsSchema }) as Promise<{ zones: DeliveryZone[] }>,
    staleTime: 60_000,
  });
}
export function useSaveDeliverySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (zones: DeliveryZone[]) => api.put("/admin/delivery-settings", { zones } as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-delivery-settings"] }),
  });
}

// ---- Payment settings (pay-settings-fe) ----
const methodConfigSchema = z.object({ environment: z.string().optional(), credentials_ref: z.string().optional(), is_enabled: z.boolean().default(false) });
const paymentSettingsSchema = z.object({ bkash: methodConfigSchema.optional(), sslcommerz: methodConfigSchema.optional(), cod: methodConfigSchema.optional() });
export type PaymentSettings = z.infer<typeof paymentSettingsSchema>;

export function usePaymentSettings() {
  return useQuery({
    queryKey: ["admin-payment-settings"] as const,
    queryFn: (): Promise<PaymentSettings> => api.get("/admin/payment-settings", { schema: paymentSettingsSchema }) as Promise<PaymentSettings>,
    staleTime: 60_000,
  });
}
export function useSavePaymentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PaymentSettings) => api.put("/admin/payment-settings", body as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-payment-settings"] }),
  });
}

// ---- Notification settings (notif-settings-fe) ----
const notifSettingsSchema = z.record(z.unknown());
export function useNotifSettings() {
  return useQuery({
    queryKey: ["admin-notif-settings"] as const,
    queryFn: (): Promise<Record<string, unknown>> => api.get("/admin/notification-settings", { schema: notifSettingsSchema }) as Promise<Record<string, unknown>>,
    staleTime: 60_000,
  });
}
export function useSaveNotifSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.put("/admin/notification-settings", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notif-settings"] }),
  });
}
