"use client";

import Link from "next/link";
import { useCoupon } from "@/lib/api/hooks/usePromo";
import { CouponEditor } from "@/components/promo/CouponEditor";

export function EditCouponView({ id }: { id: string }) {
  const { data, isLoading, isError } = useCoupon(id);
  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
  if (isError || !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-600">We couldn&apos;t find that coupon.</p>
        <Link href="/admin/promotions" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">Back to coupons</Link>
      </div>
    );
  }
  return <CouponEditor mode="edit" coupon={data} />;
}
