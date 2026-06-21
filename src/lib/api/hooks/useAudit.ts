"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { auditListSchema, type AuditEntry } from "@/lib/api/schemas/audit";
import { paginated, type PaginationMeta } from "@/lib/api/schemas/pagination";
import { env } from "@/lib/env";
import { getAccessToken } from "@/lib/stores/auth";

/**
 * Audit-log hooks (rbac-audit-log-fe). Read-only paginated list with filters
 * (`{ data, meta }` → drives the shared TablePagination footer). Export is a
 * direct authenticated download (CSV attachment) honoring the active filters.
 */
export const auditKeys = { list: (qs: string) => ["audit", qs] as const };
const auditPageSchema = paginated(auditListSchema);

export function useAuditLog(params: Record<string, string | number | boolean | undefined>) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: auditKeys.list(qs),
    queryFn: (): Promise<{ data: AuditEntry[]; meta: PaginationMeta }> =>
      api.get("/admin/audit", { schema: auditPageSchema, params, rawEnvelope: true }) as Promise<{
        data: AuditEntry[];
        meta: PaginationMeta;
      }>,
    staleTime: 15_000,
  });
}

/** Build the export URL (CSV) for the active filters; opened as an authed fetch. */
export async function exportAudit(params: Record<string, string | undefined>): Promise<void> {
  const base = env.apiUrl.replace(/\/$/, "");
  const url = new URL(`${base}/admin/audit/export`);
  url.searchParams.set("format", "csv");
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);

  const token = getAccessToken();
  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error("export failed");
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = "audit-log.csv";
  a.click();
  URL.revokeObjectURL(href);
}
