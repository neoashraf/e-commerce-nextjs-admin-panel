"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  SlidersHorizontal,
  Image as ImageIcon,
  SearchCode,
  ListFilter,
  CornerDownRight,
  Lock,
  AlertCircle,
  AlertTriangle,
  UploadCloud,
  RefreshCw,
  Trash2,
  Link as LinkIcon,
  Search,
  ArrowRight,
  Check,
} from "lucide-react";
import {
  useCreateCategory,
  useUpdateCategory,
  useUploadCategoryImage,
  useFilterableAttributes,
  useCategoryTree,
} from "@/lib/api/hooks/useCatalog";
import type {
  CategoryDetail,
  CategoryNode,
  CategoryImageSlot,
} from "@/lib/api/schemas/catalog";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/cn";
import { Switch } from "@/components/ui";

/**
 * Category editor — the EDITOR archetype (reuses the Product Editor chrome):
 * full-bleed shell, sticky title bar (breadcrumb + H1), a two-column canvas
 * (main form · sticky "Filterable attributes" right rail), and a sticky bottom
 * save bar. Mirrors docs/design/admin-panel-design-files/Category Editor (CAT).dc.html.
 *
 * Realizes: FR-CAT-001 (name + optional parent/description/image) · FR-CAT-002
 * (slug auto-from-name) · FR-CAT-003/BR-CAT-1 (parent picker disables level-3
 * nodes + live "level-N" preview) · FR-CAT-008 (show_in_menu independent of
 * publish) · FR-CAT-009 (filterable-attribute checklist → facets) · FR-CAT-010a
 * (display mode + logo/banner/thumbnail + SEO meta) · BR-CAT-3 (slug editable
 * before first publish, then locked).
 *
 * Image upload posts to POST /admin/categories/{id}/images; the running BE may
 * not serve it yet (brief: cat-category-editor-be.md) so the uploader degrades
 * to the URL-paste fallback, which persists image_url/logo_url/banner_url via
 * the normal create/update body.
 */

const DISPLAY_MODES = [
  { value: "products_and_description", label: "Products & description" },
  { value: "products_only", label: "Products only" },
  { value: "description_only", label: "Description only" },
];

const labelCls =
  "flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted";
const inputCls =
  "h-[38px] w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1";

type SlotKey = CategoryImageSlot;
type SlotState = "idle" | "uploading" | "preview" | "error";
interface SlotData {
  state: SlotState;
  url: string; // committed URL (sent on save)
  fileName: string;
  progress: number;
  urlVal: string; // url-paste input
}

const SLOTS: { key: SlotKey; title: string; desc: string; box: string }[] = [
  { key: "thumbnail", title: "Thumbnail", desc: "Small image used in lists.", box: "h-[108px] w-[108px]" },
  { key: "logo", title: "Logo", desc: "Square brand mark.", box: "h-[124px] w-[124px]" },
  { key: "banner", title: "Banner", desc: "Wide hero image.", box: "h-[132px] w-full" },
];

/** slot → the category column the BE writes / the FE sends on save. */
const SLOT_FIELD: Record<SlotKey, "image_url" | "logo_url" | "banner_url"> = {
  thumbnail: "image_url",
  logo: "logo_url",
  banner: "banner_url",
};

const IMG_EXT_RE = /\.(jpe?g|png|webp)(\?.*)?$/i;

function flatten(
  nodes: CategoryNode[],
  acc: { id: string; name: string; level: number }[] = [],
) {
  for (const n of nodes) {
    acc.push({ id: n.id, name: n.name, level: n.level });
    if (n.children.length) flatten(n.children, acc);
  }
  return acc;
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function initSlot(url?: string | null): SlotData {
  return {
    state: url ? "preview" : "idle",
    url: url ?? "",
    fileName: url ? url.split("/").pop()?.split("?")[0] ?? "image" : "",
    progress: url ? 100 : 0,
    urlVal: "",
  };
}

export function CategoryEditor({
  mode,
  category,
  defaultParentId,
}: {
  mode: "create" | "edit";
  category?: CategoryDetail;
  defaultParentId?: string;
}) {
  const router = useRouter();
  const { data: tree } = useCategoryTree(false);
  const { data: attributes, isLoading: attrsLoading, isError: attrsError } = useFilterableAttributes();
  const create = useCreateCategory();
  const update = useUpdateCategory(category?.id ?? "");
  const uploadImage = useUploadCategoryImage(category?.id ?? "");

  // ── Form state ───────────────────────────────────────────────────────────
  const [name, setName] = useState(category?.name ?? "");
  const [nameTouched, setNameTouched] = useState(false);
  const [parentId, setParentId] = useState(category?.parent_id ?? defaultParentId ?? "");
  const [displayMode, setDisplayMode] = useState(category?.display_mode ?? "products_and_description");
  const [showInMenu, setShowInMenu] = useState(category?.show_in_menu ?? true);
  const [isPublished, setIsPublished] = useState(category?.is_published ?? false);
  const [description, setDescription] = useState(category?.description ?? "");
  const [metaTitle, setMetaTitle] = useState(category?.meta_title ?? "");
  const [metaKeywords, setMetaKeywords] = useState(category?.meta_keywords ?? "");
  const [metaDesc, setMetaDesc] = useState(category?.meta_description ?? "");
  const [codes, setCodes] = useState<Set<string>>(new Set(category?.filterable_attribute_codes ?? []));

  // slug: auto-derived from name unless the user edits it; locked once published.
  const slugLocked = mode === "edit" && (category?.is_published ?? false);
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(false);

  // image slots
  const [slots, setSlots] = useState<Record<SlotKey, SlotData>>({
    thumbnail: initSlot(category?.image_url),
    logo: initSlot(category?.logo_url),
    banner: initSlot(category?.banner_url),
  });

  const [attrSearch, setAttrSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const fileInputs = useRef<Partial<Record<SlotKey, HTMLInputElement | null>>>({});

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const parentOptions = useMemo(
    () => flatten(tree ?? []).filter((c) => c.id !== category?.id),
    [tree, category?.id],
  );
  const parentLevel = useMemo(() => {
    if (!parentId) return 0;
    return parentOptions.find((c) => c.id === parentId)?.level ?? 0;
  }, [parentId, parentOptions]);
  const childLevel = parentLevel + 1;
  const depthError = childLevel > 3;
  const levelPreview = !parentId
    ? "This will be a top-level (level 1) category."
    : `This will be a level-${childLevel} category.`;

  const nameValid = name.trim().length >= 2 && name.trim().length <= 120;
  const nameError = nameTouched && !nameValid;
  const slugVal = slugLocked
    ? slug
    : slugEdited
      ? slug
      : slugify(name) || (name ? "category" : "");

  const filteredAttrs = useMemo(() => {
    const q = attrSearch.trim().toLowerCase();
    const list = attributes ?? [];
    if (!q) return list;
    return list.filter(
      (a) => a.admin_label.toLowerCase().includes(q) || a.code.toLowerCase().includes(q),
    );
  }, [attributes, attrSearch]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function onNameChange(v: string) {
    setName(v);
    setNameTouched(true);
    markDirty();
  }

  function toggleCode(code: string) {
    setCodes((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
    markDirty();
  }

  function patchSlot(key: SlotKey, patch: Partial<SlotData>) {
    setSlots((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function onPickFile(key: SlotKey, file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      patchSlot(key, { state: "error" });
      return;
    }
    markDirty();
    patchSlot(key, { state: "uploading", progress: 30, fileName: file.name });
    // Direct upload depends on POST /admin/categories/{id}/images (brief filed).
    // Works on edit (we have an id); on create, or if the endpoint isn't live,
    // we fall back to a local object-URL preview and let the user paste a hosted
    // URL via the fallback for a persisted value.
    if (mode === "edit" && category?.id) {
      try {
        const res = await uploadImage.mutateAsync({ file, slot: key });
        patchSlot(key, { state: "preview", progress: 100, url: res.url, fileName: file.name });
        return;
      } catch {
        // fall through to local preview — degrade gracefully
      }
    }
    patchSlot(key, {
      state: "preview",
      progress: 100,
      url: URL.createObjectURL(file),
      fileName: file.name,
    });
  }

  function removeSlot(key: SlotKey) {
    patchSlot(key, { state: "idle", url: "", fileName: "", progress: 0, urlVal: "" });
    markDirty();
  }

  function setSlotUrl(key: SlotKey) {
    const v = slots[key].urlVal.trim();
    if (!v) return;
    if (IMG_EXT_RE.test(v)) {
      patchSlot(key, { state: "preview", url: v, fileName: v.split("/").pop() ?? "image", progress: 100 });
      markDirty();
    } else {
      patchSlot(key, { state: "error" });
    }
  }

  function onCancel() {
    if (dirty) setDiscardOpen(true);
    else router.push("/admin/categories");
  }

  async function onSave() {
    setError(null);
    setNameTouched(true);
    if (!nameValid) {
      setError("Category name must be 2–120 characters.");
      return;
    }
    if (depthError) {
      setError("Categories can be nested up to 3 levels deep.");
      return;
    }
    const body = {
      name: name.trim(),
      parent_id: parentId || null,
      display_mode: displayMode,
      show_in_menu: showInMenu,
      description: description.trim() || undefined,
      image_url: slots.thumbnail.url.trim() || undefined,
      logo_url: slots.logo.url.trim() || undefined,
      banner_url: slots.banner.url.trim() || undefined,
      filterable_attribute_codes: Array.from(codes),
      meta_title: metaTitle.trim() || undefined,
      meta_keywords: metaKeywords.trim() || undefined,
      meta_description: metaDesc.trim() || undefined,
      // slug override on create lands once the BE accepts it (brief filed);
      // included only when the user edited it on an unpublished category.
      ...(mode === "create" && slugEdited && slugVal ? { slug: slugVal } : {}),
      ...(mode === "edit" ? { is_published: isPublished } : {}),
    };
    try {
      if (mode === "create") await create.mutateAsync(body);
      else await update.mutateAsync(body);
      setDirty(false);
      toast("Category saved.");
      router.push("/admin/categories");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400)
        setError("Check the fields — the name may be invalid, the depth too deep, or an attribute code unknown.");
      else setError("Something went wrong. Please try again.");
    }
  }

  const pending = create.isPending || update.isPending;
  const canSave = nameValid && dirty && !depthError;
  const selectedCount = codes.size;
  const title = mode === "create" ? "New category" : `Edit ${name || category?.name}`;
  const crumbLeaf = mode === "create" ? "New category" : name || category?.name || "Category";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    // Full-bleed: break out of the admin <main> padding so the bars pin flush.
    <div className="-m-4 flex min-h-full flex-col md:-m-6">
      {/* ===== STICKY TITLE BAR ===== */}
      <div className="sticky -top-4 z-[9] border-b border-border bg-surface md:-top-6">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-3.5 md:px-6">
          <nav className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
            <span>Catalog</span>
            <ChevronRight className="h-3.5 w-3.5 text-text-faint" aria-hidden="true" />
            <Link href="/admin/categories" className="hover:text-accent-600">Categories</Link>
            <ChevronRight className="h-3.5 w-3.5 text-text-faint" aria-hidden="true" />
            <span className="max-w-[280px] truncate font-medium text-text-secondary">{crumbLeaf}</span>
          </nav>
          <h1 className="m-0 max-w-[620px] truncate text-[22px] font-bold leading-7 tracking-tight text-text">
            {title}
          </h1>
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div className="mx-auto w-full max-w-[1280px] flex-1 px-5 pb-8 pt-5 md:px-6">
        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* ============ MAIN COLUMN ============ */}
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            {/* ===== GENERAL ===== */}
            <Section title="General" icon={SlidersHorizontal}>
              {/* Name */}
              <label className="block">
                <span className={cn(labelCls, "mb-1.5")}>
                  Name <span className="text-error">*</span>
                </span>
                <input
                  className={cn(inputCls, nameError && "border-error")}
                  value={name}
                  maxLength={120}
                  placeholder="e.g. Football Boots"
                  aria-required="true"
                  aria-invalid={nameError || undefined}
                  onChange={(e) => onNameChange(e.target.value)}
                />
                {nameError && (
                  <span className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-error">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    Category name must be 2–120 characters.
                  </span>
                )}
              </label>

              {/* Parent category */}
              <label className="block">
                <span className={cn(labelCls, "mb-1.5")}>Parent category</span>
                <div className="relative">
                  <select
                    className={cn(
                      "h-[38px] w-full appearance-none rounded-lg border bg-surface pl-3 pr-9 text-sm font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1",
                      depthError ? "border-error" : "border-border-strong",
                    )}
                    value={parentId}
                    onChange={(e) => {
                      setParentId(e.target.value);
                      markDirty();
                    }}
                  >
                    <option value="">— None (top level)</option>
                    {parentOptions.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.level >= 3}>
                        {"   ".repeat(Math.max(0, c.level - 1))}
                        {c.name}
                        {c.level >= 3 ? "  (max depth)" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-text-muted" aria-hidden="true" />
                </div>
                {depthError ? (
                  <span className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-error">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    Categories can be nested up to 3 levels deep.
                  </span>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 py-0.5 pl-2 pr-2.5 text-[11.5px] font-semibold text-accent-700">
                      <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                      {levelPreview}
                    </span>
                    <span className="text-[11.5px] text-text-muted">Leave empty for a top-level category.</span>
                  </div>
                )}
              </label>

              {/* Display mode */}
              <label className="block max-w-[340px]">
                <span className={cn(labelCls, "mb-1.5")}>Display mode</span>
                <div className="relative">
                  <select
                    className="h-[38px] w-full appearance-none rounded-lg border border-border-strong bg-surface pl-3 pr-9 text-sm font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1"
                    value={displayMode}
                    onChange={(e) => {
                      setDisplayMode(e.target.value);
                      markDirty();
                    }}
                  >
                    {DISPLAY_MODES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-text-muted" aria-hidden="true" />
                </div>
              </label>

              <div className="h-px bg-border" />

              {/* Show in menu */}
              <div className="flex items-center justify-between gap-3.5">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-text">Show in menu</div>
                  <div className="mt-0.5 text-[11.5px] text-text-muted">
                    Show in the top navigation (independent of publish).
                  </div>
                </div>
                <Switch
                  checked={showInMenu}
                  onChange={(v) => {
                    setShowInMenu(v);
                    markDirty();
                  }}
                  label="Show in menu"
                />
              </div>

              {/* Published (edit only) */}
              {mode === "edit" && (
                <>
                  <div className="h-px bg-border" />
                  <div className="flex items-center justify-between gap-3.5">
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-text">Published</div>
                      <div className="mt-0.5 text-[11.5px] text-text-muted">
                        Unpublishing also hides all sub-categories.
                      </div>
                    </div>
                    <Switch
                      checked={isPublished}
                      onChange={(v) => {
                        setIsPublished(v);
                        markDirty();
                      }}
                      label="Published"
                    />
                  </div>
                </>
              )}
            </Section>

            {/* ===== DESCRIPTION & IMAGES ===== */}
            <Section title="Description & images" icon={ImageIcon}>
              <label className="block">
                <span className={cn(labelCls, "mb-1.5")}>Description</span>
                <textarea
                  className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-sm leading-relaxed text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1"
                  rows={3}
                  placeholder="Optional. Shown on the category page."
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    markDirty();
                  }}
                />
              </label>

              {SLOTS.map((slot) => {
                const s = slots[slot.key];
                return (
                  <div key={slot.key}>
                    <div className="mb-2 flex items-baseline justify-between gap-2.5">
                      <span className={labelCls}>{slot.title}</span>
                      <span className="text-[11.5px] text-text-muted">{slot.desc}</span>
                    </div>

                    <input
                      ref={(el) => {
                        fileInputs.current[slot.key] = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        onPickFile(slot.key, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />

                    {/* IDLE */}
                    {s.state === "idle" && (
                      <button
                        type="button"
                        onClick={() => fileInputs.current[slot.key]?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          onPickFile(slot.key, e.dataTransfer.files?.[0]);
                        }}
                        aria-label={`Upload ${slot.title}`}
                        className={cn(
                          "flex max-w-full flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-border-strong bg-surface-subtle p-2.5 text-center text-text-muted transition-colors hover:border-accent-500 hover:bg-surface-hover",
                          slot.box,
                        )}
                      >
                        <UploadCloud className="h-[22px] w-[22px] text-text-muted" aria-hidden="true" />
                        <span className="text-xs font-semibold text-text-secondary">Drag &amp; drop or browse</span>
                        <span className="text-[11px] text-text-muted">JPEG, PNG or WebP, up to 5 MB.</span>
                      </button>
                    )}

                    {/* UPLOADING */}
                    {s.state === "uploading" && (
                      <div
                        className={cn(
                          "flex max-w-full flex-col items-center justify-center gap-2.5 rounded-[10px] border border-border bg-surface p-3.5",
                          slot.box,
                        )}
                      >
                        <span className="text-xs font-semibold text-text-secondary">Uploading… {s.progress}%</span>
                        <div className="h-1.5 w-4/5 max-w-[220px] overflow-hidden rounded-full bg-surface-subtle">
                          <div className="h-full rounded-full bg-accent-600 transition-[width]" style={{ width: `${s.progress}%` }} />
                        </div>
                      </div>
                    )}

                    {/* PREVIEW */}
                    {s.state === "preview" && (
                      <div className="flex flex-wrap items-end gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.url}
                          alt={`${slot.title} preview`}
                          className={cn("max-w-full rounded-[10px] border border-border object-cover", slot.box)}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputs.current[slot.key]?.click()}
                            className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-border-strong bg-surface px-2.5 text-[12.5px] font-semibold text-text-secondary hover:bg-surface-subtle"
                          >
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Replace
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSlot(slot.key)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-error/40 bg-surface px-2.5 text-[12.5px] font-semibold text-error hover:bg-error/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Remove
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ERROR */}
                    {s.state === "error" && (
                      <div
                        className={cn(
                          "flex max-w-full flex-col items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-error/50 bg-error/5 p-3.5 text-center",
                          slot.box,
                        )}
                      >
                        <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
                        <span className="text-xs font-medium leading-snug text-error">
                          Image must be JPEG, PNG or WebP and under 5 MB.
                        </span>
                        <button
                          type="button"
                          onClick={() => fileInputs.current[slot.key]?.click()}
                          className="mt-0.5 inline-flex h-[30px] items-center gap-1.5 rounded-[7px] border border-error/40 bg-surface px-2.5 text-xs font-semibold text-error hover:bg-error/10"
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Try again
                        </button>
                      </div>
                    )}

                    {/* URL-paste fallback */}
                    <div className="mt-2.5 flex max-w-[440px] items-center gap-2">
                      <div className="flex h-[34px] min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-strong bg-surface px-2.5">
                        <LinkIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                        <input
                          type="text"
                          aria-label={`Paste image URL for ${slot.title}`}
                          placeholder="…or paste an image URL"
                          className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] text-text outline-none"
                          value={s.urlVal}
                          onChange={(e) => patchSlot(slot.key, { urlVal: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), setSlotUrl(slot.key))}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setSlotUrl(slot.key)}
                        className="h-[34px] shrink-0 rounded-lg border border-border-strong bg-surface px-3 text-[12.5px] font-semibold text-text-secondary hover:bg-surface-subtle"
                      >
                        Set
                      </button>
                    </div>
                  </div>
                );
              })}
            </Section>

            {/* ===== SEO ===== */}
            <Section title="SEO" icon={SearchCode}>
              <label className="block">
                <span className={cn(labelCls, "mb-1.5")}>Slug</span>
                {slugLocked ? (
                  <div className="flex h-[38px] items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3">
                    <span className="font-mono text-[13px] text-text-muted">/</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[13.5px] text-text-secondary">{slugVal}</span>
                    <Lock className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                    <span className="shrink-0 text-[11.5px] text-text-muted">Locked</span>
                  </div>
                ) : (
                  <div className="flex h-[38px] items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 focus-within:ring-2 focus-within:ring-accent-600 focus-within:ring-offset-1">
                    <span className="font-mono text-[13px] text-text-muted">/</span>
                    <input
                      type="text"
                      aria-label="Slug"
                      className="min-w-0 flex-1 bg-transparent font-mono text-[13.5px] text-text outline-none"
                      value={slugVal}
                      onChange={(e) => {
                        setSlug(slugify(e.target.value));
                        setSlugEdited(true);
                        markDirty();
                      }}
                    />
                  </div>
                )}
                <span className="mt-1.5 block text-[11.5px] text-text-muted">
                  Auto-generated from the name; locked once published.
                </span>
              </label>

              <label className="block">
                <span className={cn(labelCls, "mb-1.5")}>Meta title</span>
                <input
                  className={inputCls}
                  placeholder="Defaults to the category name"
                  value={metaTitle}
                  onChange={(e) => {
                    setMetaTitle(e.target.value);
                    markDirty();
                  }}
                />
              </label>

              <label className="block">
                <span className={cn(labelCls, "mb-1.5")}>Meta keywords</span>
                <input
                  className={inputCls}
                  placeholder="comma, separated, terms"
                  value={metaKeywords}
                  onChange={(e) => {
                    setMetaKeywords(e.target.value);
                    markDirty();
                  }}
                />
              </label>

              <label className="block">
                <span className={cn(labelCls, "mb-1.5")}>Meta description</span>
                <textarea
                  className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-sm leading-relaxed text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1"
                  rows={3}
                  placeholder="Defaults to the description"
                  value={metaDesc}
                  onChange={(e) => {
                    setMetaDesc(e.target.value);
                    markDirty();
                  }}
                />
              </label>
            </Section>
          </div>

          {/* ============ RIGHT RAIL — FILTERABLE ATTRIBUTES ============ */}
          <aside className="w-full shrink-0 lg:sticky lg:top-[96px] lg:w-[330px]">
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
              <div className="border-b border-border px-4 py-3.5">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <ListFilter className="h-4 w-4 text-accent-600" aria-hidden="true" />
                    <h2 className="m-0 text-[15px] font-semibold tracking-tight text-text">Filterable attributes</h2>
                  </div>
                  {!attrsLoading && !attrsError && (
                    <span className="whitespace-nowrap rounded-full bg-accent-50 px-2.5 py-0.5 text-[11.5px] font-semibold tabular-nums text-accent-700">
                      {selectedCount} selected
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-text-muted">
                  Checked attributes become layered-nav facets for this category.
                </p>
              </div>

              {attrsLoading ? (
                <div className="flex flex-col gap-3 p-3.5">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <span className="h-[18px] w-[18px] shrink-0 rounded bg-surface-subtle" />
                      <span className="flex flex-1 flex-col gap-1.5">
                        <span className="h-2.5 w-3/5 animate-pulse rounded bg-surface-subtle" />
                        <span className="h-2 w-1/3 rounded bg-surface-subtle" />
                      </span>
                    </div>
                  ))}
                </div>
              ) : attrsError ? (
                <div className="flex flex-col items-center gap-2.5 px-4 py-8 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-error/10 text-error">
                    <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="text-[13px] font-semibold text-text">Couldn&apos;t load filterable attributes</div>
                  <button
                    type="button"
                    onClick={() => router.refresh()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 text-[12.5px] font-semibold text-text-secondary hover:bg-surface-subtle"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Retry
                  </button>
                </div>
              ) : !attributes || attributes.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-subtle text-text-muted">
                    <ListFilter className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="text-[13px] leading-relaxed text-text-secondary">
                    No filterable attributes defined yet. Create attributes to enable layered-nav facets.
                  </div>
                  <Link
                    href="/admin/attributes"
                    className="mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-600 hover:text-accent-700"
                  >
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />Go to Attributes
                  </Link>
                </div>
              ) : (
                <>
                  <div className="px-3 pb-1.5 pt-2.5">
                    <div className="flex h-[34px] items-center gap-2 rounded-lg border border-border-strong bg-surface px-2.5">
                      <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                      <input
                        type="text"
                        aria-label="Search attributes"
                        placeholder="Search attributes…"
                        className="min-w-0 flex-1 bg-transparent text-[12.5px] text-text outline-none"
                        value={attrSearch}
                        onChange={(e) => setAttrSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto px-2 pb-2.5">
                    {filteredAttrs.map((a) => {
                      const on = codes.has(a.code);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => toggleCode(a.code)}
                          className={cn(
                            "mb-px flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition-colors hover:bg-surface-subtle",
                            on && "bg-accent-50",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] text-white",
                              on ? "border-accent-600 bg-accent-600" : "border-border-strong bg-surface",
                            )}
                          >
                            {on && <Check className="h-3 w-3" aria-hidden="true" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-text">{a.admin_label}</span>
                            <span className="mt-px block font-mono text-[11px] text-text-muted">{a.code}</span>
                          </span>
                        </button>
                      );
                    })}
                    {filteredAttrs.length === 0 && (
                      <div className="px-2.5 py-5 text-center text-[12.5px] text-text-muted">
                        No attributes match “{attrSearch}”.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ===== STICKY BOTTOM SAVE BAR ===== */}
      <div className="sticky -bottom-4 z-[9] border-t border-border bg-surface shadow-[0_-2px_6px_-2px_rgba(16,24,40,.06)] md:-bottom-6">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-5 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            {dirty ? (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-warning">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />Unsaved changes
              </span>
            ) : (
              <span className="whitespace-nowrap text-text-muted">
                {mode === "edit" ? "All changes saved" : "Start by naming the category"}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-9 rounded-lg px-4 text-sm font-semibold text-text-muted hover:bg-surface-subtle"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave || pending}
              aria-disabled={!canSave || pending}
              className="inline-flex h-9 items-center rounded-lg bg-accent-600 px-5 text-sm font-semibold text-accent-fg shadow-xs hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* ===== DISCARD-CHANGES GUARD ===== */}
      {discardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setDiscardOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Discard changes?"
            className="relative w-[412px] max-w-full rounded-2xl bg-surface p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-warning/10 text-warning">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="m-0 text-[15px] font-bold text-text">Discard changes?</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
                  Your unsaved edits to this category will be lost.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDiscardOpen(false)}
                className="h-9 rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary hover:bg-surface-subtle"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => router.push("/admin/categories")}
                className="h-9 rounded-lg bg-error px-4 text-sm font-semibold text-white hover:opacity-90"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Design-system section card with an icon + heading (matches ProductEditor). */
function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <Icon className="h-4 w-4 text-accent-600" aria-hidden="true" />
        <h2 className="m-0 text-[15px] font-semibold tracking-tight text-text">{title}</h2>
      </div>
      <div className="flex flex-col gap-[18px] p-[18px]">{children}</div>
    </section>
  );
}
