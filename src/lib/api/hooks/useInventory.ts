"use client";

import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  stockListSchema,
  stockMutationResultSchema,
  type StockListParams,
  type StockMutationResult,
  type StockRow,
} from "@/lib/api/schemas/inventory";

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
 * Admin inventory stock hooks (inv-stock-fe). List query + per-SKU
 * receive/adjust/threshold mutations. All go through the `api` client (no raw
 * fetch). Mutations are server-confirmed: they invalidate the list so the row's
 * on-hand/available/status reconcile from a refetch (the mutation response
 * carries no status/threshold), never an optimistic local mutation.
 */
const INVENTORY_KEY = ["admin-inventory"] as const;

export function useInventory(params: StockListParams) {
  const qs = JSON.stringify(params);
  const queryParams: Record<string, string | number | undefined> = {
    q: params.q,
    status: params.status,
    page: params.page,
    limit: params.limit,
  };
  return useQuery({
    queryKey: [...INVENTORY_KEY, qs] as const,
    queryFn: (): Promise<StockRow[]> =>
      api.get("/admin/inventory", {
        schema: stockListSchema,
        params: queryParams,
      }) as Promise<StockRow[]>,
    staleTime: 15_000,
    retry: (count, err) => !(err as { isClientError?: boolean })?.isClientError && count < 2,
  });
}

export function useReceiveStock() {
  const qc = useQueryClient();
  return useMutation<StockMutationResult, unknown, { variantId: string; quantity: number; reason: string }>({
    mutationFn: ({ variantId, quantity, reason }) =>
      api.post(`/admin/inventory/${variantId}/receive`, { quantity, reason }, { schema: stockMutationResultSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVENTORY_KEY }),
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation<StockMutationResult, unknown, { variantId: string; quantity_delta: number; reason: string }>({
    mutationFn: ({ variantId, quantity_delta, reason }) =>
      api.post(`/admin/inventory/${variantId}/adjust`, { quantity_delta, reason }, { schema: stockMutationResultSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVENTORY_KEY }),
  });
}

export function useEditThreshold() {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, { variantId: string; threshold: number }>({
    mutationFn: ({ variantId, threshold }) =>
      api.patch(`/admin/inventory/${variantId}/threshold`, { low_stock_threshold: threshold }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVENTORY_KEY }),
  });
}
