"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useInventory, useReceiveStock, useAdjustStock, useEditThreshold } from "@/lib/api/hooks/useInventory";
import type { StockRow, StockStatus } from "@/lib/api/schemas/inventory";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";

/**
 * Inventory stock list (stock-management.md, inv-stock-fe). Rich rows
 * (product/sku/options, on-hand, reserved RO, available, threshold, status
 * badge); URL search + status filter; Receive/Adjust modal (live preview,
 * mandatory reason, NEGATIVE_ON_HAND 409 guard) + Edit-threshold modal. No
 * Create. <Can inventory.stock.*>.
 */
const STATUS: Record<StockStatus, { cls: string; label: string }> = {
  in_stock: { cls: "bg-green-50 text-green-700", label: "In stock" },
  low_stock: { cls: "bg-amber-50 text-amber-700", label: "Low" },
  out_of_stock: { cls: "bg-red-50 text-red-700", label: "Out" },
};

function optionsLabel(o?: Record<string, string> | null) {
  if (!o || Object.keys(o).length === 0) return "";
  return Object.entries(o).map(([k, v]) => `${k}: ${v}`).join(" · ");
}

export function InventoryView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "";
  const q = sp.get("q") ?? "";

  const { data, isLoading, isError, refetch } = useInventory({ q: q || undefined, status: status || undefined, page: 1, limit: 100 });
  const [stockTarget, setStockTarget] = useState<StockRow | null>(null);
  const [thresholdTarget, setThresholdTarget] = useState<StockRow | null>(null);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }
  const inp = "h-10 rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Stock</h1>

      <div className="flex flex-wrap items-center gap-3">
        <input className={inp + " w-64"} placeholder="Search SKU or product…" defaultValue={q} onKeyDown={(e) => e.key === "Enter" && setParam("q", (e.target as HTMLInputElement).value)} />
        <select className={inp} value={status} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low</option>
          <option value="out_of_stock">Out</option>
        </select>
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">Couldn&apos;t load inventory.</p>
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button>
        </div>
      ) : !data || data.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">No stock records match your filters.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-4 font-medium">Product / SKU</th>
              <th className="py-2 pr-3 text-right font-medium">On hand</th>
              <th className="py-2 pr-3 text-right font-medium">Reserved</th>
              <th className="py-2 pr-3 text-right font-medium">Available</th>
              <th className="py-2 pr-3 text-right font-medium">Threshold</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.variant_id} className="border-b border-gray-100">
                <td className="py-3 pr-4">
                  <span className="block font-medium text-gray-900">{r.product_title ?? r.sku_code}</span>
                  <span className="block text-xs text-gray-400">{r.sku_code}{optionsLabel(r.options) ? ` · ${optionsLabel(r.options)}` : ""}</span>
                </td>
                <td className="py-3 pr-3 text-right text-gray-700">{r.on_hand}</td>
                <td className="py-3 pr-3 text-right text-gray-400">{r.reserved}</td>
                <td className={"py-3 pr-3 text-right " + (r.available < 0 ? "font-semibold text-red-600" : "text-gray-700")}>{r.available}{r.available < 0 && <span title="Negative stock" className="ml-1">●</span>}</td>
                <td className="py-3 pr-3 text-right text-gray-500">{r.low_stock_threshold}</td>
                <td className="py-3 pr-4"><span className={"rounded-full px-2 py-0.5 text-xs font-medium " + STATUS[r.status].cls}>{STATUS[r.status].label}</span></td>
                <td className="py-3">
                  <Can permission="inventory.stock.adjust">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setStockTarget(r)} className="text-sm font-medium text-brand-700 hover:underline">Receive / Adjust</button>
                      <button type="button" onClick={() => setThresholdTarget(r)} className="text-sm font-medium text-gray-500 hover:underline">Threshold</button>
                    </div>
                  </Can>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {stockTarget && <StockModal row={stockTarget} onClose={() => setStockTarget(null)} />}
      {thresholdTarget && <ThresholdModal row={thresholdTarget} onClose={() => setThresholdTarget(null)} />}
    </div>
  );
}

function StockModal({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const receive = useReceiveStock();
  const adjust = useAdjustStock();
  const [mode, setMode] = useState<"receive" | "adjust">("receive");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const n = Number(qty);
  const valid = reason.trim() && (mode === "receive" ? Number.isInteger(n) && n > 0 : Number.isInteger(n) && n !== 0);
  const resultOnHand = mode === "receive" ? row.on_hand + (Number.isFinite(n) ? n : 0) : row.on_hand + (Number.isFinite(n) ? n : 0);
  const resultAvailable = resultOnHand - row.reserved;

  async function onSave() {
    setError(null);
    try {
      if (mode === "receive") await receive.mutateAsync({ variantId: row.variant_id, quantity: n, reason: reason.trim() });
      else await adjust.mutateAsync({ variantId: row.variant_id, quantity_delta: n, reason: reason.trim() });
      toast("Stock updated.");
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "NEGATIVE_ON_HAND") setError("This adjustment would make on-hand negative.");
      else if (err instanceof ApiError && err.status === 400) setError("Enter a valid quantity and reason.");
      else setError("Something went wrong. Try again.");
    }
  }

  const inp = "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Update stock" className="relative w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-gray-900">{row.sku_code}</h2>
        <p className="text-sm text-gray-500">Current on-hand: {row.on_hand} · reserved: {row.reserved}</p>

        <div className="mt-4 inline-flex rounded-md border border-gray-300 p-0.5 text-sm">
          {(["receive", "adjust"] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setQty(""); setError(null); }} className={"rounded px-3 py-1 font-medium capitalize " + (mode === m ? "bg-brand-600 text-white" : "text-gray-600")}>{m}</button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-gray-900">{mode === "receive" ? "Quantity to receive" : "Quantity delta (±)"}</span>
          <input className={inp} type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={mode === "receive" ? "e.g. 20" : "e.g. -3"} />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Reason</span>
          <input className={inp} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. supplier delivery, stock count" />
        </label>

        <p aria-live="polite" className="mt-3 text-sm text-gray-600">Resulting on-hand: <strong>{resultOnHand}</strong> · available: <strong>{resultAvailable}</strong></p>
        {error && <p role="alert" aria-live="assertive" className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={onSave} disabled={!valid || receive.isPending || adjust.isPending} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  );
}

function ThresholdModal({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const edit = useEditThreshold();
  const [value, setValue] = useState(String(row.low_stock_threshold));
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 0;

  async function onSave() {
    try {
      await edit.mutateAsync({ variantId: row.variant_id, threshold: n });
      toast("Threshold updated.");
      onClose();
    } catch {
      toast("Couldn't update the threshold.", "error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Edit threshold" className="relative w-full max-w-xs rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-gray-900">Low-stock threshold</h2>
        <p className="text-sm text-gray-500">{row.sku_code}</p>
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Threshold</span>
          <input className="h-11 w-full rounded-md border border-gray-300 px-3 text-sm" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
          <span className="mt-1 block text-xs text-gray-400">Status flips to Low when available ≤ this.</span>
        </label>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={onSave} disabled={!valid || edit.isPending} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  );
}
