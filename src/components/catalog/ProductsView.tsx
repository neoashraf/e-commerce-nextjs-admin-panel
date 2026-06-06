"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useProducts, useProductStatus, useDeleteProduct, useFamilies } from "@/lib/api/hooks/useCatalog";
import type { ProductRow, ProductStatus } from "@/lib/api/schemas/catalog";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { formatBDT } from "@/lib/format";
import { toast } from "@/lib/stores/toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Products list (products-list.md, catalog-products-list-fe). Rich rows
 * (thumbnail, name/sku/family, ৳ price, live INV qty, status badge, category,
 * type pill); URL-reflected search + status/family/type filters + per-page;
 * row actions (publish/archive/delete) with NOT_PUBLISHABLE (422) +
 * PRODUCT_IN_ORDER (409) guards. Create/Edit link to the editor (AFW3).
 */
const STATUS_STYLE: Record<ProductStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  published: "bg-green-50 text-green-700",
  archived: "bg-amber-50 text-amber-700",
};

export function ProductsView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "";
  const family = sp.get("family") ?? "";
  const type = sp.get("type") ?? "";
  const q = sp.get("q") ?? "";

  const { data, isLoading, isError, refetch } = useProducts({
    q: q || undefined, status: status || undefined, family: family || undefined, type: type || undefined, page: 1, limit: 50,
  });
  const { data: families } = useFamilies();
  const statusM = useProductStatus();
  const del = useDeleteProduct();
  const [confirm, setConfirm] = useState<{ kind: "archive" | "delete"; product: ProductRow } | null>(null);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  async function publish(p: ProductRow) {
    try {
      await statusM.mutateAsync({ id: p.id, status: "published" });
      toast("Product published.");
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_PUBLISHABLE") {
        toast("Can't publish yet — add an image, an enabled variant, and required attributes first.", "error");
      } else {
        toast("Couldn't publish. Try again.", "error");
      }
    }
  }
  async function runConfirm() {
    if (!confirm) return;
    try {
      if (confirm.kind === "archive") {
        await statusM.mutateAsync({ id: confirm.product.id, status: "archived" });
        toast("Product archived.");
      } else {
        await del.mutateAsync(confirm.product.id);
        toast("Product deleted.");
      }
      setConfirm(null);
    } catch (err) {
      setConfirm(null);
      if (err instanceof ApiError && err.code === "PRODUCT_IN_ORDER") {
        toast("This product is in an order and can't be deleted. Archive it instead.", "error");
      } else {
        toast("Something went wrong. Try again.", "error");
      }
    }
  }

  const inp = "h-10 rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Products</h1>
        <Can permission="catalog.product.create">
          <Link href="/admin/products/new" className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Create product</Link>
        </Can>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input className={inp + " w-64"} placeholder="Search name or SKU…" defaultValue={q} onKeyDown={(e) => e.key === "Enter" && setParam("q", (e.target as HTMLInputElement).value)} />
        <select className={inp} value={status} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select className={inp} value={family} onChange={(e) => setParam("family", e.target.value)}>
          <option value="">All families</option>
          {families?.map((f) => <option key={f.id} value={f.code}>{f.name}</option>)}
        </select>
        <select className={inp} value={type} onChange={(e) => setParam("type", e.target.value)}>
          <option value="">All types</option>
          <option value="simple">Simple</option>
          <option value="configurable">Configurable</option>
        </select>
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">Couldn&apos;t load products.</p>
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button>
        </div>
      ) : !data || data.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">No products match your filters.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-4 font-medium">Product</th>
              <th className="py-2 pr-4 font-medium">Price</th>
              <th className="py-2 pr-4 font-medium">Qty</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Category</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded bg-gray-100">
                      {p.primary_image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.primary_image} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <Link href={`/admin/products/${p.id}`} className="block truncate font-medium text-gray-900 hover:text-brand-700">{p.name}</Link>
                      <span className="block truncate text-xs text-gray-400">{p.sku ?? "—"}{p.family ? ` · ${p.family}` : ""}</span>
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-gray-700">{p.base_price ? formatBDT(Number(p.base_price)) : "—"}</td>
                <td className="py-3 pr-4">{p.qty == null ? <span title="Stock unavailable" className="text-gray-300">—</span> : <span className="text-gray-700">{p.qty}</span>}</td>
                <td className="py-3 pr-4"><span className={"rounded-full px-2 py-0.5 text-xs font-medium " + STATUS_STYLE[p.status]}>{p.status}</span></td>
                <td className="py-3 pr-4 text-gray-600">{p.primary_category ?? "—"}</td>
                <td className="py-3 pr-4"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{p.type ?? "simple"}</span></td>
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <Can permission="catalog.product.update">
                      <Link href={`/admin/products/${p.id}`} className="text-sm font-medium text-brand-700 hover:underline">Edit</Link>
                      {p.status === "draft" && <button type="button" onClick={() => publish(p)} className="text-sm font-medium text-green-700 hover:underline">Publish</button>}
                      {p.status === "published" && <button type="button" onClick={() => setConfirm({ kind: "archive", product: p })} className="text-sm font-medium text-amber-700 hover:underline">Archive</button>}
                    </Can>
                    <Can permission="catalog.product.delete">
                      <button type="button" onClick={() => setConfirm({ kind: "delete", product: p })} className="text-sm font-medium text-red-600 hover:underline">Delete</button>
                    </Can>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === "archive" ? "Archive product?" : "Delete product?"}
        message={confirm?.kind === "archive" ? `"${confirm?.product.name}" will be hidden from the storefront but kept for order history.` : `"${confirm?.product.name}" will be deleted.`}
        confirmLabel={confirm?.kind === "archive" ? "Archive" : "Delete"}
        danger
        pending={statusM.isPending || del.isPending}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
