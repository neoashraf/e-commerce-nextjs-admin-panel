import { EditCouponView } from "./EditCouponView";

/** Coupon editor — /admin/promotions/<id> (promo-coupons-fe). */
export default function EditCouponPage({ params }: { params: { id: string } }) {
  return <EditCouponView id={params.id} />;
}
