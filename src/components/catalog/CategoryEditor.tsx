"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCreateCategory, useUpdateCategory, useFilterableAttributes, useCategoryTree } from "@/lib/api/hooks/useCatalog";
import type { CategoryDetail, CategoryNode } from "@/lib/api/schemas/catalog";
import { ApiError } from "@/lib/api/errors";

/**
 * Category editor (catalog-categories-fe editor spec). General (name, parent
 * picker with level-3 disabled, display_mode, show_in_menu, is_published in
 * edit), filterable-attributes checklist, description, SEO (slug auto +
 * locked-after-publish), image URLs (upload wiring flagged). POST/PATCH.
 */
const DISPLAY_MODES = [
  { value: "products_and_description", label: "Products & description" },
  { value: "products_only", label: "Products only" },
  { value: "description_only", label: "Description only" },
];

function flatten(nodes: CategoryNode[], acc: { id: string; name: string; level: number }[] = []) {
  for (const n of nodes) {
    acc.push({ id: n.id, name: n.name, level: n.level });
    if (n.children.length) flatten(n.children, acc);
  }
  return acc;
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

  const [name, setName] = useState(category?.name ?? "");
  const [parentId, setParentId] = useState(category?.parent_id ?? defaultParentId ?? "");
  const [displayMode, setDisplayMode] = useState(category?.display_mode ?? "products_and_description");
  const [showInMenu, setShowInMenu] = useState(category?.show_in_menu ?? true);
  const [isPublished, setIsPublished] = useState(category?.is_published ?? false);
  const [description, setDescription] = useState(category?.description ?? "");
  const [logoUrl, setLogoUrl] = useState(category?.logo_url ?? "");
  const [bannerUrl, setBannerUrl] = useState(category?.banner_url ?? "");
  const [metaTitle, setMetaTitle] = useState(category?.meta_title ?? "");
  const [metaDesc, setMetaDesc] = useState(category?.meta_description ?? "");
  const [codes, setCodes] = useState<Set<string>>(new Set(category?.filterable_attribute_codes ?? []));
  const [error, setError] = useState<string | null>(null);

  const parentOptions = flatten(tree ?? []).filter((c) => c.id !== category?.id);
  const slugLocked = mode === "edit" && (category?.is_published ?? false);
  const field = "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  function toggleCode(code: string) {
    setCodes((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    const body = {
      name: name.trim(),
      parent_id: parentId || null,
      display_mode: displayMode,
      show_in_menu: showInMenu,
      description: description.trim() || undefined,
      logo_url: logoUrl.trim() || undefined,
      banner_url: bannerUrl.trim() || undefined,
      filterable_attribute_codes: Array.from(codes),
      meta_title: metaTitle.trim() || undefined,
      meta_description: metaDesc.trim() || undefined,
      ...(mode === "edit" ? { is_published: isPublished } : {}),
    };
    try {
      if (mode === "create") await create.mutateAsync(body);
      else await update.mutateAsync(body);
      router.push("/admin/categories");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) setError("Check the fields — the name may be too short or the depth too deep.");
      else setError("Something went wrong. Please try again.");
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <form onSubmit={onSave} className="max-w-3xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900">{mode === "create" ? "New category" : `Edit ${category?.name}`}</h1>

      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* General */}
      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">General</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Name</span>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Parent category</span>
          <select className={field} value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— None (top level)</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id} disabled={c.level >= 3}>
                {"— ".repeat(c.level - 1)}{c.name}{c.level >= 3 ? " (max depth)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-900">Display mode</span>
            <select className={field} value={displayMode} onChange={(e) => setDisplayMode(e.target.value)}>
              {DISPLAY_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={showInMenu} onChange={(e) => setShowInMenu(e.target.checked)} className="h-4 w-4" /> Show in menu
            </label>
            {mode === "edit" && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="h-4 w-4" /> Published
              </label>
            )}
          </div>
        </div>
      </section>

      {/* Filterable attributes */}
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">Filterable attributes</h2>
        {attrsLoading ? (
          <div className="h-20 animate-pulse rounded bg-gray-100" />
        ) : attrsError ? (
          <p className="text-sm text-gray-500">Couldn&apos;t load attributes.</p>
        ) : !attributes || attributes.length === 0 ? (
          <p className="text-sm text-gray-400">No filterable attributes available.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {attributes.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={codes.has(a.code)} onChange={() => toggleCode(a.code)} className="h-4 w-4" />
                {a.admin_label}
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Description + images */}
      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">Description &amp; images</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Description</span>
          <textarea className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-900">Logo URL</span>
            <input className={field} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-900">Banner URL</span>
            <input className={field} value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://…" />
          </label>
        </div>
        <p className="text-xs text-gray-400">Direct file upload (≤5 MB) lands with the media-upload integration — flagged.</p>
      </section>

      {/* SEO */}
      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">SEO</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Slug</span>
          <input className={field + " bg-gray-50 text-gray-500"} value={category?.slug ?? "(auto from name)"} readOnly aria-readonly />
          <span className="mt-1 block text-xs text-gray-400">{slugLocked ? "Slug is locked after publish." : "Auto-generated from the name."}</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Meta title</span>
          <input className={field} value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder={name || "Defaults to the category name"} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Meta description</span>
          <textarea className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" rows={2} value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} placeholder="Defaults to the description" />
        </label>
      </section>

      {/* Sticky save bar */}
      <div className="mt-2">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3">
          <button type="button" onClick={() => router.push("/admin/categories")} className="text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
          <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {pending ? "Saving…" : mode === "create" ? "Create category" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
