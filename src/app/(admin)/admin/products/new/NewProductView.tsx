"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFamilies } from "@/lib/api/hooks/useCatalog";
import { ProductEditor } from "@/components/catalog/ProductEditor";

/**
 * Create-product entry (catalog-product-editor-fe). Normally reached from the
 * products list's Create-product dialog (Products (CAT) design · FR-CAT-010),
 * which passes `type`/`family`/`sku` as query params → we open the family-driven
 * editor straight away (its first Save creates the product — no orphan drafts).
 * A minimal inline form remains as a fallback for direct navigation without params.
 */
export function NewProductView() {
  const sp = useSearchParams();
  const paramType = sp.get("type") === "configurable" ? "configurable" : "simple";
  const paramFamily = sp.get("family") ?? "";
  const paramSku = sp.get("sku") ?? "";
  const hasParams = !!paramFamily && !!paramSku;

  const { data: families } = useFamilies();
  const [type, setType] = useState<"simple" | "configurable">(paramType);
  const [familyId, setFamilyId] = useState(paramFamily);
  const [sku, setSku] = useState(paramSku);
  const [started, setStarted] = useState(hasParams);

  if (started) {
    return <ProductEditor mode="create" initial={{ type, family_id: familyId || undefined, sku: sku || undefined }} />;
  }

  const field = "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-bold text-gray-900">New product</h1>
      <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Type</span>
        <select className={field} value={type} onChange={(e) => setType(e.target.value as "simple" | "configurable")}>
          <option value="simple">Simple</option><option value="configurable">Configurable (has variants)</option>
        </select>
      </label>
      <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Attribute family</span>
        <select className={field} value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
          <option value="">Choose a family…</option>
          {families?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>
      <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">SKU</span><input className={field} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="PRED-ELITE" /></label>
      <p className="text-xs text-gray-400">Type and family can&apos;t be changed after the product is created.</p>
      <button type="button" disabled={!familyId || !sku.trim()} onClick={() => setStarted(true)} className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Continue</button>
    </div>
  );
}
