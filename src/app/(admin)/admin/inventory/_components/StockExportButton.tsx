"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { Button } from "@/components/ui";
import { stockListSchema } from "@/lib/api/schemas/inventory";
import { fetchAllRows, buildCsv, downloadCsv, todayStamp } from "@/lib/exportCsv";

/** Export is gated on the reports export permission (parity with the rest of the admin). */
const EXPORT_PERMISSION = "reports.report.export";

/** Render a variant's options map ({Color:"Black", Size:"M"}) as "Color: Black · Size: M". */
function optionsLabel(options: Record<string, string> | null | undefined): string {
  if (!options) return "";
  return Object.entries(options)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

/**
 * Export the stock list to CSV — done CLIENT-SIDE: fetch every page of the (filtered) inventory list
 * and serialize to CSV in the browser, then download. Replaces the async reports-export pipeline
 * (POST /admin/reports/export, report `inventory`), which returned status:failed; building the file
 * here is reliable and always matches the on-screen search + status filter.
 */
export function StockExportButton({ status, q }: { status?: string; q?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const onExport = async () => {
    setBusy(true);
    setError(false);
    try {
      const rows = await fetchAllRows("/admin/inventory", { q, status }, stockListSchema);
      const csv = buildCsv(
        ["SKU", "Product", "Options", "On-hand", "Reserved", "Available", "Low-stock threshold", "Status"],
        rows.map((r) => [
          r.sku_code,
          r.product_title ?? "",
          optionsLabel(r.options),
          r.on_hand,
          r.reserved,
          r.available,
          r.low_stock_threshold,
          r.status,
        ]),
      );
      downloadCsv(`stock-${todayStamp()}.csv`, csv);
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
