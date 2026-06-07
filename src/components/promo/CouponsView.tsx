"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCoupons, useUpdateCoupon, useDeleteCoupon } from "@/lib/api/hooks/usePromo";
import type { CouponRow } from "@/lib/api/schemas/promo";
import { Can } from "@/lib/permissions/Can";
import { toast } from "@/lib/stores/toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Coupons list (promo-coupons-fe). code/type/value/usage/status; URL search +
 * status filter; activate-toggle + edit + delete. <Can promotions.coupon.*>.
 */
function typeLabel(c: CouponRow): string {
  if (c.discount_type === "free_shipping") return "Free shipping";
  if (c.discount_type === "percentage") return `${c.value}%`;
  return `৳ ${c.value}`;
}

export function CouponsView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "";
  const q = sp.get("q") ?? "";
  const { data, isLoading, isError, refetch } = useCoupons({ q: q || undefined, status: status || undefined, page: 1, limit: 100 });
  const del = useDeleteCoupon();
  const [target, setTarget] = useState<CouponRow | null>(null);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }
  const inp = "h-10 rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Coupons</h1>
        <Can permission="promotions.coupon.create">
          <Link href="/admin/promotions/new" className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">New coupon</Link>
        </Can>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input className={inp + " w-64"} placeholder="Search code…" defaultValue={q} onKeyDown={(e) => e.key === "Enter" && setParam("q", (e.target as HTMLInputElement).value)} />
        <select className={inp} value={status} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="scheduled">Scheduled</option>
          <option value="expired">Expired</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {isLoading ? <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        : isError ? <div className="py-12 text-center"><p className="text-sm text-gray-600">Couldn&apos;t load coupons.</p><button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button></div>
        : !data || data.length === 0 ? <p className="py-12 text-center text-sm text-gray-500">No coupons match your filters.</p>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-4 font-medium">Code</th><th className="py-2 pr-4 font-medium">Discount</th><th className="py-2 pr-4 font-medium">Used</th><th className="py-2 pr-4 font-medium">Status</th><th className="py-2 font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {data.map((c) => <CouponRowItem key={c.id} coupon={c} onDelete={() => setTarget(c)} />)}
            </tbody>
          </table>
        )}

      <ConfirmDialog open={!!target} title="Delete coupon?" message={`"${target?.code}" will be deleted.`} confirmLabel="Delete" danger pending={del.isPending} onConfirm={() => target && del.mutate(target.id, { onSuccess: () => { setTarget(null); toast("Coupon deleted."); } })} onClose={() => setTarget(null)} />
    </div>
  );

  function CouponRowItem({ coupon, onDelete }: { coupon: CouponRow; onDelete: () => void }) {
    const update = useUpdateCoupon(coupon.id);
    return (
      <tr className="border-b border-gray-100">
        <td className="py-3 pr-4 font-mono text-xs font-medium text-gray-900">{coupon.code}</td>
        <td className="py-3 pr-4 text-gray-700">{typeLabel(coupon)}</td>
        <td className="py-3 pr-4 text-gray-500">{coupon.total_used ?? 0}{coupon.total_usage_limit ? ` / ${coupon.total_usage_limit}` : ""}</td>
        <td className="py-3 pr-4"><span className={"rounded-full px-2 py-0.5 text-xs font-medium " + (coupon.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500")}>{coupon.status ?? (coupon.is_active ? "active" : "inactive")}</span></td>
        <td className="py-3">
          <Can permission="promotions.coupon.update">
            <div className="flex items-center gap-3">
              <Link href={`/admin/promotions/${coupon.id}`} className="text-sm font-medium text-brand-700 hover:underline">Edit</Link>
              <button type="button" onClick={() => update.mutate({ is_active: !coupon.is_active }, { onSuccess: () => toast(coupon.is_active ? "Coupon deactivated." : "Coupon activated.") })} className={"text-sm font-medium " + (coupon.is_active ? "text-amber-700" : "text-green-700")}>{coupon.is_active ? "Deactivate" : "Activate"}</button>
              <Can permission="promotions.coupon.delete"><button type="button" onClick={onDelete} className="text-sm font-medium text-red-600 hover:underline">Delete</button></Can>
            </div>
          </Can>
        </td>
      </tr>
    );
  }
}
