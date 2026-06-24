"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Layers,
  Link as LinkIcon,
  Lock,
  Banknote,
  FolderTree,
  Settings,
  Truck,
  Tags,
  Archive,
  ArrowUpCircle,
  AlertTriangle,
  X,
  Bold,
  Italic,
  List,
  Link2,
} from "lucide-react";
import { useCreateProduct, useUpdateProduct, useProductStatus, useFamilies, useFilterableAttributes, useCategoryTree } from "@/lib/api/hooks/useCatalog";
import type { ProductDetail, CategoryNode } from "@/lib/api/schemas/catalog";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/cn";
import { StatusPill, Switch } from "@/components/ui";
import { VariantMatrix } from "./VariantMatrix";
import { FamilyAttributesSection } from "./FamilyAttributesSection";
import { ProductImageSection } from "./ProductImageSection";
import { ProductLinksSection } from "./ProductLinksSection";

type AttrValue = string | string[] | boolean;

/**
 * Product editor (catalog-product-editor-fe) — the design's EDITOR archetype
 * (docs/design/admin-panel-design-files/Product Editor (CAT).dc.html): a sticky
 * title bar (status pill + locked Type/Family chips, Archive/Publish/Save), a
 * two-column canvas (sticky scroll-spy section nav · main column · right rail),
 * and a sticky bottom save bar. Type + family immutable after create (FR-CAT-065);
 * SKU read-only after create. Publish runs server validation → 422 NOT_PUBLISHABLE
 * checklist (FR-CAT-015); STALE_WRITE (409) shows a reload banner. Create defers
 * the POST to the first Save.
 *
 * The Images & Videos section is built to the design and wires image reorder
 * (PATCH .../images/reorder) + per-image color tag (color_option_id) against the
 * API contract; until the running backend serves them (brief: `safwan update api/
 * cat-product-media-be.md`) reorder errors gracefully and the color-tag select
 * hides when the family exposes no `color` options. Remaining backend-blocked extras
 * (per-variant image picker, product-link search/add) are flagged in `safwan update
 * api/cat-product-editor-be.md`; their controls render disabled or are omitted.
 */

const labelCls = "flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted";
const inputCls = "h-[38px] w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1";

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
  const { data: categoryTree } = useCategoryTree();

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
  const [metaKeywords, setMetaKeywords] = useState(product?.meta_keywords ?? "");
  const [metaDesc, setMetaDesc] = useState(product?.meta_description ?? "");
  const [weight, setWeight] = useState(product?.weight ?? "");
  const [primaryCategoryId, setPrimaryCategoryId] = useState(product?.primary_category_id ?? "");
  const [additionalCategoryIds, setAdditionalCategoryIds] = useState<string[]>(product?.category_ids ?? []);
  const [error, setError] = useState<string | null>(null);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [stale, setStale] = useState(false);
  const [dirty, setDirty] = useState(false);
  const markDirty = () => setDirty(true);

  // Family-driven attribute values, keyed by attribute code.
  const [attrValues, setAttrValues] = useState<Record<string, AttrValue>>(
    () => (product?.attributes as Record<string, AttrValue>) ?? {},
  );
  const setAttr = (code: string, value: AttrValue) => {
    setAttrValues((prev) => ({ ...prev, [code]: value }));
    markDirty();
  };

  const skuLocked = mode === "edit";
  const familyLabel = families?.find((f) => f.id === familyId)?.name ?? familyId;
  const status = product?.status ?? "draft";

  // Flatten the nested category tree into indented options + a id→label map.
  const { categoryOptions, categoryLabel } = useMemo(() => {
    const opts: { id: string; label: string }[] = [];
    const map = new Map<string, string>();
    const walk = (nodes: CategoryNode[], depth: number) => {
      for (const node of nodes) {
        if (node.is_deleted) continue;
        const label = `${"   ".repeat(depth)}${node.name}`;
        opts.push({ id: node.id, label });
        map.set(node.id, node.name);
        if (node.children?.length) walk(node.children, depth + 1);
      }
    };
    if (categoryTree) walk(categoryTree, 0);
    return { categoryOptions: opts, categoryLabel: map };
  }, [categoryTree]);

  // Effective price preview for the Price rail.
  const effectivePrice = useMemo(() => {
    const base = Number(basePrice);
    const sale = Number(salePrice);
    if (salePrice && sale > 0 && (!basePrice || sale < base)) return sale;
    return base || 0;
  }, [basePrice, salePrice]);

  const saleInvalid = !!(salePrice && basePrice && Number(salePrice) >= Number(basePrice));

  // Section refs let onSave/onPublish jump to the offending section on a validation error.
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  function scrollTo(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Rich-text toolbar: wrap/prefix the current selection in the Description textarea.
  const descRef = useRef<HTMLTextAreaElement>(null);
  function applyFormat(kind: "bold" | "italic" | "list" | "link") {
    const el = descRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = description.slice(start, end);
    let insert = sel;
    let caretOffset = 0; // where to place the caret inside the inserted text when nothing was selected
    if (kind === "bold") { insert = `**${sel || "bold text"}**`; caretOffset = sel ? 0 : 2; }
    else if (kind === "italic") { insert = `*${sel || "italic text"}*`; caretOffset = sel ? 0 : 1; }
    else if (kind === "list") {
      const lines = (sel || "List item").split("\n");
      insert = lines.map((l) => (l.startsWith("- ") ? l : `- ${l}`)).join("\n");
    } else if (kind === "link") {
      const url = window.prompt("Link URL", "https://");
      if (url == null) return;
      insert = `[${sel || "link text"}](${url})`;
    }
    const next = description.slice(0, start) + insert + description.slice(end);
    setDescription(next);
    markDirty();
    // Restore focus + a sensible selection after React re-renders.
    requestAnimationFrame(() => {
      el.focus();
      const pos = sel ? start + insert.length : start + caretOffset;
      const selEnd = sel ? start + insert.length : start + insert.length - caretOffset;
      el.setSelectionRange(pos, selEnd);
    });
  }

  // Fields shared by create + update. `type` / `family_id` are immutable and only
  // belong in the create body — the update DTO rejects them.
  function buildBody(): Record<string, unknown> {
    return {
      primary_category_id: primaryCategoryId || undefined,
      category_ids: additionalCategoryIds.length ? [primaryCategoryId, ...additionalCategoryIds].filter(Boolean) : undefined,
      name: name.trim(), brand: brand.trim() || undefined,
      short_description: shortDesc.trim() || undefined, description: description.trim() || undefined,
      base_price: basePrice || undefined,
      sale_price: salePrice.trim() || undefined,
      sale_starts_at: saleStart ? `${saleStart}T00:00:00Z` : undefined,
      sale_ends_at: saleEnd ? `${saleEnd}T23:59:59Z` : undefined,
      is_featured: isFeatured, is_new: isNew,
      weight: weight.trim() || undefined,
      meta_title: metaTitle.trim() || undefined,
      meta_keywords: metaKeywords.trim() || undefined,
      meta_description: metaDesc.trim() || undefined,
      attributes: Object.keys(attrValues).length ? attrValues : undefined,
    };
  }

  async function onSave() {
    setError(null);
    if (name.trim().length < 2) { setError("Name must be at least 2 characters."); scrollTo("general"); return; }
    if (!primaryCategoryId) { setError("Select a primary category."); scrollTo("categories"); return; }
    if (saleInvalid) { setError("Sale price must be less than the base price."); scrollTo("price"); return; }
    try {
      if (mode === "create") {
        const res = await create.mutateAsync({ ...buildBody(), type, family_id: familyId || undefined, sku: sku.trim() });
        toast("Product saved.");
        router.replace(`/admin/products/${(res as { id: string }).id}`);
      } else {
        await update.mutateAsync({ ...buildBody(), updated_at: product?.updated_at });
        setDirty(false);
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
        window.scrollTo({ top: 0 });
      } else toast("Couldn't publish. Try again.", "error");
    }
  }

  async function onArchive() {
    if (!product) return;
    try {
      await statusM.mutateAsync({ id: product.id, status: "archived" });
      toast("Product archived.");
      router.push("/admin/products");
    } catch {
      toast("Couldn't archive. Try again.", "error");
    }
  }

  function onCancel() {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    router.push("/admin/products");
  }

  const pending = create.isPending || update.isPending;
  const publishDisabled = mode === "create" || statusM.isPending;

  return (
    // Break out of the admin <main> padding (p-4 / md:p-6) so the title/save bars are
    // full-bleed and the title bar sits flush against the topbar — no gap above the
    // breadcrumb. The sticky tops are offset by the same padding so the bars pin to the
    // true top/bottom of the scroll container.
    <div className="-m-4 flex min-h-full flex-col md:-m-6">
      {/* ===== STICKY TITLE BAR ===== */}
      <div className="sticky -top-4 z-[9] border-b border-border bg-surface md:-top-6">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-start justify-between gap-5 px-5 py-3.5 md:px-6">
          <div className="min-w-0">
            <nav className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
              <span>Catalog</span>
              <ChevronRight className="h-3.5 w-3.5 text-text-faint" aria-hidden="true" />
              <Link href="/admin/products" className="hover:text-accent-600">Products</Link>
              <ChevronRight className="h-3.5 w-3.5 text-text-faint" aria-hidden="true" />
              <span className="max-w-[280px] truncate font-medium text-text-secondary">{name || (mode === "create" ? "New product" : "Product")}</span>
            </nav>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="m-0 max-w-[560px] truncate text-[22px] font-bold leading-7 tracking-tight text-text">{mode === "create" ? "New product" : name || product?.name}</h1>
              <StatusPill status={status} />
              <span className="h-[18px] w-px bg-border" aria-hidden="true" />
              <span title="To use a different type, create a new product." className="inline-flex items-center gap-1.5 rounded-md bg-surface-subtle px-2.5 py-1 text-[11.5px] font-semibold capitalize text-text-secondary">
                {type}<Lock className="h-3 w-3 text-text-faint" aria-hidden="true" />
              </span>
              {familyLabel && (
                <span title="To use a different family, create a new product." className="inline-flex items-center gap-1.5 rounded-md bg-surface-subtle px-2.5 py-1 text-[11.5px] font-semibold text-text-secondary">
                  {familyLabel}<Lock className="h-3 w-3 text-text-faint" aria-hidden="true" />
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {dirty && (
              <span className="mr-0.5 inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-warning">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />Unsaved changes
              </span>
            )}
            {product && status !== "archived" && (
              <button type="button" onClick={onArchive} disabled={statusM.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-text-muted hover:bg-surface-subtle disabled:opacity-50">
                <Archive className="h-4 w-4" aria-hidden="true" />Archive
              </button>
            )}
            <button type="button" onClick={onPublish} disabled={publishDisabled} title={mode === "create" ? "Save the product first" : undefined} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3.5 text-sm font-semibold text-text hover:bg-surface-subtle disabled:opacity-50">
              <ArrowUpCircle className="h-4 w-4" aria-hidden="true" />Publish
            </button>
            <button type="button" onClick={onSave} disabled={pending} className="inline-flex h-9 items-center rounded-lg bg-accent-600 px-4 text-sm font-semibold text-accent-fg shadow-xs hover:bg-accent-700 disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-8 pt-5 md:px-6">
        {stale && (
          <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            This product changed since you opened it. Reload to see the latest.
            <button type="button" onClick={() => router.refresh()} className="shrink-0 font-semibold underline">Reload</button>
          </div>
        )}
        {error && <p role="alert" className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
        {publishErrors.length > 0 && (
          <div role="alert" className="mb-4 rounded-xl border border-error/30 bg-error/10 p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-[13.5px] font-bold text-error">This product can&apos;t be published yet:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-error">{publishErrors.map((l, i) => <li key={i}>{l}</li>)}</ul>
              </div>
              <button type="button" onClick={() => setPublishErrors([])} aria-label="Dismiss" className="shrink-0 rounded-md p-1 text-error hover:bg-error/10"><X className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {/* CANVAS: main column + right rail (the design's "On this page" jump-nav is
            off by default — showToc defaults to false — so it's intentionally omitted). */}
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
          {/* MAIN COLUMN */}
          <div className="flex min-w-0 flex-1 flex-col gap-5">
              {/* GENERAL */}
              <Section id="general" title="General" icon={FileText} setRef={(el) => (sectionRefs.current.general = el)}>
                <label className="block">
                  <span className={labelCls}>Name <span className="text-error">*</span></span>
                  <input className={cn(inputCls, "mt-1.5")} value={name} onChange={(e) => { setName(e.target.value); markDirty(); }} aria-required />
                  {product?.slug && <span className="mt-1.5 block break-all font-mono text-[11.5px] text-text-muted">URL key: /{product.slug} <span className="font-sans">(generated from the name)</span></span>}
                </label>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelCls}>SKU{skuLocked && <span className="text-text-faint"> (locked)</span>}</span>
                    <input className={cn(inputCls, "mt-1.5 font-mono", skuLocked && "bg-surface-subtle text-text-muted")} value={sku} onChange={(e) => { setSku(e.target.value); markDirty(); }} readOnly={skuLocked} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Brand</span>
                    <input className={cn(inputCls, "mt-1.5")} value={brand} onChange={(e) => { setBrand(e.target.value); markDirty(); }} />
                  </label>
                </div>
                <label className="block">
                  <span className={labelCls}>Primary category <span className="text-error">*</span></span>
                  <select className={cn(inputCls, "mt-1.5 cursor-pointer")} value={primaryCategoryId} onChange={(e) => { setPrimaryCategoryId(e.target.value); markDirty(); }} aria-required>
                    <option value="" disabled>Select a category…</option>
                    {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className={labelCls}>Short description</span>
                  <input className={cn(inputCls, "mt-1.5")} value={shortDesc} onChange={(e) => { setShortDesc(e.target.value); markDirty(); }} />
                </label>
                <label className="block">
                  <span className={labelCls}>Description</span>
                  <div className="mt-1.5 overflow-hidden rounded-lg border border-border-strong bg-surface focus-within:ring-2 focus-within:ring-accent-600">
                    <div className="flex items-center gap-0.5 border-b border-border bg-surface-subtle px-2 py-1.5">
                      {([
                        { kind: "bold" as const, label: "Bold", Icon: Bold },
                        { kind: "italic" as const, label: "Italic", Icon: Italic },
                        { kind: "list" as const, label: "Bulleted list", Icon: List },
                        { kind: "link" as const, label: "Insert link", Icon: Link2 },
                      ]).map(({ kind, label, Icon }) => (
                        <button
                          key={kind}
                          type="button"
                          aria-label={label}
                          title={label}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyFormat(kind)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:bg-surface-hover"
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                    <textarea ref={descRef} className="w-full resize-y bg-surface px-3 py-2.5 text-sm leading-relaxed text-text outline-none" rows={4} value={description} onChange={(e) => { setDescription(e.target.value); markDirty(); }} />
                  </div>
                </label>
              </Section>

              {/* ATTRIBUTES */}
              <Section id="attributes" title="Attributes" icon={Tags} setRef={(el) => (sectionRefs.current.attributes = el)}>
                <FamilyAttributesSection familyId={familyId} values={attrValues} onChange={setAttr} embedded />
              </Section>

              {/* IMAGES & VIDEOS */}
              <Section id="images" title="Images & Videos" icon={ImageIcon} setRef={(el) => (sectionRefs.current.images = el)}>
                {product ? (
                  <ProductImageSection
                    productId={product.id}
                    hasPrimary={!!product.primary_image_id || (product.images?.length ?? 0) > 0}
                    images={product.images}
                    videos={product.videos}
                    colorOptions={product.configurable_attributes?.find((a) => a.code === "color")?.options}
                    embedded
                  />
                ) : (
                  <p className="text-sm text-text-muted">Save the product first, then upload its images.</p>
                )}
              </Section>

              {/* VARIANTS (configurable only) */}
              {type === "configurable" && (
                <Section id="variants" title="Variants" icon={Layers} setRef={(el) => (sectionRefs.current.variants = el)}>
                  {!product ? (
                    <p className="text-sm text-text-muted">Save the product first, then generate its variants.</p>
                  ) : (
                    <VariantMatrix product={product} configurableAttributes={(attributes ?? []).filter((a) => a.is_configurable)} />
                  )}
                </Section>
              )}

              {/* LINKS */}
              <Section id="links" title="Links" icon={LinkIcon} setRef={(el) => (sectionRefs.current.links = el)}>
                <ProductLinksSection productId={product?.id} initialLinks={product?.links} />
              </Section>
            </div>

            {/* RIGHT RAIL */}
            <div className="flex w-full flex-col gap-5 xl:w-[324px] xl:shrink-0">
              {/* PRICE */}
              <Section id="price" title="Price" icon={Banknote} compact setRef={(el) => (sectionRefs.current.price = el)}>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className={labelCls}>Base (৳) <span className="text-error">*</span></span>
                    <input className={cn(inputCls, "mt-1.5 text-right tabular-nums")} inputMode="decimal" value={basePrice} onChange={(e) => { setBasePrice(e.target.value); markDirty(); }} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Sale (৳)</span>
                    <input className={cn(inputCls, "mt-1.5 text-right tabular-nums", saleInvalid && "border-error")} inputMode="decimal" placeholder="—" value={salePrice} onChange={(e) => { setSalePrice(e.target.value); markDirty(); }} />
                  </label>
                </div>
                {saleInvalid && <p className="text-[11.5px] text-error">Sale price must be lower than the base price.</p>}
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className={labelCls}>Sale starts</span>
                    <input className={cn(inputCls, "mt-1.5")} type="date" value={saleStart} onChange={(e) => { setSaleStart(e.target.value); markDirty(); }} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Sale ends</span>
                    <input className={cn(inputCls, "mt-1.5")} type="date" value={saleEnd} onChange={(e) => { setSaleEnd(e.target.value); markDirty(); }} />
                  </label>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-surface-subtle px-3 py-2.5 text-xs text-text-secondary">
                  <Banknote className="h-4 w-4 text-text-muted" aria-hidden="true" />
                  <span>Effective price <strong className="font-bold tabular-nums">৳{effectivePrice.toLocaleString("en-US")}</strong></span>
                </div>
              </Section>

              {/* CATEGORIES */}
              <Section id="categories" title="Categories" icon={FolderTree} compact setRef={(el) => (sectionRefs.current.categories = el)}>
                <label className="block">
                  <span className={labelCls}>Primary category <span className="text-error">*</span></span>
                  <select className={cn(inputCls, "mt-1.5 cursor-pointer")} value={primaryCategoryId} onChange={(e) => { setPrimaryCategoryId(e.target.value); markDirty(); }} aria-required>
                    <option value="" disabled>Select a category…</option>
                    {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
                <div>
                  <span className={labelCls}>Additional categories</span>
                  <div className="mb-2 mt-2 flex flex-wrap gap-1.5">
                    {additionalCategoryIds.length === 0 && <span className="text-xs text-text-muted">None added.</span>}
                    {additionalCategoryIds.map((id) => (
                      <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 py-1 pl-2.5 pr-1.5 text-xs font-semibold text-accent-700">
                        {categoryLabel.get(id)?.trim() ?? id}
                        <button type="button" aria-label={`Remove ${categoryLabel.get(id) ?? "category"}`} onClick={() => { setAdditionalCategoryIds((p) => p.filter((x) => x !== id)); markDirty(); }} className="inline-flex h-4 w-4 items-center justify-center rounded-full text-accent-700 hover:bg-accent-100"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                  <select
                    className="h-[34px] w-full cursor-pointer rounded-lg border border-dashed border-border-strong bg-surface-subtle px-3 text-[12.5px] font-medium text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                    value=""
                    onChange={(e) => { const v = e.target.value; if (v && v !== primaryCategoryId && !additionalCategoryIds.includes(v)) { setAdditionalCategoryIds((p) => [...p, v]); markDirty(); } }}
                  >
                    <option value="">Add category…</option>
                    {categoryOptions.filter((c) => c.id !== primaryCategoryId && !additionalCategoryIds.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </Section>

              {/* SETTINGS & SEO */}
              <Section id="seo" title="Settings & SEO" icon={Settings} compact setRef={(el) => (sectionRefs.current.seo = el)}>
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2.5">
                    <div><div className="text-[13px] font-semibold text-text">Featured</div><div className="text-[11.5px] text-text-muted">Show in featured rails.</div></div>
                    <Switch checked={isFeatured} onChange={(v) => { setIsFeatured(v); markDirty(); }} label="Featured" />
                  </div>
                  <div className="flex items-center justify-between gap-2.5">
                    <div><div className="text-[13px] font-semibold text-text">New</div><div className="text-[11.5px] text-text-muted">Badge as a new arrival.</div></div>
                    <Switch checked={isNew} onChange={(v) => { setIsNew(v); markDirty(); }} label="New" />
                  </div>
                </div>
                <div className="h-px bg-border" />
                <label className="block">
                  <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-text-muted">Meta title <span className={cn("font-normal normal-case tracking-normal", metaTitle.length > 60 ? "text-error" : "text-text-faint")}>{metaTitle.length}/60</span></span>
                  <input className={cn(inputCls, "mt-1.5", metaTitle.length > 60 && "border-error")} placeholder={name || "Falls back to the product name"} value={metaTitle} onChange={(e) => { setMetaTitle(e.target.value); markDirty(); }} />
                </label>
                <label className="block">
                  <span className={labelCls}>Meta keywords</span>
                  <input className={cn(inputCls, "mt-1.5")} placeholder="comma, separated, terms" value={metaKeywords} onChange={(e) => { setMetaKeywords(e.target.value); markDirty(); }} />
                </label>
                <label className="block">
                  <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-text-muted">Meta description <span className={cn("font-normal normal-case tracking-normal", metaDesc.length > 160 ? "text-error" : "text-text-faint")}>{metaDesc.length}/160</span></span>
                  <textarea className={cn("mt-1.5 w-full rounded-lg border bg-surface px-3 py-2.5 text-sm leading-snug text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600", metaDesc.length > 160 ? "border-error" : "border-border-strong")} rows={3} placeholder="Falls back to the short description" value={metaDesc} onChange={(e) => { setMetaDesc(e.target.value); markDirty(); }} />
                </label>
              </Section>

              {/* SHIPPING */}
              <Section id="shipping" title="Shipping" icon={Truck} compact setRef={(el) => (sectionRefs.current.shipping = el)}>
                <label className="block max-w-[170px]">
                  <span className={labelCls}>Weight</span>
                  <div className={cn(inputCls, "mt-1.5 flex items-center gap-1.5")}>
                    <input className="min-w-0 flex-1 bg-transparent text-right tabular-nums outline-none" inputMode="decimal" aria-label="Weight in kilograms" value={weight} onChange={(e) => { setWeight(e.target.value); markDirty(); }} />
                    <span className="text-xs text-text-muted">kg</span>
                  </div>
                </label>
              </Section>
            </div>
          </div>
        </div>

      {/* ===== STICKY BOTTOM SAVE BAR ===== */}
      <div className="sticky -bottom-4 z-[9] border-t border-border bg-surface shadow-[0_-2px_6px_-2px_rgba(16,24,40,.06)] md:-bottom-6">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2.5 text-sm text-text-muted">
            <StatusPill status={status} />
            <span className="text-text-faint">·</span>
            <span className={cn("whitespace-nowrap font-medium", dirty ? "text-warning" : "text-text-muted")}>{dirty ? "Unsaved changes" : mode === "create" ? "Not saved yet" : "All changes saved"}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onCancel} className="h-9 rounded-lg px-4 text-sm font-semibold text-text-muted hover:bg-surface-subtle">Cancel</button>
            <button type="button" onClick={onPublish} disabled={publishDisabled} title={mode === "create" ? "Save the product first" : undefined} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3.5 text-sm font-semibold text-text hover:bg-surface-subtle disabled:opacity-50">
              <ArrowUpCircle className="h-4 w-4" aria-hidden="true" />Publish
            </button>
            <button type="button" onClick={onSave} disabled={pending} className="inline-flex h-9 items-center rounded-lg bg-accent-600 px-4 text-sm font-semibold text-accent-fg shadow-xs hover:bg-accent-700 disabled:opacity-50">{pending ? "Saving…" : "Save product"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A design-system section card with an icon + heading; `compact` tightens the
 * padding for the right rail. `setRef` registers the element for scroll-spy. */
function Section({
  id,
  title,
  icon: Icon,
  children,
  compact,
  setRef,
}: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  compact?: boolean;
  setRef?: (el: HTMLElement | null) => void;
}) {
  return (
    <section
      id={id}
      ref={setRef}
      className="scroll-mt-[120px] overflow-hidden rounded-xl border border-border bg-surface shadow-xs"
    >
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <Icon className="h-4 w-4 text-accent-600" aria-hidden="true" />
        <h2 className="m-0 text-[15px] font-semibold tracking-tight text-text">{title}</h2>
      </div>
      <div className={cn("flex flex-col gap-4", compact ? "p-4" : "p-[18px]")}>{children}</div>
    </section>
  );
}
