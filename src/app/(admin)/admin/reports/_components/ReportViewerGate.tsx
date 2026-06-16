"use client";

import type { ReportKey } from "@/lib/api/schemas/reports";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { REPORTS_VIEW_PERMISSION } from "./catalog";
import { ReportViewer } from "./ReportViewer";

/**
 * Permission gate for a report viewer (FR-RPT-072). Direct navigation to a
 * report the admin can't view shows a denied notice (the BE also rejects the
 * request); we wait for /admin/me (`ready`) before deciding so permitted admins
 * never flash the denied state.
 */
export function ReportViewerGate({ reportKey }: { reportKey: ReportKey }) {
  const { can, ready } = usePermissions();

  if (!ready) {
    return <div className="h-72 animate-pulse rounded-lg bg-gray-100" />;
  }
  if (!can(REPORTS_VIEW_PERMISSION)) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-600">
          You don&apos;t have permission to view this report.
        </p>
      </div>
    );
  }
  return <ReportViewer reportKey={reportKey} />;
}
