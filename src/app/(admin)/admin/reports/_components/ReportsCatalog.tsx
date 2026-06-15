"use client";

import Link from "next/link";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { REPORT_CATALOG, REPORTS_VIEW_PERMISSION } from "./catalog";

/**
 * Reports catalog landing (FR-RPT-072) — a permission-filtered grid of report
 * cards. Until /admin/me resolves we wait (`ready`) to avoid flashing the
 * forbidden state; admins without `reports.report.view` see the denied notice.
 */
export function ReportsCatalog() {
  const { can, ready } = usePermissions();

  if (!ready) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!can(REPORTS_VIEW_PERMISSION)) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-600">
          You don&apos;t have permission to view reports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Reports</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_CATALOG.map((r) => (
          <Link
            key={r.key}
            href={`/admin/reports/${r.key}`}
            className="block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-brand-400"
          >
            <p className="font-semibold text-gray-900">{r.label}</p>
            <p className="mt-1 text-sm text-gray-500">{r.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
