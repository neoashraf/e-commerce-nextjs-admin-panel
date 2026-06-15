"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { usePermissions } from "@/lib/permissions/usePermissions";
import {
  REPORT_CATALOG,
  REPORTS_EXPORT_PERMISSION,
  REPORTS_SCHEDULE_PERMISSION,
  REPORTS_VIEW_PERMISSION,
} from "./catalog";

/**
 * Permission-filtered report nav rail (FR-RPT-072). Every report is gated on
 * `reports.report.view`; the BE additionally scopes each report to the role, so
 * unpermitted reports are simply hidden here. The export manager + schedules
 * links appear only with their own permissions. Highlights the active item.
 */
export function ReportNav() {
  const { can } = usePermissions();
  const active = useSelectedLayoutSegment(); // the [reportKey]/exports/schedules segment, or null on the catalog

  if (!can(REPORTS_VIEW_PERMISSION)) return null;

  const linkCls = (isActive: boolean) =>
    "block rounded-md px-3 py-2 text-sm " +
    (isActive
      ? "bg-brand-50 font-semibold text-brand-700"
      : "text-gray-700 hover:bg-gray-100");

  return (
    <nav aria-label="Reports" className="w-full shrink-0 lg:w-56">
      <ul className="space-y-1">
        {REPORT_CATALOG.map((r) => (
          <li key={r.key}>
            <Link
              href={`/admin/reports/${r.key}`}
              aria-current={active === r.key ? "page" : undefined}
              className={linkCls(active === r.key)}
            >
              {r.label}
            </Link>
          </li>
        ))}
      </ul>

      {(can(REPORTS_EXPORT_PERMISSION) || can(REPORTS_SCHEDULE_PERMISSION)) && (
        <ul className="mt-3 space-y-1 border-t border-gray-200 pt-3">
          {can(REPORTS_EXPORT_PERMISSION) && (
            <li>
              <Link
                href="/admin/reports/exports"
                aria-current={active === "exports" ? "page" : undefined}
                className={linkCls(active === "exports")}
              >
                Exports
              </Link>
            </li>
          )}
          {can(REPORTS_SCHEDULE_PERMISSION) && (
            <li>
              <Link
                href="/admin/reports/schedules"
                aria-current={active === "schedules" ? "page" : undefined}
                className={linkCls(active === "schedules")}
              >
                Schedules
              </Link>
            </li>
          )}
        </ul>
      )}
    </nav>
  );
}
