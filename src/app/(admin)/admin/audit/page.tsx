import { Suspense } from "react";
import { AuditView } from "@/components/audit/AuditView";

/** Audit log — /admin/audit (rbac-audit-log-fe). Gated by the shell
 * (rbac.audit.read). */
export default function AuditPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
      <AuditView />
    </Suspense>
  );
}
