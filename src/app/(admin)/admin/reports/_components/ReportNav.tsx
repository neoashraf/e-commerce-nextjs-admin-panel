"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { REPORT_CATALOG, REPORTS_VIEW_PERMISSION } from "./catalog";

/**
 * Permission-filtered report nav rail (FR-RPT-072). Every report is gated on
 * `reports.report.view`; the BE additionally scopes each report to the role, so
 * unpermitted reports are simply hidden here. Highlights the active report.
 */
export function ReportNav() {
  const { can } = usePermissions();
  const active = useSelectedLayoutSegment(); // the [reportKey] segment, or null on the catalog

  if (!can(REPORTS_VIEW_PERMISSION)) return null;

  return (
    <nav aria-label="Reports" className="w-full shrink-0 lg:w-56">
      <ul className="space-y-1">
        {REPORT_CATALOG.map((r) => {
          const isActive = active === r.key;
          return (
            <li key={r.key}>
              <Link
                href={`/admin/reports/${r.key}`}
                aria-current={isActive ? "page" : undefined}
                className={
                  "block rounded-md px-3 py-2 text-sm " +
                  (isActive
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-gray-700 hover:bg-gray-100")
                }
              >
                {r.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
