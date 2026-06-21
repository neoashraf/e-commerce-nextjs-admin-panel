"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useCoupons, useUpdateCoupon, useDeleteCoupon } from "@/lib/api/hooks/usePromo";
import type { CouponRow } from "@/lib/api/schemas/promo";
import { Can } from "@/lib/permissions/Can";
import { toast } from "@/lib/stores/toast";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  SkeletonRows,
  StatusPill,
  Table,
  TablePagination,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";

/**
 * Coupons list (promo-coupons-fe) on the AD6 Data Table primitive (design-system
 * §8.6): Card-wrapped table, eyebrow headers, StatusPill, right-aligned usage, and
 * a 15/page paginated footer backed by the API `meta.total`. Search + status
 * filter + `page` URL-reflected; activate-toggle + edit + delete. Presentation +
 * pagination only.
 */
const PAGE_SIZE = DEFAULT_PAGE_SIZE;

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
  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);

  const { data, isLoading, isError, refetch } = useCoupons({ q: q || undefined, status: status || undefined, page, limit: PAGE_SIZE });
  const del = useDeleteCoupon();
  const [target, setTarget] = useState<CouponRow | null>(null);

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page"); // filter/search change → back to page 1
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold leading-7 text-text">Coupons</h1>
        <Can permission="promotions.coupon.create">
          <Link
            href="/admin/promotions/new"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent-600 px-4 text-sm font-medium text-accent-fg shadow-xs transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
          >
            New coupon
          </Link>
        </Can>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <Input
            leadingIcon={<Search className="h-4 w-4" />}
            placeholder="Search code…"
            aria-label="Search coupons"
            defaultValue={q}
            onKeyDown={(e) => e.key === "Enter" && setParam("q", (e.target as HTMLInputElement).value)}
          />
        </div>
        <div className="w-40">
          <Select aria-label="Status" value={status} onChange={(e) => setParam("status", e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="expired">Expired</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <SkeletonRows rows={10} cols={5} />
        ) : isError ? (
          <ErrorState description="Couldn't load coupons." onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No coupons match your filters." description="Try clearing search or the status filter." />
        ) : (
          <>
            <Table>
              <THead>
                <TR hover={false}>
                  <TH>Code</TH>
                  <TH>Discount</TH>
                  <TH numeric>Used</TH>
                  <TH>Status</TH>
                  <TH className="text-right"><span className="sr-only">Actions</span></TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((c) => <CouponRowItem key={c.id} coupon={c} onDelete={() => setTarget(c)} />)}
              </TBody>
            </Table>
            <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={(p) => setParam("page", String(p))} />
          </>
        )}
      </Card>

      <ConfirmDialog open={!!target} title="Delete coupon?" message={`"${target?.code}" will be deleted.`} confirmLabel="Delete" danger pending={del.isPending} onConfirm={() => target && del.mutate(target.id, { onSuccess: () => { setTarget(null); toast("Coupon deleted."); } })} onClose={() => setTarget(null)} />
    </div>
  );
}

function CouponRowItem({ coupon, onDelete }: { coupon: CouponRow; onDelete: () => void }) {
  const update = useUpdateCoupon(coupon.id);
  return (
    <TR>
      <TD className="font-mono text-xs font-medium text-text">{coupon.code}</TD>
      <TD>{typeLabel(coupon)}</TD>
      <TD numeric>{coupon.total_used ?? 0}{coupon.total_usage_limit ? ` / ${coupon.total_usage_limit}` : ""}</TD>
      <TD><StatusPill status={coupon.status ?? (coupon.is_active ? "active" : "inactive")} /></TD>
      <TD className="text-right">
        <Can permission="promotions.coupon.update">
          <div className="flex items-center justify-end gap-3">
            <Link href={`/admin/promotions/${coupon.id}`} className="text-sm font-medium text-accent-700 hover:underline">Edit</Link>
            <button type="button" onClick={() => update.mutate({ is_active: !coupon.is_active }, { onSuccess: () => toast(coupon.is_active ? "Coupon deactivated." : "Coupon activated.") })} className={"text-sm font-medium hover:underline " + (coupon.is_active ? "text-warning" : "text-success")}>{coupon.is_active ? "Deactivate" : "Activate"}</button>
            <Can permission="promotions.coupon.delete"><button type="button" onClick={onDelete} className="text-sm font-medium text-error hover:underline">Delete</button></Can>
          </div>
        </Can>
      </TD>
    </TR>
  );
}
