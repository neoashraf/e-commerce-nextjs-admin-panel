"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { Button } from "@/components/ui";
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
  const fileUrl = status.data?.file_url ?? null;
  const ready = state === "ready" && !!fileUrl;
  const failed = state === "failed" || create.isError;
  const busy = create.isPending || state === "processing";

  // One-click download: the moment an export turns `ready`, trigger the download
  // without a second click. The API serves the file with
  // `Content-Disposition: attachment`, so a plain link navigation downloads it
  // directly (PDF included) — no cross-origin fetch needed (static responses
  // carry no CORS headers, so a fetch() blob would be blocked). `downloadedFor`
  // guards against re-firing as the status query keeps returning `ready`.
  const downloadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !fileUrl || !exportId || downloadedFor.current === exportId) return;
    downloadedFor.current = exportId;
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = fileUrl.split("/").pop() ?? `${meta.key}-export`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [ready, fileUrl, exportId, meta.key]);

  // Raw-data CSV export lives in each module's own page (Orders, Stock, Customers, …), so the Reports
  // viewer offers CSV only for Sales (which has no dedicated module). PDF (formatted report) stays where
  // available. If a report has neither, render no export action.
  const showCsv = meta.key === "sales";
  if (!showCsv && !meta.pdf) return null;

  return (
    <Can permission={REPORTS_EXPORT_PERMISSION}>
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2">
          {showCsv && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => submit("csv")}
              disabled={busy}
              leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
            >
              Export CSV
            </Button>
          )}
          {meta.pdf && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => submit("pdf")}
              disabled={busy}
            >
              Export PDF
            </Button>
          )}
        </div>

        <p aria-live="polite" className="text-xs">
          {busy && <span className="text-text-muted">Export is processing — we&apos;ll have it ready shortly.</span>}
          {failed && <span className="text-error">Export failed. Try again.</span>}
          {ready && (
            <span className="text-text-muted">
              Downloaded.{" "}
              <a
                href={fileUrl!}
                className="font-medium text-accent-700 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Save again
              </a>
            </span>
          )}
        </p>
      </div>
    </Can>
  );
}
