"use client";

import Link from "next/link";
import { useMovements } from "@/lib/api/hooks/useInventory";
import { formatDateTime } from "@/lib/format";

/**
 * SKU movement ledger (inv-movements-fe). Read-only history of stock movements
 * for one variant (type/delta/resulting/reason/actor). Reached from the stock
 * list. Read-only — no edit/delete (FR-INV-052).
 */
const TYPE_STYLE: Record<string, string> = {
  receive: "text-green-700", adjust: "text-blue-700", sale: "text-gray-600",
  reserve: "text-amber-700", release: "text-amber-700", scrap: "text-red-700", restock: "text-green-700",
};

export function MovementsView({ variantId }: { variantId: string }) {
  const { data, isLoading, isError, refetch } = useMovements(variantId, { page: 1, limit: 100 });

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/inventory" className="text-sm text-brand-700 hover:underline">← Inventory</Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">Stock movements</h1>
        <p className="font-mono text-xs text-gray-400">{variantId}</p>
      </div>

      {isLoading ? <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        : isError ? <div className="py-12 text-center"><p className="text-sm text-gray-600">Couldn&apos;t load movements.</p><button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button></div>
        : !data || data.length === 0 ? <p className="py-12 text-center text-sm text-gray-500">No movements recorded for this SKU.</p>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400"><th className="py-2 pr-4 font-medium">Time</th><th className="py-2 pr-4 font-medium">Type</th><th className="py-2 pr-3 text-right font-medium">Δ</th><th className="py-2 pr-3 text-right font-medium">On hand</th><th className="py-2 pr-4 font-medium">Reason</th><th className="py-2 font-medium">By</th></tr></thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 text-gray-400">{formatDateTime(m.created_at)}</td>
                  <td className={"py-3 pr-4 font-medium " + (TYPE_STYLE[m.type] ?? "text-gray-700")}>{m.type}</td>
                  <td className={"py-3 pr-3 text-right font-medium " + (m.quantity_delta < 0 ? "text-red-600" : "text-green-700")}>{m.quantity_delta > 0 ? "+" : ""}{m.quantity_delta}</td>
                  <td className="py-3 pr-3 text-right text-gray-700">{m.resulting_on_hand ?? "—"}</td>
                  <td className="py-3 pr-4 text-gray-500">{m.reason ?? (m.order_id ? `Order ${m.order_id}` : "—")}</td>
                  <td className="py-3 text-gray-400">{m.actor_type ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}
