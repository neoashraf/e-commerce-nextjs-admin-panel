"use client";

import { usePermissions } from "@/lib/permissions/usePermissions";
import { useExportList } from "@/lib/api/hooks/reports";
import { formatDateTime } from "@/lib/format";
import { getReportMeta, REPORTS_EXPORT_PERMISSION } from "./catalog";
import { Column, DataTable } from "./primitives";
import type { ExportRow } from "@/lib/api/schemas/reports";

/**
 * Export manager (FR-RPT-070) — lists the requester's generated exports with
 * status, format, created/expiry, and a download link when ready. Consumes
 * `GET /admin/reports/exports` (rpt-export-list-be, EB2); degrades to an empty
 * state until that endpoint ships. Gated on `reports.report.export`.
 */
const STATUS_LABEL: Record<string, string> = {
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

export function ExportManager() {
  const { can, ready } = usePermissions();
  const enabled = ready && can(REPORTS_EXPORT_PERMISSION);
  const { data, isLoading, isError } = useExportList(enabled);

  if (ready && !can(REPORTS_EXPORT_PERMISSION)) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-600">
          You don&apos;t have permission to manage exports.
        </p>
      </div>
    );
  }

  const rows = data ?? [];

  const cols: Column<ExportRow>[] = [
    {
      header: "Report",
      cell: (r) => getReportMeta(r.report_key)?.label ?? r.report_key,
    },
    { header: "Format", cell: (r) => String(r.format).toUpperCase() },
    { header: "Status", cell: (r) => STATUS_LABEL[r.status] ?? r.status },
    {
      header: "Created",
      cell: (r) => (r.created_at ? formatDateTime(r.created_at) : "—"),
    },
    {
      header: "Expires",
      cell: (r) => (r.expires_at ? formatDateTime(r.expires_at) : "—"),
    },
    {
      header: "Download",
      align: "right",
      cell: (r) =>
        r.status === "ready" && r.file_url ? (
          <a
            href={r.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-700 hover:underline"
          >
            Download
          </a>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Exports</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Generated report exports. Links expire — download promptly.
        </p>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
      ) : isError || rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-sm text-gray-500">
            No exports yet. Use “Export” on any report to generate one.
          </p>
        </div>
      ) : (
        <DataTable
          caption="Generated exports"
          columns={cols}
          rows={rows}
          rowKey={(r) => r.export_id}
        />
      )}
    </div>
  );
}
