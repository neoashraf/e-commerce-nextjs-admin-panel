"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { couponPageSchema, couponDetailSchema, createCouponResultSchema, type CouponPage, type CouponDetail } from "@/lib/api/schemas/promo";

/** Admin coupon hooks (promo-coupons-fe). */
export function useCoupons(params: Record<string, string | number | boolean | undefined>) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: ["admin-coupons", qs] as const,
    // rawEnvelope so the list view can read meta.total for pagination.
    queryFn: (): Promise<CouponPage> => api.get("/admin/coupons", { schema: couponPageSchema, params, rawEnvelope: true }) as Promise<CouponPage>,
    staleTime: 20_000,
  });
}
export function useCoupon(id: string) {
  return useQuery({
    queryKey: ["admin-coupon", id] as const,
    enabled: !!id,
    queryFn: (): Promise<CouponDetail> => api.get(`/admin/coupons/${id}`, { schema: couponDetailSchema }) as Promise<CouponDetail>,
    staleTime: 30_000,
  });
}
type CouponBody = Record<string, unknown>;
export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CouponBody) => api.post("/admin/coupons", body, { schema: createCouponResultSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });
}
export function useUpdateCoupon(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CouponBody) => api.patch(`/admin/coupons/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-coupons"] }); qc.invalidateQueries({ queryKey: ["admin-coupon", id] }); },
  });
}
export function useDeleteCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/admin/coupons/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });
}
