"use client";

import Link from "next/link";
import { useCoupon } from "@/lib/api/hooks/usePromo";
import { CouponEditor } from "@/components/promo/CouponEditor";
import { ApiError } from "@/lib/api/errors";

export function EditCouponView({ id }: { id: string }) {
  const { data, isLoading, isError, error } = useCoupon(id);
  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
  if (isError || !data) {
    // A schema mismatch is NOT a missing coupon — reporting it as "couldn't find that coupon" sent
    // us hunting for deleted rows when the real cause was the API returning the wrong field shape.
    const mismatch = error instanceof ApiError && error.code === "CONTRACT_MISMATCH";
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-600">
          {mismatch
            ? "This coupon couldn't be loaded — the API returned an unexpected shape."
            : "We couldn't find that coupon."}
        </p>
        <Link href="/admin/promotions" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">Back to coupons</Link>
      </div>
    );
  }
  return <CouponEditor mode="edit" coupon={data} />;
}
