"use client";

import { useState } from "react";
import { useProducts, useProduct } from "@/lib/api/hooks/useCatalog";
import { formatBDT } from "@/lib/format";

/**
 * Replacement variant picker (ord-exchange-admin-fe, FR-ORD-048). Search a
 * published product → pick one of its variants. Equal/higher value is the rule
 * (the BE rejects lower value with 409 — never cash back); we surface the
 * value relative to the returned item as guidance and disable obviously
 * lower-value variants client-side. The chosen `variant_id` is authoritative.
 */
export function ReplacementPicker({
  originalPrice,
  selectedVariantId,
  onSelect,
}: {
  originalPrice: number | null;
  selectedVariantId: string | null;
  onSelect: (variantId: string, price: number | null, label: string) => void;
}) {
  const [term, setTerm] = useState("");
  const [productId, setProductId] = useState<string | null>(null);

  const products = useProducts({ q: term || undefined, status: "published", limit: 20 });
  const product = useProduct(productId ?? "");

  function variantValue(price: string | null | undefined): number | null {
    if (price == null || price === "") return null;
    const n = Number(price);
    return Number.isNaN(n) ? null : n;
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="repl-search" className="mb-1 block text-xs font-medium text-gray-600">
          Replacement product
        </label>
        <input
          id="repl-search"
          className="h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
          placeholder="Search published products…"
          defaultValue={term}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setProductId(null);
              setTerm((e.target as HTMLInputElement).value.trim());
            }
          }}
        />
        <p className="mt-1 text-xs text-gray-400">Press Enter to search. Equal or higher value only.</p>
      </div>

      {/* Product results */}
      {term && (
        <div className="max-h-40 overflow-auto rounded-md border border-gray-200">
          {products.isLoading ? (
            <div className="h-16 animate-pulse bg-gray-50" />
          ) : products.isError ? (
            <p className="p-3 text-sm text-gray-500">Couldn&apos;t search products.</p>
          ) : !products.data?.data.length ? (
            <p className="p-3 text-sm text-gray-500">No products match &ldquo;{term}&rdquo;.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {products.data.data.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setProductId(p.id)}
                    className={
                      "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 " +
                      (productId === p.id ? "bg-brand-50" : "")
                    }
                  >
                    <span className="text-gray-900">{p.name}</span>
                    <span className="text-xs text-gray-400">{p.sku ?? p.type ?? ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Variants of the chosen product */}
      {productId && (
        <div className="rounded-md border border-gray-200 p-2">
          {product.isLoading ? (
            <div className="h-16 animate-pulse rounded bg-gray-50" />
          ) : product.isError || !product.data ? (
            <p className="p-2 text-sm text-gray-500">Couldn&apos;t load variants.</p>
          ) : product.data.variants.length === 0 ? (
            <p className="p-2 text-sm text-gray-500">This product has no variants.</p>
          ) : (
            <ul className="space-y-1">
              {product.data.variants.map((v) => {
                const value = variantValue(v.price) ?? variantValue(product.data?.base_price);
                const isLower = originalPrice != null && value != null && value < originalPrice;
                const isHigher = originalPrice != null && value != null && value > originalPrice;
                const diff = isHigher && value != null && originalPrice != null ? value - originalPrice : 0;
                const label = `${product.data?.name} — ${Object.values(v.options).join(" / ") || v.sku_code}`;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      disabled={!v.is_enabled || isLower}
                      onClick={() => onSelect(v.id, value, label)}
                      aria-pressed={selectedVariantId === v.id}
                      className={
                        "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 " +
                        (selectedVariantId === v.id ? "bg-brand-600 text-white" : "hover:bg-gray-50")
                      }
                    >
                      <span>
                        <span className="font-medium">
                          {Object.values(v.options).join(" / ") || v.sku_code}
                        </span>
                        <span className={selectedVariantId === v.id ? "ml-2 text-xs text-white/80" : "ml-2 text-xs text-gray-400"}>
                          {v.sku_code}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs">
                        {value != null ? formatBDT(value) : "—"}
                        {isLower ? " · lower ✕" : isHigher ? ` · +${formatBDT(diff)}` : value != null && originalPrice != null ? " · equal" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
