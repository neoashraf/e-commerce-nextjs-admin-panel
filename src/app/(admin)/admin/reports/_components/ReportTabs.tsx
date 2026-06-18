"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { Tabs, type TabItem } from "@/components/ui";
import {
  REPORT_CATALOG,
  REPORTS_EXPORT_PERMISSION,
  REPORTS_SCHEDULE_PERMISSION,
  REPORTS_VIEW_PERMISSION,
} from "./catalog";

/**
 * Reports in-page tab sub-nav (design-system §8.8, FR-RPT-072). Replaces the
 * second left rail with a full-width tab bar: ANALYZE report tabs + a
 * right-aligned, divider-separated MANAGE group (Exports · Schedules).
 * Permission-filtered (every report gated on reports.report.view; the BE scopes
 * each report to the role); overflow scrolls horizontally. Never a second column.
 */
export function ReportTabs() {
  const { can } = usePermissions();
  const active = useSelectedLayoutSegment(); // report key / "exports" / "schedules", or null

  if (!can(REPORTS_VIEW_PERMISSION)) return null;

  const items: TabItem[] = REPORT_CATALOG.map((r) => ({
    key: r.key,
    label: r.label,
    href: `/admin/reports/${r.key}`,
  }));

  const secondary: TabItem[] = [];
  if (can(REPORTS_EXPORT_PERMISSION))
    secondary.push({ key: "exports", label: "Exports", href: "/admin/reports/exports" });
  if (can(REPORTS_SCHEDULE_PERMISSION))
    secondary.push({ key: "schedules", label: "Schedules", href: "/admin/reports/schedules" });

  // The catalog landing redirects to Sales, so treat null as the Sales tab.
  const activeKey = active ?? "sales";

  return (
    <Tabs
      items={items}
      secondary={secondary.length > 0 ? secondary : undefined}
      activeKey={activeKey}
    />
  );
}
