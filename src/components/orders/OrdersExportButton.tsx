"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { Button } from "@/components/ui";
import { useCreateExport, useExportStatus } from "@/lib/api/hooks/reports";
import type { ExportFormat } from "@/lib/api/schemas/reports";

/** Export is gated on the reports export permission (the backend POST /admin/reports/export check). */
const EXPORT_PERMISSION = "reports.report.export";

/**
 * CSV/PDF export for the admin Orders list. Reuses the async reports-export pipeline
 * (POST /admin/reports/export → poll → ready) with the `orders_list` report key, passing the list's
 * current filters so the file matches what's on screen. Downloads in one click the moment it's ready
 * (the API serves the file with Content-Disposition: attachment).
 */
export function OrdersExportButton({
  filters,
}: {
  filters: { q?: string; status?: string; payment_state?: string; from?: string; to?: string };
}) {
  const create = useCreateExport();
  const [exportId, setExportId] = useState<string | null>(null);
  const status = useExportStatus(exportId);

  const submit = (format: ExportFormat) => {
    const params: Record<string, unknown> = {};
    if (filters.q) params.q = filters.q;
    if (filters.status) params.status = filters.status;
    if (filters.payment_state) params.payment_state = filters.payment_state;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    create.mutate(
      { report_key: "orders_list", params, format },
      { onSuccess: (r) => setExportId(r.export_id) },
    );
  };

  const state = status.data?.status;
  const fileUrl = status.data?.file_url ?? null;
  const ready = state === "ready" && !!fileUrl;
  const failed = state === "failed" || create.isError;
  const busy = create.isPending || state === "processing";

  // One-click download: trigger the save as soon as the export is ready (no second click). The API
  // sends Content-Disposition: attachment, so a plain link navigation downloads the file directly —
  // no cross-origin fetch needed. `downloadedFor` guards against re-firing while polling holds `ready`.
  const downloadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !fileUrl || !exportId || downloadedFor.current === exportId) return;
    downloadedFor.current = exportId;
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = fileUrl.split("/").pop() ?? "orders-export";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [ready, fileUrl, exportId]);

  return (
    <Can permission={EXPORT_PERMISSION}>
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => submit("csv")}
            disabled={busy}
            leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
          >
            Export CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => submit("pdf")}
            disabled={busy}
          >
            Export PDF
          </Button>
        </div>
        <p aria-live="polite" className="text-xs">
          {busy && (
            <span className="text-text-muted">Export is processing — we&apos;ll have it ready shortly.</span>
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
