"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGenerateVariants, useUpdateVariant, useAttribute } from "@/lib/api/hooks/useCatalog";
import { useBulkInventory } from "@/lib/api/hooks/useInventory";
import type { ProductDetail, ProductVariant, AttributeRow } from "@/lib/api/schemas/catalog";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";
import { Can } from "@/lib/permissions/Can";

/**
 * Variant matrix (catalog-product-editor-fe, configurable products). Axis
 * pickers (each configurable attribute → multi-select of its options) →
 * "Generate variants" (POST, appends new combinations) → editable grid
 * (sku_code, price_override, is_enabled). Per-row edits PATCH the variant. 409
 * SKU-collision surfaced.
 */
export function VariantMatrix({ product, configurableAttributes }: { product: ProductDetail; configurableAttributes: AttributeRow[] }) {
  const generate = useGenerateVariants(product.id);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [genError, setGenError] = useState<string | null>(null);

  const chosenAxes = configurableAttributes.filter((a) => (selected[a.code]?.length ?? 0) > 0);

  async function onGenerate() {
    setGenError(null);
    const configurable_attributes = chosenAxes.map((a) => ({ code: a.code, option_ids: selected[a.code] }));
    try {
      const res = await generate.mutateAsync({ configurable_attributes });
      toast(`${(res as { variants_created?: number }).variants_created ?? 0} variants created.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setGenError("A generated SKU already exists — edit the code in the grid.");
      else setGenError("Couldn't generate variants. Try again.");
    }
  }

  return (
    <div className="space-y-4">
      {configurableAttributes.length === 0 ? (
        <p className="text-sm text-gray-500">This product&apos;s family has no configurable attributes (e.g. colour/size).</p>
      ) : (
        <div className="space-y-3 rounded-md bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-700">Choose the variant axes</p>
          {configurableAttributes.map((a) => (
            <AxisPicker key={a.id} attribute={a} selected={selected[a.code] ?? []} onChange={(ids) => setSelected((s) => ({ ...s, [a.code]: ids }))} />
          ))}
          <button type="button" onClick={onGenerate} disabled={chosenAxes.length === 0 || generate.isPending} className="inline-flex h-9 items-center rounded-md bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">{generate.isPending ? "Generating…" : "Generate variants"}</button>
          {genError && <p role="alert" className="text-sm text-red-600">{genError}</p>}
        </div>
      )}

      {product.variants.length === 0 ? (
        <p className="text-sm text-gray-400">No variants yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400"><th className="py-2 pr-4 font-medium">SKU</th><th className="py-2 pr-4 font-medium">Options</th><th className="py-2 pr-4 font-medium">Stock</th><th className="py-2 pr-4 font-medium">Price override</th><th className="py-2 font-medium">Enabled</th></tr></thead>
          <tbody>{product.variants.map((v) => <VariantRow key={v.id} productId={product.id} variant={v} />)}</tbody>
        </table>
      )}
    </div>
  );
}

function AxisPicker({ attribute, selected, onChange }: { attribute: AttributeRow; selected: string[]; onChange: (ids: string[]) => void }) {
  const { data } = useAttribute(attribute.id);
  const options = data?.options ?? [];
  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">{attribute.admin_label}</p>
      <div className="flex flex-wrap gap-2">
        {options.length === 0 ? <span className="text-xs text-gray-400">No options.</span> : options.map((o) => (
          <button key={o.value} type="button" onClick={() => toggle(o.value)} className={"rounded-full border px-3 py-1 text-xs font-medium " + (selected.includes(o.value) ? "border-brand-600 bg-brand-600 text-white" : "border-gray-300 text-gray-700")}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

function VariantRow({ productId, variant }: { productId: string; variant: ProductVariant }) {
  const update = useUpdateVariant(productId);
  const bulkStock = useBulkInventory();
  const qc = useQueryClient();
  const [sku, setSku] = useState(variant.sku_code);
  const [price, setPrice] = useState(variant.price ?? "");
  const [enabled, setEnabled] = useState(variant.is_enabled);
  const [stock, setStock] = useState(String(variant.on_hand ?? 0));

  function save(body: Record<string, unknown>) {
    update.mutate({ variantId: variant.id, body }, { onError: () => toast("Couldn't save the variant.", "error") });
  }

  // Stock lives in INV: set the absolute on-hand by SKU (so a stale read can't drift the value),
  // then refresh the product so the matrix reflects the new level.
  async function saveStock() {
    const target = Number(stock);
    if (!Number.isInteger(target) || target < 0) {
      setStock(String(variant.on_hand ?? 0));
      toast("Stock must be a whole number ≥ 0.", "error");
      return;
    }
    if (target === (variant.on_hand ?? 0)) return;
    try {
      const res = await bulkStock.mutateAsync([
        { sku_code: variant.sku_code, set_on_hand: target, reason: "Set in product editor" },
      ]);
      if (res.failed > 0) {
        setStock(String(variant.on_hand ?? 0));
        toast(res.errors[0]?.error === "unknown_sku" ? "Save the SKU first, then set stock." : "Couldn't set stock.", "error");
        return;
      }
      toast("Stock updated.");
      qc.invalidateQueries({ queryKey: ["admin-product", productId] });
    } catch {
      setStock(String(variant.on_hand ?? 0));
      toast("Couldn't set stock.", "error");
    }
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 pr-4"><input className="h-8 w-36 rounded border border-gray-300 px-2 font-mono text-xs" value={sku} onChange={(e) => setSku(e.target.value)} onBlur={() => sku !== variant.sku_code && save({ sku_code: sku })} /></td>
      <td className="py-2 pr-4 text-xs text-gray-500">{Object.entries(variant.options).map(([k, v]) => `${k}: ${v}`).join(" · ")}</td>
      <td className="py-2 pr-4">
        <Can permission="inventory.stock.update" fallback={<span className="text-xs text-gray-600">{variant.on_hand ?? 0}</span>}>
          <input className="h-8 w-20 rounded border border-gray-300 px-2 text-xs" type="number" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} onBlur={saveStock} disabled={bulkStock.isPending} />
        </Can>
      </td>
      <td className="py-2 pr-4"><input className="h-8 w-24 rounded border border-gray-300 px-2 text-xs" type="number" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => (price || null) !== (variant.price ?? null) && save({ price: price || null })} placeholder="—" /></td>
      <td className="py-2"><input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); save({ is_enabled: e.target.checked }); }} className="h-4 w-4" /></td>
    </tr>
  );
}
