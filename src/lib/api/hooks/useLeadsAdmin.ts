"use client";

import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

/** Admin leads inbox hooks + schemas (lead-inbox-fe). */
export const leadRowSchema = z.object({
  reference: z.string(),
  type: z.string(),
  subject: z.string(),
  submitter: z.object({ name: z.string().optional(), phone: z.string().optional() }).nullable().optional(),
  status: z.string(),
  assigned_admin_id: z.string().nullable().optional(),
  order_reference: z.string().nullable().optional(),
  created_at: z.string(),
});
export type LeadRow = z.infer<typeof leadRowSchema>;
const leadListSchema = z.array(leadRowSchema);

const leadMessageSchema = z.object({ direction: z.string(), body: z.string(), created_at: z.string(), internal: z.boolean().optional() });
export const leadAttachmentSchema = z.object({
  id: z.string(),
  url: z.string(),
  content_type: z.string().nullable().optional(),
  size_bytes: z.number().nullable().optional(),
});
export type LeadAttachment = z.infer<typeof leadAttachmentSchema>;
export const leadDetailSchema = z.object({
  reference: z.string(),
  type: z.string(),
  subject: z.string().optional(),
  status: z.string(),
  assigned_admin_id: z.string().nullable().optional(),
  order_reference: z.string().nullable().optional(),
  submitter: z.object({ name: z.string().optional(), phone: z.string().optional(), email: z.string().optional() }).nullable().optional(),
  links: z
    .object({
      customer_id: z.string().nullable().optional(),
      order_id: z.string().nullable().optional(),
      order_reference: z.string().nullable().optional(),
      product_id: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  messages: z.array(leadMessageSchema).default([]),
  attachments: z.array(leadAttachmentSchema).default([]),
});
export type LeadDetail = z.infer<typeof leadDetailSchema>;

export function useAdminLeads(params: Record<string, string | number | boolean | undefined>) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: ["admin-leads", qs] as const,
    queryFn: (): Promise<LeadRow[]> => api.get("/admin/leads", { schema: leadListSchema, params }) as Promise<LeadRow[]>,
    staleTime: 15_000,
  });
}
export function useAdminLead(reference: string) {
  return useQuery({
    queryKey: ["admin-lead", reference] as const,
    enabled: !!reference,
    queryFn: (): Promise<LeadDetail> => api.get(`/admin/leads/${reference}`, { schema: leadDetailSchema }) as Promise<LeadDetail>,
    staleTime: 15_000,
  });
}
export function useReplyLead(reference: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post(`/admin/leads/${reference}/reply`, { body, channel: "email" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-lead", reference] }),
  });
}
export function useAddInternalNote(reference: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post(`/admin/leads/${reference}/notes`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-lead", reference] }),
  });
}

/** Change lead status (FR-LEAD-014) → PATCH /admin/leads/{reference}/status (leads.lead.respond). */
export function useChangeLeadStatus(reference: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: string) => api.patch(`/admin/leads/${reference}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-lead", reference] });
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
    },
  });
}

/** Assign / reassign a lead (FR-LEAD-012) → POST /admin/leads/{reference}/assign (leads.lead.assign). */
export function useAssignLead(reference: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (adminId: string) => api.post(`/admin/leads/${reference}/assign`, { admin_id: adminId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-lead", reference] });
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
    },
  });
}
