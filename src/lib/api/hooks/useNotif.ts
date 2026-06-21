"use client";

import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { paginated, type PaginationMeta } from "@/lib/api/schemas/pagination";

/** Admin notifications hooks + schemas (notif-templates-fe, notif-log-fe). */

// ---- Templates ----
export const templateRowSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  channel: z.string(),
  locale: z.string().optional(),
  version: z.number().optional(),
  is_active: z.boolean().default(true),
  body: z.string().optional(),
});
export type TemplateRow = z.infer<typeof templateRowSchema>;
const templateListSchema = z.array(templateRowSchema);
const createTemplateResultSchema = z.object({ id: z.string(), version: z.number().optional(), is_active: z.boolean().optional() });

export function useTemplates(params: Record<string, string | number | boolean | undefined>) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: ["admin-templates", qs] as const,
    queryFn: (): Promise<TemplateRow[]> => api.get("/admin/notification-templates", { schema: templateListSchema, params }) as Promise<TemplateRow[]>,
    staleTime: 30_000,
  });
}
export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { event_type: string; channel: string; locale: string; body: string }) => api.post("/admin/notification-templates", body, { schema: createTemplateResultSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-templates"] }),
  });
}
export function useUpdateTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { body: string }) => api.patch(`/admin/notification-templates/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-templates"] }),
  });
}

// ---- Notification log ----
export const notifLogRowSchema = z.object({
  id: z.string(),
  channel: z.string(),
  event_type: z.string().optional(),
  recipient: z.string().optional(),
  status: z.string(),
  created_at: z.string().optional(),
});
export type NotifLogRow = z.infer<typeof notifLogRowSchema>;
const notifLogListSchema = z.array(notifLogRowSchema);
const notifLogPageSchema = paginated(notifLogListSchema);

export function useNotifLog(params: Record<string, string | number | boolean | undefined>) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: ["admin-notif-log", qs] as const,
    queryFn: (): Promise<{ data: NotifLogRow[]; meta: PaginationMeta }> =>
      api.get("/admin/notifications", { schema: notifLogPageSchema, params, rawEnvelope: true }) as Promise<{
        data: NotifLogRow[];
        meta: PaginationMeta;
      }>,
    staleTime: 15_000,
  });
}
export function useResendNotif() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/admin/notifications/${id}/resend`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notif-log"] }),
  });
}
