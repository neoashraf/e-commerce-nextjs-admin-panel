"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  exchangeListSchema,
  exchangeDetailSchema,
  decisionResultSchema,
  issueResultSchema,
  type ExchangeRow,
  type ExchangeDetail,
  type Disposition,
} from "@/lib/api/schemas/exchanges";

/**
 * Admin exchange hooks (ord-exchange-admin-fe). Queue/detail reads gated by
 * `orders.exchange.read`; decision/issue writes by `orders.exchange.review`
 * (the BE guard is authoritative). Decision/issue are server-confirmed — no
 * optimistic updates; we invalidate the queue, the detail, and orders (the
 * original flips to `exchanged` on issue).
 */

export function useExchanges(
  params: Record<string, string | number | boolean | undefined>,
) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: ["admin-exchanges", qs] as const,
    queryFn: (): Promise<ExchangeRow[]> =>
      api.get("/admin/exchanges", {
        schema: exchangeListSchema,
        params,
      }) as Promise<ExchangeRow[]>,
    staleTime: 15_000,
  });
}

export function useExchange(id: string) {
  return useQuery({
    queryKey: ["admin-exchange", id] as const,
    enabled: !!id,
    queryFn: (): Promise<ExchangeDetail> =>
      api.get(`/admin/exchanges/${id}`, {
        schema: exchangeDetailSchema,
      }) as Promise<ExchangeDetail>,
    staleTime: 10_000,
  });
}

export function useDecideExchange(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { decision: "approve" | "reject"; rejection_reason?: string }) =>
      api.post(`/admin/exchanges/${id}/decision`, body, { schema: decisionResultSchema }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-exchange", id] });
      qc.invalidateQueries({ queryKey: ["admin-exchanges"] });
    },
  });
}

export function useIssueExchange(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      replacement_variant_id: string;
      returned_item_disposition: Disposition;
    }) => api.post(`/admin/exchanges/${id}/issue`, body, { schema: issueResultSchema }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-exchange", id] });
      qc.invalidateQueries({ queryKey: ["admin-exchanges"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });
}
