import { Suspense } from "react";
import { OrdersView } from "@/components/orders/OrdersView";
import { Card, SkeletonRows } from "@/components/ui";

/** Orders list — /admin/orders (ord-admin-fe). */
export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <SkeletonRows rows={8} cols={6} />
        </Card>
      }
    >
      <OrdersView />
    </Suspense>
  );
}
