import { OrderDrawer } from "@/components/orders/OrderDrawer";

/**
 * Intercepting route — when a row on /admin/orders links to /admin/orders/[orderNo],
 * this `(.)[orderNo]` match renders the detail as a Drawer over the list (AD3),
 * URL-addressable. A direct load / refresh bypasses the interception and falls
 * back to the full-page [orderNo]/page.tsx.
 */
export default function InterceptedOrderPage({
  params,
}: {
  params: { orderNo: string };
}) {
  return <OrderDrawer orderNo={params.orderNo} />;
}
