import { Suspense } from "react";
import { OrdersView } from "@/components/orders/OrdersView";

/** Orders list — /admin/orders (ord-admin-fe). */
export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
      <OrdersView />
    </Suspense>
  );
}
