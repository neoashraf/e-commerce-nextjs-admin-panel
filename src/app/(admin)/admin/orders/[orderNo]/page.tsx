import { OrderDetailAdminView } from "@/components/orders/OrderDetailAdminView";

/** Admin order detail — /admin/orders/<orderNo> (ord-admin-fe). */
export default function AdminOrderDetailPage({ params }: { params: { orderNo: string } }) {
  return <OrderDetailAdminView orderNo={params.orderNo} />;
}
