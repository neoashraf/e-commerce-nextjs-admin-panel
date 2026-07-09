"use client";

import { Download } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { Button } from "@/components/ui";
import { useAsyncExport } from "@/lib/api/hooks/reports";
import type { ExportFormat } from "@/lib/api/schemas/reports";
import { REPORTS_EXPORT_PERMISSION, type ReportMeta } from "./catalog";
import { useReportParams } from "./ReportControls";

/**
 * Export action on a report viewer (FR-RPT-070). Submits an async export with
 * the viewer's current params, polls the status, and auto-downloads when ready
 * (shared {@link useAsyncExport}); the file also appears in the Exports manager.
 * Status changes are announced via aria-live. Gated on `reports.report.export`;
 * PDF offered only where the report has a printable layout (meta.pdf).
 */
export function ExportButton({ meta }: { meta: ReportMeta }) {
  const { apiParams } = useReportParams(meta);
  const { start, busy, ready, failed, fileUrl, reason } = useAsyncExport();

  const submit = (format: ExportFormat) =>
    start({ report_key: meta.key, params: apiParams, format });

  // Every report tab offers an "Export CSV" action per the RPT designs (the
  // accent header button on each report — Sales/Orders/Products/Inventory/
  // Customers/Payments/…). The backend serialises CSV for all report families
  // (report-content.service handles every ReportKey). PDF (formatted report)
  // is offered only where the report has a printable layout (meta.pdf).
  return (
    <Can permission={REPORTS_EXPORT_PERMISSION}>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => submit("csv")}
            disabled={busy}
            leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
          >
            Export CSV
          </Button>
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
          {failed && (
            <span className="text-error">{reason ? `Export failed: ${reason}` : "Export failed. Try again."}</span>
          )}
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
