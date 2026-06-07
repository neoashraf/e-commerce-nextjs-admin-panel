import { Suspense } from "react";
import { InventoryView } from "@/components/inventory/InventoryView";

/** Inventory stock — /admin/inventory (inv-stock-fe). Gated by the shell
 * (inventory.stock.read). */
export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
      <InventoryView />
    </Suspense>
  );
}
