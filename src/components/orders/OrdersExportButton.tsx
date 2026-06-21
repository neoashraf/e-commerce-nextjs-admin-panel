"use client";

import { Download } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { Button } from "@/components/ui";
import { useAsyncExport } from "@/lib/api/hooks/reports";

/** Export is gated on the reports export permission (parity with the rest of the admin). */
const EXPORT_PERMISSION = "reports.report.export";

/**
 * CSV export for the admin Orders list — runs through the async reports-export pipeline
 * (POST /admin/reports/export, report `orders_list`), so the file is tracked in the Exports manager
 * (MANAGE › Exports) and auto-downloads when ready. The `orders_list` report honours the same list
 * filters (q / status / payment_state / placed-at range), so the file matches the on-screen list.
 */
export function OrdersExportButton({
  filters,
}: {
  filters: { q?: string; status?: string; payment_state?: string; from?: string; to?: string };
}) {
  const { start, busy, failed, reason } = useAsyncExport();

  const onExport = () => {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v) params[k] = v;
    }
    start({ report_key: "orders_list", params, format: "csv" });
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
