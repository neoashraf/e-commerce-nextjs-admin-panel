"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  Image as ImageIcon,
  Layers,
  Link2,
  Lock,
  RotateCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";
import {
  useCreateCategory,
  useUpdateCategory,
  useFilterableAttributes,
  useCategoryTree,
  useUploadCategoryImage,
} from "@/lib/api/hooks/useCatalog";
import type { CategoryDetail, CategoryNode, CategoryImageSlot } from "@/lib/api/schemas/catalog";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/cn";
import { Button, Input, Select } from "@/components/ui";

const DISPLAY_MODES = [
  { value: "products_and_description", label: "Products & description" },
  { value: "products_only", label: "Products only" },
  { value: "description_only", label: "Description only" },
];

const slugify = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const isImageUrl = (u: string): boolean => /\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i.test(u.trim());

interface FlatParent {
  id: string;
  name: string;
  level: number;
}
function flattenParents(nodes: CategoryNode[], acc: FlatParent[] = []): FlatParent[] {
  for (const n of nodes) {
    acc.push({ id: n.id, name: n.name, level: n.level });
    if (n.children.length) flattenParents(n.children, acc);
  }
  return acc;
}

const SLOTS: { key: CategoryImageSlot; title: string; desc: string; wide?: boolean }[] = [
  { key: "thumbnail", title: "Thumbnail", desc: "Small image used in lists." },
  { key: "logo", title: "Logo", desc: "Square brand mark." },
  { key: "banner", title: "Banner", desc: "Wide hero image.", wide: true },
];

type SlotStatus = "idle" | "uploading" | "preview" | "error";
interface SlotState {
  status: SlotStatus;
  url: string | null;
  urlVal: string;
}

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="mb-1.5 block text-eyebrow font-semibold uppercase tracking-wide text-text-muted">
    {children}
  </span>
);

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-border px-[18px] py-3.5">
        <span className="text-accent-600">{icon}</span>
        <h2 className="text-[15px] font-semibold tracking-tight text-text">{title}</h2>
      </div>
      <div className="p-[18px]">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn("relative h-[23px] w-10 shrink-0 rounded-full transition-colors", checked ? "bg-accent-600" : "bg-border-strong")}
    >
      <span className={cn("absolute top-0.5 h-[19px] w-[19px] rounded-full bg-white shadow-sm transition-all", checked ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

/**
 * Category editor (catalog-categories-redesign-fe) — built to `Category Editor (CAT).dc.html`.
 * Two-column canvas (General · Description & images · SEO + a sticky Filterable-attributes rail),
 * sticky title + save bars, three image uploaders (file upload in edit; URL-paste fallback),
 * level-preview, meta_keywords, field-specific errors, and a discard guard.
 */
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
  const { data: attributes, isLoading: attrsLoading, isError: attrsError, refetch: refetchAttrs } = useFilterableAttributes();
  const create = useCreateCategory();
  const update = useUpdateCategory(category?.id ?? "");
  const upload = useUploadCategoryImage(category?.id ?? "");

  const [name, setName] = useState(category?.name ?? "");
  const [parentId, setParentId] = useState(category?.parent_id ?? defaultParentId ?? "");
  const [displayMode, setDisplayMode] = useState(category?.display_mode ?? "products_and_description");
  const [showInMenu, setShowInMenu] = useState(category?.show_in_menu ?? true);
  const [isPublished, setIsPublished] = useState(category?.is_published ?? false);
  const [description, setDescription] = useState(category?.description ?? "");
  const [metaTitle, setMetaTitle] = useState(category?.meta_title ?? "");
  const [metaKeywords, setMetaKeywords] = useState(category?.meta_keywords ?? "");
  const [metaDesc, setMetaDesc] = useState(category?.meta_description ?? "");
  const [codes, setCodes] = useState<Set<string>>(new Set(category?.filterable_attribute_codes ?? []));
  const [attrSearch, setAttrSearch] = useState("");

  const [images, setImages] = useState<Record<CategoryImageSlot, SlotState>>({
    thumbnail: { status: category?.image_url ? "preview" : "idle", url: category?.image_url ?? null, urlVal: "" },
    logo: { status: category?.logo_url ? "preview" : "idle", url: category?.logo_url ?? null, urlVal: "" },
    banner: { status: category?.banner_url ? "preview" : "idle", url: category?.banner_url ?? null, urlVal: "" },
  });

  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [depthError, setDepthError] = useState<string | null>(null);
  const [staleWarn, setStaleWarn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const markDirty = () => setDirty(true);

  const parentOptions = useMemo(() => flattenParents(tree ?? []).filter((c) => c.id !== category?.id), [tree, category?.id]);
  const slugLocked = mode === "edit" && (category?.is_published ?? false);
  const slugValue = mode === "edit" ? category?.slug ?? "" : slugify(name);
  const parentLevel = parentId ? parentOptions.find((c) => c.id === parentId)?.level ?? 0 : 0;
  const previewLevel = parentId ? parentLevel + 1 : 1;
  const nameValid = name.trim().length >= 2 && name.trim().length <= 120;
  const canSave = nameValid && dirty;
  const pending = create.isPending || update.isPending;
  const canUpload = mode === "edit" && !!category?.id;

  const availableCodes = useMemo(() => new Set((attributes ?? []).map((a) => a.code)), [attributes]);
  const filteredAttrs = (attributes ?? []).filter(
    (a) =>
      a.admin_label.toLowerCase().includes(attrSearch.toLowerCase()) ||
      a.code.toLowerCase().includes(attrSearch.toLowerCase()),
  );

  function toggleCode(code: string) {
    setCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    markDirty();
  }

  function setSlot(slot: CategoryImageSlot, patch: Partial<SlotState>) {
    setImages((prev) => ({ ...prev, [slot]: { ...prev[slot], ...patch } }));
  }

  async function onFile(slot: CategoryImageSlot, file: File) {
    if (!canUpload) {
      toast("Save the category first, then upload — or paste an image URL below.", "info");
      return;
    }
    setSlot(slot, { status: "uploading" });
    try {
      const res = await upload.mutateAsync({ file, slot });
      setSlot(slot, { status: "preview", url: res.url });
      markDirty();
    } catch {
      setSlot(slot, { status: "error" });
    }
  }

  function onSetUrl(slot: CategoryImageSlot) {
    const v = images[slot].urlVal.trim();
    if (!v) return;
    if (!isImageUrl(v)) {
      setSlot(slot, { status: "error" });
      return;
    }
    setSlot(slot, { status: "preview", url: v, urlVal: "" });
    markDirty();
  }

  function onRemove(slot: CategoryImageSlot) {
    setSlot(slot, { status: "idle", url: null });
    markDirty();
  }

  function cancel() {
    if (dirty) setDiscardOpen(true);
    else router.push("/admin/categories");
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);
    setDepthError(null);
    setStaleWarn(false);
    setFormError(null);
    if (!nameValid) {
      setNameError("Category name must be 2–120 characters.");
      return;
    }
    const body = {
      name: name.trim(),
      parent_id: parentId || null,
      display_mode: displayMode,
      show_in_menu: showInMenu,
      description: description.trim() || undefined,
      image_url: images.thumbnail.url,
      logo_url: images.logo.url,
      banner_url: images.banner.url,
      filterable_attribute_codes: Array.from(codes),
      meta_title: metaTitle.trim() || undefined,
      meta_keywords: metaKeywords.trim() || undefined,
      meta_description: metaDesc.trim() || undefined,
      ...(mode === "edit" ? { is_published: isPublished } : {}),
    };
    try {
      if (mode === "create") await create.mutateAsync(body);
      else await update.mutateAsync(body);
      toast("Category saved.");
      router.push("/admin/categories");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "MAX_DEPTH_EXCEEDED") setDepthError("Categories can be nested up to 3 levels deep.");
        else if (err.code === "PARENT_NOT_FOUND" || err.code === "INVALID_PARENT") setDepthError("That parent category isn’t valid. Pick a different parent.");
        else if (err.code === "UNKNOWN_ATTRIBUTE_CODES") setStaleWarn(true);
        else if (err.fieldErrors.name) setNameError(err.fieldErrors.name);
        else setFormError(err.message || "Something went wrong. Please try again.");
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  }

  const crumbLeaf = mode === "create" ? "New category" : category?.name ?? "Edit category";
  const title = mode === "create" ? "New category" : `Edit ${category?.name ?? "category"}`;

  return (
    <form onSubmit={onSave}>
      {/* A. Sticky title bar — inset within the shell's padded scroll area (no vertical
          bleed, which would overlap the General card when pinned). */}
      <div className="sticky top-0 z-30 -mx-4 mb-5 rounded-b-xl border-b border-border bg-surface px-4 py-3.5 shadow-sm md:-mx-6 md:px-6">
        <nav className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
          <span>Catalog</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-faint" />
          <Link href="/admin/categories" className="hover:text-accent-600">Categories</Link>
          <ChevronRight className="h-3.5 w-3.5 text-text-faint" />
          <span className="max-w-[280px] truncate font-medium text-text-secondary">{crumbLeaf}</span>
        </nav>
        <h1 className="text-[22px] font-bold leading-7 tracking-tight text-text">{title}</h1>
      </div>

      {formError && (
        <p role="alert" className="mb-5 rounded-md border border-error/30 bg-error-50 px-3 py-2 text-sm text-error">{formError}</p>
      )}

      <div className="flex flex-col items-start gap-6 lg:flex-row">
        {/* Main column */}
        <div className="min-w-0 flex-1 space-y-5">
          {/* General */}
          <SectionCard icon={<Settings2 className="h-[18px] w-[18px]" />} title="General">
            <div className="space-y-[17px]">
              <label className="block">
                <Eyebrow>Name <span className="text-error">*</span></Eyebrow>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(null); markDirty(); }}
                  maxLength={120}
                  placeholder="e.g. Football Boots"
                  aria-required
                  error={nameError ?? undefined}
                />
              </label>

              <label className="block">
                <Eyebrow>Parent category</Eyebrow>
                <Select aria-label="Parent category" value={parentId} onChange={(e) => { setParentId(e.target.value); setDepthError(null); markDirty(); }} error={depthError ?? undefined}>
                  <option value="">— None (top level)</option>
                  {parentOptions.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.level >= 3}>
                      {"— ".repeat(Math.max(0, c.level - 1))}{c.name}{c.level >= 3 ? "  (max depth)" : ""}
                    </option>
                  ))}
                </Select>
                {depthError ? (
                  <p className="mt-1.5 text-xs text-error">{depthError}</p>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-1 text-[11.5px] font-semibold text-accent-700">
                      <Layers className="h-3 w-3" /> This will be a level-{previewLevel} category
                    </span>
                    <span className="text-[11.5px] text-text-faint">Leave empty for a top-level category.</span>
                  </div>
                )}
              </label>

              <label className="block max-w-sm">
                <Eyebrow>Display mode</Eyebrow>
                <Select value={displayMode} onChange={(e) => { setDisplayMode(e.target.value); markDirty(); }}>
                  {DISPLAY_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </label>

              <div className="h-px bg-border" />

              <div className="flex items-center justify-between gap-3.5">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-text">Show in menu</div>
                  <div className="mt-0.5 text-[11.5px] text-text-faint">Show in the top navigation (independent of publish).</div>
                </div>
                <Toggle checked={showInMenu} onChange={() => { setShowInMenu((v) => !v); markDirty(); }} label="Show in menu" />
              </div>

              {mode === "edit" && (
                <>
                  <div className="h-px bg-border" />
                  <div className="flex items-center justify-between gap-3.5">
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-text">Published</div>
                      <div className="mt-0.5 text-[11.5px] text-text-faint">Unpublishing also hides all sub-categories.</div>
                    </div>
                    <Toggle checked={isPublished} onChange={() => { setIsPublished((v) => !v); markDirty(); }} label="Published" />
                  </div>
                </>
              )}
            </div>
          </SectionCard>

          {/* Description & images */}
          <SectionCard icon={<ImageIcon className="h-[18px] w-[18px]" />} title="Description & images">
            <div className="space-y-[18px]">
              <label className="block">
                <Eyebrow>Description</Eyebrow>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); markDirty(); }}
                  placeholder="Optional. Shown on the category page."
                  className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[13.5px] leading-relaxed text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                />
              </label>

              {SLOTS.map((s) => (
                <ImageSlotField
                  key={s.key}
                  slot={s.key}
                  title={s.title}
                  desc={s.desc}
                  wide={s.wide}
                  state={images[s.key]}
                  canUpload={canUpload}
                  uploadHint={!canUpload}
                  onFile={(file) => onFile(s.key, file)}
                  onUrlChange={(v) => setSlot(s.key, { urlVal: v })}
                  onSetUrl={() => onSetUrl(s.key)}
                  onRemove={() => onRemove(s.key)}
                />
              ))}
            </div>
          </SectionCard>

          {/* SEO */}
          <SectionCard icon={<SlidersHorizontal className="h-[18px] w-[18px]" />} title="SEO">
            <div className="space-y-4">
              <label className="block">
                <Eyebrow>Slug</Eyebrow>
                <div className={cn("flex h-9 items-center gap-2 rounded-md border px-3", slugLocked ? "border-border bg-surface-subtle" : "border-border-strong bg-surface")}>
                  <span className="font-mono text-sm text-text-faint">/</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[13.5px] text-text-secondary">{slugValue || "(auto from name)"}</span>
                  {slugLocked && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-text-faint">
                      <Lock className="h-3.5 w-3.5" /> Locked
                    </span>
                  )}
                </div>
                <span className="mt-1.5 block text-[11.5px] text-text-faint">Auto-generated from the name; locked once published.</span>
              </label>

              <label className="block">
                <Eyebrow>Meta title</Eyebrow>
                <Input value={metaTitle} onChange={(e) => { setMetaTitle(e.target.value); markDirty(); }} placeholder="Defaults to the category name" />
              </label>

              <label className="block">
                <Eyebrow>Meta keywords</Eyebrow>
                <Input value={metaKeywords} onChange={(e) => { setMetaKeywords(e.target.value); markDirty(); }} placeholder="comma, separated, terms" />
              </label>

              <label className="block">
                <Eyebrow>Meta description</Eyebrow>
                <textarea
                  rows={3}
                  value={metaDesc}
                  onChange={(e) => { setMetaDesc(e.target.value); markDirty(); }}
                  placeholder="Defaults to the description"
                  className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[13.5px] leading-relaxed text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                />
              </label>
            </div>
          </SectionCard>
        </div>

        {/* Right rail — Filterable attributes */}
        <aside className="w-full lg:sticky lg:top-20 lg:w-[330px] lg:shrink-0">
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-4 py-3.5">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-accent-600"><SlidersHorizontal className="h-[18px] w-[18px]" /></span>
                  <h2 className="text-[15px] font-semibold tracking-tight text-text">Filterable attributes</h2>
                </div>
                {!attrsLoading && !attrsError && (attributes?.length ?? 0) > 0 && (
                  <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-[11.5px] font-semibold tabular-nums text-accent-700">{codes.size} selected</span>
                )}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">Checked attributes become layered-nav facets for this category.</p>
            </div>

            {attrsLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="h-[18px] w-[18px] shrink-0 rounded bg-surface-subtle" />
                    <span className="h-3 flex-1 animate-pulse rounded bg-surface-subtle" />
                  </div>
                ))}
              </div>
            ) : attrsError ? (
              <div className="flex flex-col items-center gap-2.5 px-5 py-8 text-center">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-error-50 text-error"><SlidersHorizontal className="h-5 w-5" /></span>
                <div className="text-[13px] font-semibold text-text">Couldn’t load filterable attributes</div>
                <Button variant="secondary" size="sm" leadingIcon={<RotateCw className="h-3.5 w-3.5" />} onClick={() => refetchAttrs()}>Retry</Button>
              </div>
            ) : (attributes?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-subtle text-text-faint"><SlidersHorizontal className="h-5 w-5" /></span>
                <div className="text-[13px] leading-relaxed text-text-secondary">No filterable attributes defined yet. Create attributes to enable layered-nav facets.</div>
                <Link href="/admin/attributes" className="mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-600 hover:text-accent-700">
                  <ArrowRight className="h-3.5 w-3.5" /> Go to Attributes
                </Link>
              </div>
            ) : (
              <>
                <div className="px-3 pb-1.5 pt-3">
                  <div className="flex h-[34px] items-center gap-2 rounded-md border border-border-strong bg-surface px-2.5">
                    <Search className="h-3.5 w-3.5 shrink-0 text-text-faint" />
                    <input
                      type="text"
                      aria-label="Search attributes"
                      placeholder="Search attributes…"
                      value={attrSearch}
                      onChange={(e) => setAttrSearch(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-[12.5px] text-text outline-none placeholder:text-text-faint"
                    />
                  </div>
                </div>
                <div className="max-h-[420px] overflow-y-auto px-2 pb-2.5">
                  {filteredAttrs.map((a) => {
                    const checked = codes.has(a.code);
                    const stale = staleWarn && checked && !availableCodes.has(a.code);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggleCode(a.code)}
                        className="mb-px flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left hover:bg-surface-subtle"
                      >
                        <span className={cn("grid h-[18px] w-[18px] shrink-0 place-items-center rounded border", checked ? "border-accent-600 bg-accent-600 text-white" : "border-border-strong bg-surface")}>
                          {checked && <CheckIcon />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-text">{a.admin_label}</span>
                          <span className="mt-px block truncate font-mono text-[11px] text-text-faint">{a.code}</span>
                        </span>
                        {stale && <span title="No longer available" className="shrink-0 text-warning">⚠</span>}
                      </button>
                    );
                  })}
                  {filteredAttrs.length === 0 && (
                    <div className="px-2.5 py-5 text-center text-[12.5px] text-text-faint">No attributes match “{attrSearch}”.</div>
                  )}
                </div>
                {staleWarn && (
                  <div className="mx-3 mb-3 rounded-lg border border-warning/40 bg-warning-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-warning">
                    One or more selected filterable attributes are no longer available.
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      {/* F. Sticky save bar — inset within the shell's padded scroll area. */}
      <div className="sticky bottom-0 z-30 -mx-4 mt-6 rounded-t-xl border-t border-border bg-surface px-4 py-3 shadow-[0_-2px_6px_-2px_rgba(16,24,40,0.10)] md:-mx-6 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            {dirty ? (
              <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-warning">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved changes
              </span>
            ) : (
              <span className="text-[12.5px] text-text-faint">{mode === "edit" ? "All changes saved" : "Fill in the name to get started"}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Button type="button" variant="secondary" onClick={cancel}>Cancel</Button>
            <Button type="submit" disabled={!canSave} loading={pending}>Save</Button>
          </div>
        </div>
      </div>

      {/* Discard guard */}
      {discardOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDiscardOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Discard changes?" className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-lg">
            <h2 className="text-[15px] font-bold text-text">Discard changes?</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-secondary">Your unsaved edits to this category will be lost.</p>
            <div className="mt-4 flex items-center justify-end gap-2.5">
              <Button variant="secondary" onClick={() => setDiscardOpen(false)}>Keep editing</Button>
              <Button variant="destructive" onClick={() => router.push("/admin/categories")}>Discard</Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Image slot                                                                 */
/* -------------------------------------------------------------------------- */

function ImageSlotField({
  title,
  desc,
  wide,
  state,
  canUpload,
  uploadHint,
  onFile,
  onUrlChange,
  onSetUrl,
  onRemove,
}: {
  slot: CategoryImageSlot;
  title: string;
  desc: string;
  wide?: boolean;
  state: SlotState;
  canUpload: boolean;
  uploadHint: boolean;
  onFile: (file: File) => void;
  onUrlChange: (v: string) => void;
  onSetUrl: () => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const boxSize = wide ? "h-[132px] w-full" : "h-[120px] w-[120px]";

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2.5">
        <Eyebrow>{title}</Eyebrow>
        <span className="text-[11.5px] text-text-faint">{desc}</span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />

      {state.status === "preview" && state.url ? (
        <div className="flex flex-wrap items-end gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.url} alt={`${title} preview`} className={cn("rounded-[10px] border border-border object-cover", boxSize)} />
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" leadingIcon={<RotateCw className="h-3.5 w-3.5" />} onClick={() => (canUpload ? fileRef.current?.click() : undefined)} disabled={!canUpload}>Replace</Button>
            <Button type="button" variant="secondary" size="sm" leadingIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={onRemove} className="text-error">Remove</Button>
          </div>
        </div>
      ) : state.status === "uploading" ? (
        <div className={cn("flex flex-col items-center justify-center gap-2.5 rounded-[10px] border border-border bg-surface p-3.5", boxSize)}>
          <span className="text-xs font-semibold text-text-secondary">Uploading…</span>
          <div className="h-1.5 w-3/5 overflow-hidden rounded-full bg-surface-subtle">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-accent-600" />
          </div>
        </div>
      ) : state.status === "error" ? (
        <div className={cn("flex flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-error/50 bg-error-50 p-3.5 text-center", boxSize)}>
          <span className="text-xs font-medium text-error">Image must be JPEG, PNG or WebP and under 5 MB.</span>
          <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={!canUpload}>Try again</Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => (canUpload ? fileRef.current?.click() : undefined)}
          className={cn("flex flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border-strong bg-surface-subtle p-2.5 text-center", boxSize, canUpload ? "cursor-pointer hover:border-accent-500" : "cursor-default")}
        >
          {canUpload ? <UploadCloud className="h-5 w-5 text-text-faint" /> : <Upload className="h-5 w-5 text-text-faint" />}
          <span className="text-xs font-semibold text-text-secondary">{canUpload ? "Drag & drop or browse" : "Paste a URL below"}</span>
          <span className="text-[11px] text-text-faint">{canUpload ? "JPEG, PNG or WebP, up to 5 MB." : "Upload after saving the category."}</span>
        </button>
      )}

      {/* URL-paste fallback */}
      <div className="mt-2.5 flex max-w-md items-center gap-2">
        <div className="flex h-[34px] flex-1 items-center gap-2 rounded-md border border-border-strong bg-surface px-2.5">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-text-faint" />
          <input
            type="text"
            aria-label={`Paste image URL for ${title}`}
            placeholder="…or paste an image URL"
            value={state.urlVal}
            onChange={(e) => onUrlChange(e.target.value)}
            className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] text-text outline-none placeholder:text-text-faint"
          />
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onSetUrl}>Set</Button>
      </div>
      {uploadHint && <span className="sr-only">File upload becomes available after the category is saved.</span>}
    </div>
  );
}
