"use client";

import { Download } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { Button } from "@/components/ui";
import { useAsyncExport } from "@/lib/api/hooks/reports";

/** Export is gated on the reports export permission (parity with the rest of the admin). */
const EXPORT_PERMISSION = "reports.report.export";

/** Map the stock-list status filter to the inventory report's `view` (low/out get dedicated views). */
function statusToView(status?: string): string {
  if (status === "low_stock") return "low_stock";
  if (status === "out_of_stock") return "out_of_stock";
  return "levels";
}

/**
 * CSV export for the admin Stock list — runs through the async reports-export pipeline
 * (POST /admin/reports/export, report `inventory`), so the file is tracked in the Exports manager
 * (MANAGE › Exports) and auto-downloads when ready. The status filter maps to the report `view`
 * (levels / low_stock / out_of_stock).
 */
export function StockExportButton({ status, q }: { status?: string; q?: string }) {
  const { start, busy, failed, reason } = useAsyncExport();

  const onExport = () => {
    const params: Record<string, string> = { view: statusToView(status) };
    if (q) params.q = q;
    start({ report_key: "inventory", params, format: "csv" });
  };

  return (
    <Can permission={EXPORT_PERMISSION}>
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={onExport}
          disabled={busy}
          leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
        >
          {busy ? "Exporting…" : "Export CSV"}
        </Button>
        <p aria-live="polite" className="text-xs">
          {busy && <span className="text-text-muted">Preparing your CSV — it&apos;ll download and appear in Exports.</span>}
          {failed && (
            <span className="text-error">{reason ? `Export failed: ${reason}` : "Export failed. Try again."}</span>
          )}
        </p>
      </div>
    </Can>
  );
}
