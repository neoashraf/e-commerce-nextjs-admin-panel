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
// Contract: GET/PUT /admin/notification-settings returns { sms, email } channel
// configs (docs/api-contracts/09-notifications.md → Provider Settings). GET never
// returns raw credentials — only the `credentials_ref` pointer. Fields are
// nullable until a provider is configured.
export const smsSettingsSchema = z.object({
  provider_name: z.string().nullable().default(null),
  masked_sender_id: z.string().nullable().default(null),
  non_masking_sender: z.string().nullable().default(null),
  credentials_ref: z.string().nullable().default(null),
  quiet_hours_start: z.string().nullable().default(null),
  quiet_hours_end: z.string().nullable().default(null),
});
export const emailSettingsSchema = z.object({
  provider_name: z.string().nullable().default(null),
  transactional_from: z.string().nullable().default(null),
  credentials_ref: z.string().nullable().default(null),
});
const notifSettingsSchema = z.object({
  sms: smsSettingsSchema.default({}),
  email: emailSettingsSchema.default({}),
});
export type SmsSettings = z.infer<typeof smsSettingsSchema>;
export type EmailSettings = z.infer<typeof emailSettingsSchema>;
export type NotifSettings = z.infer<typeof notifSettingsSchema>;

export function useNotifSettings() {
  return useQuery({
    queryKey: ["admin-notif-settings"] as const,
    queryFn: (): Promise<NotifSettings> => api.get("/admin/notification-settings", { schema: notifSettingsSchema }) as Promise<NotifSettings>,
    staleTime: 60_000,
  });
}
export function useSaveNotifSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NotifSettings) => api.put("/admin/notification-settings", body as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notif-settings"] }),
  });
}
