"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { stockListSchema, type StockRow } from "@/lib/api/schemas/inventory";

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
