"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Check, History, Power, Sparkles, ImagePlus, Info, Trash2, MoreVertical } from "lucide-react";
import { useGenerateVariants, useUpdateVariant, useAttribute } from "@/lib/api/hooks/useCatalog";
import { useSetOnHand } from "@/lib/api/hooks/useInventory";
import type {
  ProductDetail,
  ProductVariant,
  AttributeRow,
  AdminProductImage,
  ConfigurableAttribute,
} from "@/lib/api/schemas/catalog";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";
import { Can } from "@/lib/permissions/Can";
import { Switch } from "@/components/ui";
import { pickRendition } from "@/lib/media";

/**
 * Variant matrix (catalog-product-editor-fe, configurable products) — rebuilt to the
 * design's Variants section (docs/design/admin-panel-design-files/Product Editor (CAT).dc.html):
 *  A. an axis-picker card — one row per configurable attribute (UPPERCASE label + option chips),
 *     a "Re-generating appends…" hint, and a Generate button,
 *  B. a bordered matrix table (gray header) with columns SKU · Options · Image · On-hand · Price
 *     override · Enabled · ⋮ — the Image cell opens a thumbnail picker (PATCH image_id), On-hand
 *     is an absolute set written to INV with an Avail · Resvd readout, and the ⋮ row menu carries
 *     enable/disable · stock history · delete.
 *
 * Wiring: generate (POST, appends), per-row sku/price/enabled PATCH, and on-hand via the
 * first-class audited absolute set POST /admin/inventory/{variantId}/set (FR-INV-015, gated on
 * `inventory.stock.adjust`) — NOT the bulk endpoint. The image picker PATCHes `image_id`
 * (contract-backed). Variant **delete** has no endpoint yet — the menu item is shown disabled
 * and flagged (brief filed).
 * Option ids render as human labels via the product's `configurable_attributes` lookup.
 */
export function VariantMatrix({
  product,
  configurableAttributes,
}: {
  product: ProductDetail;
  configurableAttributes: AttributeRow[];
}) {
  const generate = useGenerateVariants(product.id);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [genError, setGenError] = useState<string | null>(null);

  const chosenAxes = configurableAttributes.filter((a) => (selected[a.code]?.length ?? 0) > 0);

  // option-id → readable value, from the detail's configurable_attributes (e.g. "o-black" → "Black").
  const optionLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const grp of product.configurable_attributes ?? []) {
      for (const o of grp.options) map.set(o.id, o.value);
    }
    return map;
  }, [product.configurable_attributes]);

  // code → group label (e.g. "color" → "Color"), for the read-only Options cell.
  const codeLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const grp of product.configurable_attributes ?? []) {
      map.set(grp.code, grp.label ?? grp.code);
    }
    for (const a of configurableAttributes) if (!map.has(a.code)) map.set(a.code, a.admin_label);
    return map;
  }, [product.configurable_attributes, configurableAttributes]);

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

  const basePrice = product.base_price ? `৳${Number(product.base_price).toLocaleString("en-US")}` : "—";

  return (
    <div className="flex flex-col gap-4">
      {/* count + base price (the design's section-header meta, rendered inline here) */}
      <div className="flex items-center justify-end">
        <span className="text-xs tabular-nums text-text-muted">
          {product.variants.length} {product.variants.length === 1 ? "variant" : "variants"} · base {basePrice}
        </span>
      </div>

      {/* ── A. AXIS PICKERS ─────────────────────────────────────────────────────── */}
      {configurableAttributes.length === 0 ? (
        <p className="text-sm text-text-muted">This product&apos;s family has no configurable attributes (e.g. colour/size).</p>
      ) : (
        <div className="rounded-lg border border-border bg-surface-subtle p-3.5">
          <div className="mb-3 flex items-start justify-between gap-2.5">
            <div>
              <h3 className="text-[13px] font-semibold text-text">Choose the variant axes</h3>
              <p className="mt-0.5 text-[11.5px] text-text-muted">Re-generating appends new combinations and keeps existing rows.</p>
            </div>
            <button
              type="button"
              onClick={onGenerate}
              disabled={chosenAxes.length === 0 || generate.isPending}
              className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-md bg-accent-600 px-3.5 text-[12.5px] font-semibold text-accent-fg hover:bg-accent-700 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {generate.isPending ? "Generating…" : "Generate variants"}
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {configurableAttributes.map((a) => (
              <AxisPicker
                key={a.id}
                attribute={a}
                selected={selected[a.code] ?? []}
                onChange={(ids) => setSelected((s) => ({ ...s, [a.code]: ids }))}
              />
            ))}
          </div>
          {genError && <p role="alert" className="mt-3 text-sm text-error">{genError}</p>}
        </div>
      )}

      {/* ── B. MATRIX TABLE ─────────────────────────────────────────────────────── */}
      {product.variants.length === 0 ? (
        <p className="text-sm text-text-muted">No variants yet.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-subtle text-left text-[11px] uppercase tracking-wide text-text-secondary">
                    <th scope="col" className="border-b border-border px-3.5 py-2.5 font-semibold">SKU</th>
                    <th scope="col" className="border-b border-border px-3.5 py-2.5 font-semibold">Options</th>
                    <th scope="col" className="border-b border-border px-3.5 py-2.5 font-semibold">Image</th>
                    <th scope="col" className="border-b border-border px-3.5 py-2.5 text-right font-semibold">On-hand</th>
                    <th scope="col" className="border-b border-border px-3.5 py-2.5 text-right font-semibold">Price override</th>
                    <th scope="col" className="border-b border-border px-3.5 py-2.5 font-semibold">Enabled</th>
                    <th scope="col" className="w-12 border-b border-border"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((v) => (
                    <VariantRow
                      key={v.id}
                      productId={product.id}
                      variant={v}
                      images={product.images}
                      optionLabels={optionLabels}
                      codeLabels={codeLabels}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="m-0 flex items-center gap-1.5 text-[11.5px] text-text-muted">
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            On-hand is an absolute set — what you type becomes the new on-hand and writes an audited correction to Inventory.
          </p>
        </>
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
    <div className="flex items-start gap-3">
      <span className="w-[54px] shrink-0 pt-[7px] text-[11px] font-semibold uppercase tracking-wide text-text-muted">{attribute.admin_label}</span>
      <div className="flex flex-wrap gap-[7px]">
        {options.length === 0 ? (
          <span className="pt-1.5 text-xs text-text-muted">No options.</span>
        ) : (
          options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(o.value)}
                className={
                  "inline-flex h-[30px] select-none items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1 " +
                  (on ? "border-accent-600 bg-accent-600 text-accent-fg" : "border-border-strong text-text-secondary hover:bg-surface")
                }
              >
                {on && <Check className="h-3 w-3" aria-hidden="true" />}{o.label}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function VariantRow({
  productId,
  variant,
  images,
  optionLabels,
  codeLabels,
}: {
  productId: string;
  variant: ProductVariant;
  images: AdminProductImage[];
  optionLabels: Map<string, string>;
  codeLabels: Map<string, string>;
}) {
  const update = useUpdateVariant(productId);
  const setOnHand = useSetOnHand();
  const qc = useQueryClient();
  const [sku, setSku] = useState(variant.sku_code);
  const [skuError, setSkuError] = useState(false);
  const [price, setPrice] = useState(variant.price ?? "");
  const [enabled, setEnabled] = useState(variant.is_enabled);
  const [stock, setStock] = useState(String(variant.on_hand ?? 0));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const reserved = variant.reserved;
  const avail = Math.max(0, variant.on_hand - reserved);

  // Render the read-only options as "Color: Black · Size: 42" using the lookups.
  const optionsLabel = Object.entries(variant.options)
    .map(([code, optId]) => `${codeLabels.get(code) ?? code}: ${optionLabels.get(optId) ?? optId}`)
    .join(" · ");

  const currentImage = variant.image
    ? images.find((i) => i.id === variant.image) ?? null
    : null;

  function save(body: Record<string, unknown>, onErr?: () => void) {
    update.mutate({ variantId: variant.id, body }, {
      onError: (err) => {
        onErr?.();
        if (err instanceof ApiError && err.status === 409) toast("That SKU already exists — pick another.", "error");
        else toast("Couldn't save the variant.", "error");
      },
    });
  }

  function saveSku() {
    if (sku === variant.sku_code) { setSkuError(false); return; }
    if (!sku.trim()) { setSku(variant.sku_code); setSkuError(false); return; }
    save({ sku_code: sku }, () => setSkuError(true));
    setSkuError(false);
  }

  // On-hand lives in INV. This is an ABSOLUTE set (what-you-type-is-the-new-on-hand)
  // via the first-class audited POST /admin/inventory/{variantId}/set (FR-INV-015) —
  // NOT the bulk endpoint — so INV writes a `correction` movement stamped with the admin
  // actor + a `product-editor` source tag. A target < 0 is rejected (409 NEGATIVE_ON_HAND)
  // and the cell reverts. We refresh the product so the matrix reflects the new level.
  async function saveStock() {
    const target = Number(stock);
    if (!Number.isInteger(target) || target < 0) {
      setStock(String(variant.on_hand ?? 0));
      toast("On-hand can't go below 0.", "error");
      return;
    }
    if (target === (variant.on_hand ?? 0)) return;
    try {
      await setOnHand.mutateAsync({ variantId: variant.id, on_hand: target });
      toast("Stock updated.");
      qc.invalidateQueries({ queryKey: ["admin-product", productId] });
    } catch (err) {
      setStock(String(variant.on_hand ?? 0));
      if (err instanceof ApiError && err.code === "NEGATIVE_ON_HAND") {
        toast("On-hand can't go below 0.", "error");
      } else {
        toast("Couldn't set stock.", "error");
      }
    }
  }

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    save({ is_enabled: next }, () => setEnabled(!next));
  }

  function pickImage(imageId: string | null) {
    setPickerOpen(false);
    if ((imageId ?? null) === (variant.image ?? null)) return;
    save({ image_id: imageId });
  }

  const inputBase =
    "h-[34px] rounded-md border bg-surface px-2.5 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600";

  return (
    <tr className={"border-b border-border " + (enabled ? "" : "bg-surface-subtle/40")}>
      {/* SKU */}
      <td className={"px-3.5 py-2.5 align-top " + (enabled ? "" : "opacity-60")}>
        <input
          className={inputBase + " w-40 max-w-full font-mono text-[12.5px] " + (skuError ? "border-error" : "border-border-strong")}
          value={sku}
          aria-label="Variant SKU"
          onChange={(e) => setSku(e.target.value)}
          onBlur={saveSku}
        />
        {skuError && <span className="mt-1 block max-w-[170px] text-[11px] leading-snug text-error">SKU already exists — edit the code.</span>}
      </td>

      {/* OPTIONS (read-only) */}
      <td className={"px-3.5 py-2.5 align-top text-[12.5px] leading-snug text-text-secondary " + (enabled ? "" : "opacity-60")}>
        {optionsLabel || "—"}
      </td>

      {/* IMAGE picker */}
      <td className={"relative px-3.5 py-2.5 align-top " + (enabled ? "" : "opacity-60")} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-label="Pick variant image"
          aria-haspopup="menu"
          aria-expanded={pickerOpen}
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-subtle text-text-muted hover:border-accent-500"
        >
          {currentImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pickRendition(currentImage.renditions, currentImage.url)} alt={currentImage.alt_text} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        {pickerOpen && (
          <ImagePickerPopover
            images={images}
            currentId={variant.image ?? null}
            onPick={pickImage}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </td>

      {/* ON-HAND (absolute set → INV) */}
      <td className="px-3.5 py-2.5 text-right align-top">
        <Can permission="inventory.stock.adjust" fallback={<span className="text-xs tabular-nums text-text-secondary">{variant.on_hand ?? 0}</span>}>
          <input
            className={inputBase + " w-[74px] border-border-strong text-right tabular-nums"}
            type="text"
            inputMode="numeric"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            onBlur={saveStock}
            disabled={setOnHand.isPending}
            aria-label="On-hand"
          />
          <div className="mt-1 whitespace-nowrap text-[10.5px] tabular-nums text-text-muted">Avail {avail} · Resvd {reserved}</div>
        </Can>
      </td>

      {/* PRICE OVERRIDE */}
      <td className={"px-3.5 py-2.5 text-right align-top " + (enabled ? "" : "opacity-60")}>
        <div className="inline-flex h-[34px] items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2.5">
          <span className="text-[12.5px] text-text-muted">৳</span>
          <input
            className="w-16 bg-transparent text-right text-sm tabular-nums text-text outline-none"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => (price || null) !== (variant.price ?? null) && save({ price: price || null })}
            placeholder="base"
            aria-label="Price override"
          />
        </div>
      </td>

      {/* ENABLED toggle */}
      <td className="px-3.5 py-2.5 align-top">
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onChange={toggleEnabled} label="Enabled" />
          <span className={"text-xs font-semibold " + (enabled ? "text-success" : "text-text-muted")}>{enabled ? "On" : "Off"}</span>
        </div>
      </td>

      {/* ROW MENU */}
      <td className="relative py-2.5 pr-3 text-right align-top" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`Actions for ${variant.sku_code}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={"inline-flex h-[30px] w-[30px] items-center justify-center rounded-md text-text-muted hover:bg-surface-subtle " + (menuOpen ? "bg-surface-subtle" : "")}
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        {menuOpen && (
          <RowMenu onClose={() => setMenuOpen(false)}>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); toggleEnabled(); }} className={menuItemCls}>
              <Power className="h-4 w-4 text-text-muted" aria-hidden="true" />{enabled ? "Disable" : "Enable"}
            </button>
            <Link role="menuitem" href={`/admin/inventory/${variant.id}/movements?sku=${encodeURIComponent(variant.sku_code)}`} onClick={() => setMenuOpen(false)} className={menuItemCls}>
              <History className="h-4 w-4 text-text-muted" aria-hidden="true" />View stock history
            </Link>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              role="menuitem"
              disabled
              title="Variant delete isn't available yet — flagged for the backend."
              className={menuItemCls + " cursor-not-allowed text-error/50"}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />Delete
            </button>
          </RowMenu>
        )}
      </td>
    </tr>
  );
}

const menuItemCls =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-text-secondary hover:bg-surface-subtle disabled:hover:bg-transparent";

/** Lightweight row dropdown — closes on outside click / Escape. */
function RowMenu({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="menu"
      className="absolute right-2.5 top-[34px] z-30 min-w-[184px] rounded-md border border-border bg-surface p-1.5 text-left shadow-lg"
    >
      {children}
    </div>
  );
}

/** Thumbnail grid to assign one of the product's uploaded images to a variant. */
function ImagePickerPopover({
  images,
  currentId,
  onPick,
  onClose,
}: {
  images: AdminProductImage[];
  currentId: string | null;
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onPointer(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) onClose(); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div ref={ref} role="menu" className="absolute left-3.5 top-[54px] z-30 w-[188px] rounded-md border border-border bg-surface p-2.5 shadow-lg">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Use an uploaded image</div>
      {images.length === 0 ? (
        <p className="px-1 py-2 text-[12px] text-text-muted">Upload images first.</p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onPick(img.id)}
              aria-label={`Choose ${img.alt_text}`}
              className={
                "aspect-square w-full overflow-hidden rounded-md border-2 bg-surface-subtle " +
                (currentId === img.id ? "border-accent-600" : "border-transparent hover:border-accent-500")
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pickRendition(img.renditions, img.url)} alt={img.alt_text} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => onPick(null)}
        className="mt-2 h-[30px] w-full rounded-md border border-border bg-surface text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
      >
        No image
      </button>
    </div>
  );
}
