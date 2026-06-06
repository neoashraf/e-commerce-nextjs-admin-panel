import { z } from "zod";

/**
 * Zod schemas for the read-only audit log
 * (GET /admin/audit — docs/api-contracts/16-rbac.md). No create/update/delete.
 */
export const auditResultSchema = z.enum(["success", "denied", "failed_login", "failed"]);
export type AuditResult = z.infer<typeof auditResultSchema>;

export const auditEntrySchema = z.object({
  id: z.string(),
  actor: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  action: z.string(),
  entity_type: z.string().nullable().optional(),
  entity_id: z.string().nullable().optional(),
  result: auditResultSchema.default("success"),
  summary: z.record(z.unknown()).nullable().optional(),
  ip: z.string().nullable().optional(),
  created_at: z.string(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const auditListSchema = z.array(auditEntrySchema);
