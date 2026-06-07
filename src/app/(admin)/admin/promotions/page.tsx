import { Suspense } from "react";
import { CouponsView } from "@/components/promo/CouponsView";

/** Coupons list — /admin/promotions (promo-coupons-fe). */
export default function PromotionsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
      <CouponsView />
    </Suspense>
  );
}
