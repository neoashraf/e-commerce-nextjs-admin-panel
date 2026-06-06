"use client";

import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { stockListSchema, type StockRow } from "@/lib/api/schemas/inventory";

// ---- Movement ledger (inv-movements-fe) ----
export const movementSchema = z.object({
  id: z.string(),
  type: z.string(),
  quantity_delta: z.number(),
  resulting_on_hand: z.number().optional(),
  reason: z.string().nullable().optional(),
  order_id: z.string().nullable().optional(),
  actor_type: z.string().optional(),
  created_at: z.string(),
});
export type Movement = z.infer<typeof movementSchema>;
const movementListSchema = z.array(movementSchema);

export function useMovements(variantId: string, params: Record<string, string | number | undefined>) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: ["admin-movements", variantId, qs] as const,
    enabled: !!variantId,
    queryFn: (): Promise<Movement[]> => api.get(`/admin/inventory/${variantId}/movements`, { schema: movementListSchema, params }) as Promise<Movement[]>,
    staleTime: 15_000,
  });
}

// ---- Bulk import (inv-bulk-fe) ----
export const bulkResultSchema = z.object({
  processed: z.number().default(0),
  succeeded: z.number().default(0),
  failed: z.number().default(0),
  errors: z.array(z.object({ row: z.number(), sku_code: z.string().optional(), error: z.string() })).default([]),
});
export type BulkResult = z.infer<typeof bulkResultSchema>;

export function useBulkInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Array<{ sku_code: string; set_on_hand?: number; low_stock_threshold?: number; reason?: string }>) =>
      api.post("/admin/inventory/bulk", { rows }, { schema: bulkResultSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-inventory"] }),
  });
}

/**
 * Admin inventory hooks (inv-stock-fe). List + per-SKU receive/adjust/threshold
 * mutations. All via the api client; mutations invalidate the list.
 */
export function useInventory(params: Record<string, string | number | boolean | undefined>) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: ["admin-inventory", qs] as const,
    queryFn: (): Promise<StockRow[]> =>
      api.get("/admin/inventory", { schema: stockListSchema, params }) as Promise<StockRow[]>,
    staleTime: 15_000,
  });
}

export function useReceiveStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, quantity, reason }: { variantId: string; quantity: number; reason: string }) =>
      api.post(`/admin/inventory/${variantId}/receive`, { quantity, reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-inventory"] }),
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, quantity_delta, reason }: { variantId: string; quantity_delta: number; reason: string }) =>
      api.post(`/admin/inventory/${variantId}/adjust`, { quantity_delta, reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-inventory"] }),
  });
}

export function useEditThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, threshold }: { variantId: string; threshold: number }) =>
      api.patch(`/admin/inventory/${variantId}/threshold`, { low_stock_threshold: threshold }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-inventory"] }),
  });
}
