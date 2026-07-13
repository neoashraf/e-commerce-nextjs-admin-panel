"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFamilies } from "@/lib/api/hooks/useCatalog";
import { ProductEditor } from "@/components/catalog/ProductEditor";
import { Button, Select } from "@/components/ui";

/**
 * Create-product entry (catalog-product-editor-fe). Normally reached from the
 * Products-list Create dialog (CreateProductDialog), which collects type/family/
 * sku and forwards them as query params — when present we go straight into the
 * family-driven editor in create mode (no orphan drafts; the POST defers to the
 * editor's first Save). For direct navigation (no params) we keep a small inline
 * Type/Family/SKU form as a fallback.
 */
export function NewProductView() {
  const sp = useSearchParams();
  const presetType = sp.get("type") === "configurable" ? "configurable" : sp.get("type") === "simple" ? "simple" : null;
  const presetFamily = sp.get("family") ?? "";
  const presetSku = sp.get("sku") ?? "";
  const hasPreset = !!presetType && !!presetFamily && !!presetSku;

  const { data: families } = useFamilies();
  const [type, setType] = useState<"simple" | "configurable">(presetType ?? "simple");
  const [familyId, setFamilyId] = useState(presetFamily);
  const [sku, setSku] = useState(presetSku);
  const [started, setStarted] = useState(false);

  if (hasPreset) {
    return <ProductEditor mode="create" initial={{ type: presetType, family_id: presetFamily, sku: presetSku }} />;
  }
  if (started) {
    return <ProductEditor mode="create" initial={{ type, family_id: familyId || undefined, sku: sku || undefined }} />;
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-bold text-text">New product</h1>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-text">Type</span>
        <Select value={type} onChange={(e) => setType(e.target.value as "simple" | "configurable")}>
          <option value="simple">Simple</option>
          <option value="configurable">Configurable (has variants)</option>
        </Select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-text">Attribute family</span>
        <Select value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
          <option value="">Choose a family…</option>
          {families?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </Select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-text">SKU</span>
        <input
          className="h-9 w-full rounded-md border border-border-strong bg-surface px-3 font-mono text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="PRED-ELITE"
        />
      </label>
      <p className="text-xs text-text-muted">Type and family can&apos;t be changed after the product is created.</p>
      <Button disabled={!familyId || !sku.trim()} onClick={() => setStarted(true)}>Continue</Button>
    </div>
  );
}
