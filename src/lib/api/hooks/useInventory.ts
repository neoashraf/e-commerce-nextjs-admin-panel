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
import { paginated } from "@/lib/api/schemas/pagination";

/** Paginated envelope for GET /admin/inventory ({ data, meta }) — meta.total drives the footer. */
const stockPageSchema = paginated(stockListSchema);
export type StockPage = z.infer<typeof stockPageSchema>;

// ---- Movement ledger (inv-movements-fe) ----
export const movementSchema = z.object({
  id: z.string(),
  type: z.string(),
  quantity_delta: z.number(),
  resulting_on_hand: z.number().optional(),
  reason: z.string().nullable().optional(),
  order_id: z.string().nullable().optional(),
  /**
   * Human order number (e.g. `SO-90245`) for the Order column link. Not yet in the
   * backend MovementRowDto (it returns only `order_id` UUID), so the FE shows/links
   * `order_no` when present and degrades to `order_id` otherwise. (BE ask: order_no.)
   */
  order_no: z.string().nullable().optional(),
  actor_type: z.string().optional(),
  /** Actor display name for the "By" column. Not yet in the BE row. (BE ask: actor_name.) */
  actor_name: z.string().nullable().optional(),
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

/**
 * Resolve a variant's stock row from the already-fetched `/admin/inventory` cache,
 * so the Movements header can show the SKU code, title, options, reserved, available,
 * and status without a dedicated endpoint (the movements response carries none of these).
 * Returns undefined when the user deep-linked here and no inventory page is cached yet.
 */
export function useStockRowFromCache(variantId: string): StockRow | undefined {
  const qc = useQueryClient();
  const caches = qc.getQueriesData<StockPage>({ queryKey: INVENTORY_KEY });
  for (const [, page] of caches) {
    const hit = page?.data.find((r) => r.variant_id === variantId);
    if (hit) return hit;
  }
  return undefined;
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
    // Forwarded for when the backend `category` filter ships; ignored until then.
    category: params.category,
    page: params.page,
    limit: params.limit,
  };
  return useQuery({
    queryKey: [...INVENTORY_KEY, qs] as const,
    // rawEnvelope so the list can read meta.total for the pagination footer.
    queryFn: (): Promise<StockPage> =>
      api.get("/admin/inventory", {
        schema: stockPageSchema,
        params: queryParams,
        rawEnvelope: true,
      }) as Promise<StockPage>,
    staleTime: 15_000,
    retry: (count, err) => !(err as { isClientError?: boolean })?.isClientError && count < 2,
  });
}

/**
 * Header-summary counts (design Stock: "{total} SKUs total · {low} low · {out} out").
 * No counts endpoint exists, so we read `meta.total` from two minimal status-filtered
 * list queries (limit=1) — exact, cheap, cached, and honest (no per-page guessing).
 */
export function useStockStatusCounts() {
  const low = useQuery({
    queryKey: [...INVENTORY_KEY, "count", "low_stock"] as const,
    queryFn: (): Promise<StockPage> =>
      api.get("/admin/inventory", {
        schema: stockPageSchema,
        params: { status: "low_stock", page: 1, limit: 1 },
        rawEnvelope: true,
      }) as Promise<StockPage>,
    staleTime: 30_000,
  });
  const out = useQuery({
    queryKey: [...INVENTORY_KEY, "count", "out_of_stock"] as const,
    queryFn: (): Promise<StockPage> =>
      api.get("/admin/inventory", {
        schema: stockPageSchema,
        params: { status: "out_of_stock", page: 1, limit: 1 },
        rawEnvelope: true,
      }) as Promise<StockPage>,
    staleTime: 30_000,
  });
  return {
    low: low.data?.meta.total,
    out: out.data?.meta.total,
  };
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
