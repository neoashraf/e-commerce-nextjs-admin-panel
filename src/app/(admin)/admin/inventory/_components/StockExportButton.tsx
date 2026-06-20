"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { Button } from "@/components/ui";
import { useCreateExport, useExportStatus } from "@/lib/api/hooks/reports";

/** Export is gated on the reports export permission (backend POST /admin/reports/export check). */
const EXPORT_PERMISSION = "reports.report.export";

/**
 * Export the stock list to CSV. Reuses the async reports-export pipeline
 * (POST /admin/reports/export → poll → ready) with the `inventory` report, mapping the list's
 * status filter to the report `view` (levels = all, low_stock, out_of_stock) so the file matches the
 * on-screen view. Downloads the moment it's ready (the API serves it with Content-Disposition: attachment).
 */
export function StockExportButton({ status }: { status?: string }) {
  const create = useCreateExport();
  const [exportId, setExportId] = useState<string | null>(null);
  const exportStatus = useExportStatus(exportId);

  const submit = () => {
    const view =
      status === "low_stock"
        ? "low_stock"
        : status === "out_of_stock"
          ? "out_of_stock"
          : "levels";
    create.mutate(
      { report_key: "inventory", params: { view }, format: "csv" },
      { onSuccess: (r) => setExportId(r.export_id) },
    );
  };

  const state = exportStatus.data?.status;
  const fileUrl = exportStatus.data?.file_url ?? null;
  const ready = state === "ready" && !!fileUrl;
  const failed = state === "failed" || create.isError;
  const busy = create.isPending || state === "processing";

  // One-click download the moment the export is ready (no second click).
  const downloadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !fileUrl || !exportId || downloadedFor.current === exportId) return;
    downloadedFor.current = exportId;
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = fileUrl.split("/").pop() ?? "stock-export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [ready, fileUrl, exportId]);

  return (
    <Can permission={EXPORT_PERMISSION}>
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={submit}
          disabled={busy}
          leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
        >
          Export CSV
        </Button>
        <p aria-live="polite" className="text-xs">
          {busy && (
            <span className="text-text-muted">Export is processing — ready shortly.</span>
          )}
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
