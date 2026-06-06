"use client";

import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

/** Admin customers hooks + schemas (cust-fe). Read-only 360 + notes/tags/status. */
export const customerRowSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  status: z.string().default("active"),
  tags: z.array(z.string()).default([]),
  order_count: z.number().optional(),
  total_spent: z.string().optional(),
  last_order_at: z.string().nullable().optional(),
  is_guest: z.boolean().optional(),
});
export type CustomerRow = z.infer<typeof customerRowSchema>;
const customerListSchema = z.array(customerRowSchema);

export const customerDetailSchema = customerRowSchema.extend({
  notes: z.array(z.object({ id: z.string().optional(), body: z.string(), created_at: z.string().optional() })).default([]),
  recent_orders: z.array(z.object({ order_no: z.string(), grand_total: z.string().optional(), status: z.string().optional(), placed_at: z.string().optional() })).default([]),
});
export type CustomerDetail = z.infer<typeof customerDetailSchema>;

export function useCustomers(params: Record<string, string | number | boolean | undefined>) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: ["admin-customers", qs] as const,
    queryFn: (): Promise<CustomerRow[]> => api.get("/admin/customers", { schema: customerListSchema, params }) as Promise<CustomerRow[]>,
    staleTime: 20_000,
  });
}
export function useCustomer(id: string) {
  return useQuery({
    queryKey: ["admin-customer", id] as const,
    enabled: !!id,
    queryFn: (): Promise<CustomerDetail> => api.get(`/admin/customers/${id}`, { schema: customerDetailSchema }) as Promise<CustomerDetail>,
    staleTime: 30_000,
  });
}
export function useAddNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post(`/admin/customers/${id}/notes`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-customer", id] }),
  });
}
export function useCustomerStatus(id: string) {
  const qc = useQueryClient();
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["admin-customer", id] }); qc.invalidateQueries({ queryKey: ["admin-customers"] }); };
  return {
    suspend: useMutation({ mutationFn: () => api.post(`/admin/customers/${id}/suspend`), onSuccess: invalidate }),
    reactivate: useMutation({ mutationFn: () => api.post(`/admin/customers/${id}/reactivate`), onSuccess: invalidate }),
  };
}
