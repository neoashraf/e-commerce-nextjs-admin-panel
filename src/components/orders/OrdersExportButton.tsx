"use client";

import { useState } from "react";
import { z } from "zod";
import { Download } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { Button } from "@/components/ui";
import { orderRowSchema } from "@/lib/api/hooks/useOrdersAdmin";
import { fetchAllRows, buildCsv, downloadCsv, todayStamp } from "@/lib/exportCsv";

/** Export is gated on the reports export permission (parity with the rest of the admin). */
const EXPORT_PERMISSION = "reports.report.export";

/**
 * CSV export for the admin Orders list — done CLIENT-SIDE: fetch every page of the (filtered) orders
 * list and serialize to CSV in the browser, then download. This replaces the async reports-export
 * pipeline (POST /admin/reports/export), which returned status:failed; building the file here is reliable
 * and always matches the on-screen filters. (The async pipeline + Exports manager are kept on the backend.)
 */
export function OrdersExportButton({
  filters,
}: {
  filters: { q?: string; status?: string; payment_state?: string; from?: string; to?: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const onExport = async () => {
    setBusy(true);
    setError(false);
    try {
      const rows = await fetchAllRows(
        "/admin/orders",
        {
          q: filters.q,
          status: filters.status,
          payment_state: filters.payment_state,
          from: filters.from,
          to: filters.to,
        },
        z.array(orderRowSchema),
      );
      const csv = buildCsv(
        ["Order", "Customer", "Phone", "Status", "Payment method", "Payment state", "Total", "Placed at"],
        rows.map((o) => [
          o.order_no,
          o.customer?.name ?? "",
          o.customer?.phone ?? "",
          o.status,
          o.payment_method ?? "",
          o.payment_state ?? "",
          o.grand_total ?? "",
          o.placed_at ?? "",
        ]),
      );
      downloadCsv(`orders-${todayStamp()}.csv`, csv);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
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
          {busy && <span className="text-text-muted">Preparing your CSV…</span>}
          {error && <span className="text-error">Export failed. Try again.</span>}
        </p>
      </div>
    </Can>
  );
}
