"use client";

import Link from "next/link";
import { useState } from "react";
import { useBulkInventory, type BulkResult } from "@/lib/api/hooks/useInventory";
import { Can } from "@/lib/permissions/Can";

/**
 * Bulk stock import (inv-bulk-fe). Paste CSV (sku_code,set_on_hand,
 * low_stock_threshold,reason) → parse → POST /admin/inventory/bulk → row-level
 * result summary (processed/succeeded/failed + per-row errors). File upload is a
 * flagged follow-up.
 */
type Row = { sku_code: string; set_on_hand?: number; low_stock_threshold?: number; reason?: string };

function parseCsv(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  // Optional header detection.
  const start = /sku/i.test(lines[0]) && /on_hand|threshold/i.test(lines[0]) ? 1 : 0;
  return lines.slice(start).map((line) => {
    const [sku, on, thr, reason] = line.split(",").map((c) => c.trim());
    const row: Row = { sku_code: sku };
    if (on !== "" && on != null) row.set_on_hand = Number(on);
    if (thr !== "" && thr != null) row.low_stock_threshold = Number(thr);
    if (reason) row.reason = reason;
    return row;
  }).filter((r) => r.sku_code);
}

export function BulkImportView() {
  const bulk = useBulkInventory();
  const [text, setText] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const rows = parseCsv(text);

  async function run() {
    setResult(null);
    const res = await bulk.mutateAsync(rows);
    setResult(res as BulkResult);
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/inventory" className="text-sm text-brand-700 hover:underline">← Inventory</Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">Bulk stock import</h1>
      </div>

      <Can permission="inventory.stock.adjust" fallback={<p className="text-sm text-gray-500">You don&apos;t have permission to import stock.</p>}>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Paste CSV rows: <code className="rounded bg-gray-100 px-1">sku_code,set_on_hand,low_stock_threshold,reason</code> (one per line). Direct file upload is a flagged follow-up.</p>
          <textarea value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} rows={8} className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm" placeholder="PRED-BLK-42,30,5,stock_take_2026Q2" />
          <div className="flex items-center gap-3">
            <button type="button" onClick={run} disabled={rows.length === 0 || bulk.isPending} className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{bulk.isPending ? "Importing…" : `Import ${rows.length} row(s)`}</button>
            {bulk.isError && <span role="alert" className="text-sm text-red-600">Import failed. Check the format and try again.</span>}
          </div>
        </div>
      </Can>

      {result && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm"><span className="font-semibold text-gray-900">{result.succeeded}</span> succeeded, <span className="font-semibold text-red-600">{result.failed}</span> failed, of {result.processed} processed.</p>
          {result.errors.length > 0 && (
            <table className="mt-3 w-full text-sm">
              <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400"><th className="py-1 pr-4 font-medium">Row</th><th className="py-1 pr-4 font-medium">SKU</th><th className="py-1 font-medium">Error</th></tr></thead>
              <tbody>{result.errors.map((e, i) => <tr key={i} className="border-b border-gray-100"><td className="py-1 pr-4 text-gray-500">{e.row}</td><td className="py-1 pr-4 font-mono text-xs text-gray-700">{e.sku_code ?? "—"}</td><td className="py-1 text-red-600">{e.error}</td></tr>)}</tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
