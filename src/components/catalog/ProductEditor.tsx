"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCreateProduct, useUpdateProduct, useProductStatus, useFamilies, useFilterableAttributes } from "@/lib/api/hooks/useCatalog";
import type { ProductDetail } from "@/lib/api/schemas/catalog";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";
import { VariantMatrix } from "./VariantMatrix";

/**
 * Product editor (catalog-product-editor-fe). General (name/sku/brand/url_key +
 * descriptions), price + sale window, settings (featured/new), status/publish
 * (422 NOT_PUBLISHABLE checklist), and — for configurable products — the variant
 * matrix. Type + family immutable after create; SKU read-only after create; STALE_
 * WRITE (409) reload banner. Full family-driven attribute sections + media upload
 * are flagged as follow-ups. Create defers the POST to the first Save.
 */
export function ProductEditor({
  mode,
  product,
  initial,
}: {
  mode: "create" | "edit";
  product?: ProductDetail;
  initial?: { type: "simple" | "configurable"; family_id?: string; sku?: string };
}) {
  const router = useRouter();
  const create = useCreateProduct();
  const update = useUpdateProduct(product?.id ?? "");
  const statusM = useProductStatus();
  const { data: families } = useFamilies();
  const { data: attributes } = useFilterableAttributes();

  const type = product?.type ?? initial?.type ?? "simple";
  const familyId = product?.family_id ?? initial?.family_id ?? "";

  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? initial?.sku ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [shortDesc, setShortDesc] = useState(product?.short_description ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [basePrice, setBasePrice] = useState(product?.base_price ?? "");
  const [salePrice, setSalePrice] = useState(product?.sale_price ?? "");
  const [saleStart, setSaleStart] = useState(product?.sale_starts_at?.slice(0, 10) ?? "");
  const [saleEnd, setSaleEnd] = useState(product?.sale_ends_at?.slice(0, 10) ?? "");
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? false);
  const [isNew, setIsNew] = useState(product?.is_new ?? false);
  const [metaTitle, setMetaTitle] = useState(product?.meta_title ?? "");
  const [error, setError] = useState<string | null>(null);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [stale, setStale] = useState(false);

  const skuLocked = mode === "edit";
  const field = "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";
  const familyLabel = families?.find((f) => f.id === familyId)?.name ?? familyId;

  function buildBody(): Record<string, unknown> {
    return {
      type, family_id: familyId || undefined,
      name: name.trim(), brand: brand.trim() || undefined,
      short_description: shortDesc.trim() || undefined, description: description.trim() || undefined,
      base_price: basePrice || undefined,
      sale_price: salePrice.trim() || undefined,
      sale_starts_at: saleStart ? `${saleStart}T00:00:00Z` : undefined,
      sale_ends_at: saleEnd ? `${saleEnd}T23:59:59Z` : undefined,
      is_featured: isFeatured, is_new: isNew,
      meta_title: metaTitle.trim() || undefined,
    };
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) { setError("Name must be at least 2 characters."); return; }
    if (salePrice && basePrice && Number(salePrice) >= Number(basePrice)) { setError("Sale price must be less than the base price."); return; }
    try {
      if (mode === "create") {
        const res = await create.mutateAsync({ ...buildBody(), sku: sku.trim() });
        toast("Product saved.");
        router.replace(`/admin/products/${(res as { id: string }).id}`);
      } else {
        await update.mutateAsync({ ...buildBody(), updated_at: product?.updated_at });
        toast("Product saved.");
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "STALE_WRITE") setStale(true);
      else if (err instanceof ApiError && err.status === 409) setError("That SKU already exists.");
      else if (err instanceof ApiError && err.status === 400) setError("Check the fields — a required value may be missing or invalid.");
      else setError("Something went wrong. Try again.");
    }
  }

  async function onPublish() {
    if (!product) return;
    setPublishErrors([]);
    try {
      await statusM.mutateAsync({ id: product.id, status: "published" });
      toast("Product published.");
      router.push("/admin/products");
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_PUBLISHABLE") {
        const lines = (err.details ?? []).map((d) => d.message);
        setPublishErrors(lines.length ? lines : ["Add an image, an enabled variant, and all required attributes."]);
      } else toast("Couldn't publish. Try again.", "error");
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <form onSubmit={onSave} className="max-w-3xl space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{mode === "create" ? "New product" : product?.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600" title="To use a different family, create a new product.">{type}</span>
            {familyLabel && <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600">{familyLabel}</span>}
            {product && <span className={"rounded-full px-2 py-0.5 font-medium " + (product.status === "published" ? "bg-green-50 text-green-700" : product.status === "archived" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600")}>{product.status}</span>}
          </div>
        </div>
        {product && product.status === "draft" && (
          <button type="button" onClick={onPublish} disabled={statusM.isPending} className="h-10 rounded-md border border-green-300 px-4 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50">Publish</button>
        )}
      </div>

      {stale && <div role="alert" className="flex items-center justify-between gap-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">This product changed since you opened it. Reload to see the latest.<button type="button" onClick={() => router.refresh()} className="font-medium underline">Reload</button></div>}
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {publishErrors.length > 0 && (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <p className="font-medium">This product can&apos;t be published yet:</p>
          <ul className="mt-1 list-disc pl-5">{publishErrors.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      )}

      {/* General */}
      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">General</h2>
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Name *</span><input className={field} value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">SKU {skuLocked && <span className="text-gray-400">(locked)</span>}</span><input className={field + (skuLocked ? " bg-gray-50 text-gray-500" : "")} value={sku} onChange={(e) => setSku(e.target.value)} readOnly={skuLocked} /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Brand</span><input className={field} value={brand} onChange={(e) => setBrand(e.target.value)} /></label>
        </div>
        {product?.slug && <p className="text-xs text-gray-400">URL key: /{product.slug} (generated from the name)</p>}
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Short description</span><input className={field} value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Description</span><textarea className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <p className="text-xs text-gray-400">Family-driven attribute sections render here once the BE serves the family&apos;s groups — flagged.</p>
      </section>

      {/* Price */}
      <section className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:grid-cols-2">
        <h2 className="text-base font-semibold text-gray-900 sm:col-span-2">Price</h2>
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Base price (৳) *</span><input className={field} type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Sale price (৳)</span><input className={field} type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="optional" /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Sale starts</span><input className={field} type="date" value={saleStart} onChange={(e) => setSaleStart(e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Sale ends</span><input className={field} type="date" value={saleEnd} onChange={(e) => setSaleEnd(e.target.value)} /></label>
      </section>

      {/* Settings + SEO */}
      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">Settings &amp; SEO</h2>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="h-4 w-4" /> Featured</label>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} className="h-4 w-4" /> New</label>
        </div>
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Meta title</span><input className={field} value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder={name} /></label>
        <p className="text-xs text-gray-400">Image &amp; video upload lands with the media integration — flagged.</p>
      </section>

      {/* Inventory note */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600">
        <h2 className="text-base font-semibold text-gray-900">Inventory</h2>
        <p className="mt-1">Stock quantity is managed in <a href="/admin/inventory" className="font-medium text-brand-700 hover:underline">Inventory</a>.</p>
      </section>

      {/* Variants (configurable only) */}
      {type === "configurable" && (
        <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">Variants</h2>
          {!product ? (
            <p className="text-sm text-gray-500">Save the product first, then generate its variants.</p>
          ) : (
            <VariantMatrix product={product} configurableAttributes={(attributes ?? []).filter((a) => a.is_configurable)} />
          )}
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:pl-72">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3">
          <button type="button" onClick={() => router.push("/admin/products")} className="text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
          <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{pending ? "Saving…" : "Save product"}</button>
        </div>
      </div>
    </form>
  );
}
