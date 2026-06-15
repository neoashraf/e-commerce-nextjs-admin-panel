"use client";

import { useState } from "react";
import { Can } from "@/lib/permissions/Can";
import { useCreateExport, useExportStatus } from "@/lib/api/hooks/reports";
import type { ExportFormat } from "@/lib/api/schemas/reports";
import { REPORTS_EXPORT_PERMISSION, type ReportMeta } from "./catalog";
import { useReportParams } from "./ReportControls";

/**
 * Export action on a report viewer (FR-RPT-070). Submits an async export with
 * the viewer's current params, polls the status, and surfaces a download link
 * when ready. Status changes are announced via aria-live. Gated on
 * `reports.report.export`; PDF offered only where the report has a printable
 * layout (meta.pdf).
 */
export function ExportButton({ meta }: { meta: ReportMeta }) {
  const { apiParams } = useReportParams(meta);
  const create = useCreateExport();
  const [exportId, setExportId] = useState<string | null>(null);
  const status = useExportStatus(exportId);

  const submit = (format: ExportFormat) =>
    create.mutate(
      { report_key: meta.key, params: apiParams, format },
      { onSuccess: (r) => setExportId(r.export_id) },
    );

  const state = status.data?.status;
  const ready = state === "ready" && status.data?.file_url;
  const failed = state === "failed" || create.isError;
  const busy = create.isPending || state === "processing";

  return (
    <Can permission={REPORTS_EXPORT_PERMISSION}>
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => submit("csv")}
            disabled={busy}
            className="h-10 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Export CSV
          </button>
          {meta.pdf && (
            <button
              type="button"
              onClick={() => submit("pdf")}
              disabled={busy}
              className="h-10 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Export PDF
            </button>
          )}
        </div>

        <p aria-live="polite" className="text-xs">
          {busy && <span className="text-gray-500">Export is processing — we&apos;ll have it ready shortly.</span>}
          {failed && <span className="text-red-600">Export failed. Try again.</span>}
          {ready && (
            <a
              href={status.data!.file_url!}
              className="font-medium text-brand-700 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download ready
            </a>
          )}
        </p>
      </div>
    </Can>
  );
}
