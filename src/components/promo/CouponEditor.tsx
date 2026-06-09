"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCreateCoupon, useUpdateCoupon } from "@/lib/api/hooks/usePromo";
import type { CouponDetail } from "@/lib/api/schemas/promo";
import { ApiError } from "@/lib/api/errors";

/**
 * Coupon editor (promo-coupons-fe). Code (locked on edit), discount type/value,
 * caps (max discount, min subtotal), validity window, usage/per-customer
 * limits, first-order-only, eligibility scope, active. 409 dup-code inline.
 * CAT category/product pickers flagged.
 */
export function CouponEditor({ mode, coupon }: { mode: "create" | "edit"; coupon?: CouponDetail }) {
  const router = useRouter();
  const create = useCreateCoupon();
  const update = useUpdateCoupon(coupon?.id ?? "");

  const [code, setCode] = useState(coupon?.code ?? "");
  const [description, setDescription] = useState(coupon?.description ?? "");
  const [type, setType] = useState(coupon?.discount_type ?? "fixed");
  const [value, setValue] = useState(coupon?.value ?? "");
  const [maxDiscount, setMaxDiscount] = useState(coupon?.max_discount_amount ?? "");
  const [minSubtotal, setMinSubtotal] = useState(coupon?.min_order_subtotal ?? "");
  const [startsAt, setStartsAt] = useState(coupon?.starts_at?.slice(0, 10) ?? "");
  const [endsAt, setEndsAt] = useState(coupon?.ends_at?.slice(0, 10) ?? "");
  const [usageLimit, setUsageLimit] = useState(coupon?.total_usage_limit != null ? String(coupon.total_usage_limit) : "");
  const [perCustomer, setPerCustomer] = useState(coupon?.per_customer_limit != null ? String(coupon.per_customer_limit) : "");
  const [firstOnly, setFirstOnly] = useState(coupon?.first_order_only ?? false);
  const [active, setActive] = useState(coupon?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);

  const codeLocked = mode === "edit";
  const isFreeShip = type === "free_shipping";
  const field = "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "create" && code.trim().length < 3) { setError("Coupon code is required."); return; }
    if (!isFreeShip && (!value || Number(value) <= 0)) { setError("Enter a discount value."); return; }
    const body = {
      description: description.trim() || undefined,
      discount_type: type,
      value: isFreeShip ? "0" : value,
      max_discount_amount: maxDiscount.trim() || undefined,
      min_order_subtotal: minSubtotal.trim() || undefined,
      starts_at: startsAt ? `${startsAt}T00:00:00Z` : undefined,
      ends_at: endsAt ? `${endsAt}T23:59:59Z` : undefined,
      total_usage_limit: usageLimit ? Number(usageLimit) : undefined,
      per_customer_limit: perCustomer ? Number(perCustomer) : undefined,
      first_order_only: firstOnly,
      is_active: active,
    };
    try {
      if (mode === "create") await create.mutateAsync({ ...body, code: code.trim().toUpperCase() });
      else await update.mutateAsync(body);
      router.push("/admin/promotions");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError("That code already exists.");
      else if (err instanceof ApiError && err.status === 400) setError("Check the values — e.g. percentage must be 0–100.");
      else setError("Something went wrong. Try again.");
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <form onSubmit={onSave} className="max-w-2xl space-y-5">
      <h1 className="text-xl font-bold text-gray-900">{mode === "create" ? "New coupon" : `Edit ${coupon?.code}`}</h1>
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Code {codeLocked && <span className="text-gray-400">(locked)</span>}</span><input className={field + (codeLocked ? " bg-gray-50 text-gray-500" : "")} value={code} onChange={(e) => setCode(e.target.value)} readOnly={codeLocked} placeholder="BOOT10" /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Discount type</span>
            <select className={field} value={type} onChange={(e) => setType(e.target.value as CouponDetail["discount_type"])}>
              <option value="fixed">Fixed (৳)</option>
              <option value="percentage">Percentage (%)</option>
              <option value="free_shipping">Free shipping</option>
            </select>
          </label>
        </div>
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Description</span><input className={field} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        {!isFreeShip && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">{type === "percentage" ? "Percentage" : "Amount (৳)"}</span><input className={field} type="number" value={value} onChange={(e) => setValue(e.target.value)} /></label>
            {type === "percentage" && <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Max discount (৳)</span><input className={field} type="number" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="optional cap" /></label>}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Min order subtotal (৳)</span><input className={field} type="number" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} placeholder="optional" /></label>
        <div />
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Starts</span><input className={field} type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Ends</span><input className={field} type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Total usage limit</span><input className={field} type="number" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="unlimited" /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Per-customer limit</span><input className={field} type="number" value={perCustomer} onChange={(e) => setPerCustomer(e.target.value)} placeholder="unlimited" /></label>
      </section>

      <section className="flex flex-wrap items-center gap-6 rounded-lg border border-gray-200 bg-white p-5">
        <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={firstOnly} onChange={(e) => setFirstOnly(e.target.checked)} className="h-4 w-4" /> First order only</label>
        <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4" /> Active</label>
        <span className="text-xs text-gray-400">Category/product eligibility pickers land with the CAT picker integration — flagged.</span>
      </section>

      <div className="mt-2">
        <div className="mx-auto flex max-w-2xl items-center justify-end gap-3">
          <button type="button" onClick={() => router.push("/admin/promotions")} className="text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
          <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{pending ? "Saving…" : mode === "create" ? "Create coupon" : "Save changes"}</button>
        </div>
      </div>
    </form>
  );
}
