"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCreatePage, useUpdatePage } from "@/lib/api/hooks/useContent";
import type { PageDetail } from "@/lib/api/schemas/content";
import { ApiError } from "@/lib/api/errors";

/**
 * CMS page editor (cms-pages-fe). Title/slug/body (HTML textarea)/SEO/publish.
 * Slug locked for system pages and on edit (slug-change needs a redirect flow —
 * flagged). 409 duplicate-slug surfaced inline.
 */
export function PageEditor({ mode, page }: { mode: "create" | "edit"; page?: PageDetail }) {
  const router = useRouter();
  const create = useCreatePage();
  const update = useUpdatePage(page?.id ?? "");

  const [title, setTitle] = useState(page?.title ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [body, setBody] = useState(page?.body ?? "");
  const [seoTitle, setSeoTitle] = useState(page?.seo_title ?? "");
  const [seoDesc, setSeoDesc] = useState(page?.seo_description ?? "");
  const [published, setPublished] = useState(page?.is_published ?? false);
  const [error, setError] = useState<string | null>(null);

  const slugLocked = mode === "edit"; // slug change needs a redirect flow (flagged)
  const field = "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (title.trim().length < 2) { setError("Title is required."); return; }
    if (mode === "create" && !/^[a-z0-9-]+$/.test(slug)) { setError("Slug must be lowercase letters, numbers, and hyphens."); return; }
    const data = { title: title.trim(), body, seo_title: seoTitle.trim() || undefined, seo_description: seoDesc.trim() || undefined, is_published: published };
    try {
      if (mode === "create") await create.mutateAsync({ ...data, slug });
      else await update.mutateAsync(data);
      router.push("/admin/content/pages");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError("That slug already exists.");
      else setError("Something went wrong. Try again.");
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <form onSubmit={onSave} className="max-w-3xl space-y-5">
      <h1 className="text-xl font-bold text-gray-900">{mode === "create" ? "New page" : `Edit ${page?.title}`}</h1>
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Title</span><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Slug {slugLocked && <span className="text-gray-400">(locked)</span>}</span><input className={field + (slugLocked ? " bg-gray-50 text-gray-500" : "")} value={slug} onChange={(e) => setSlug(e.target.value)} readOnly={slugLocked} placeholder="size-guide" /></label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-900">Body (HTML)</span>
        <textarea className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm" rows={12} value={body} onChange={(e) => setBody(e.target.value)} placeholder="<h2>Heading</h2><p>…</p>" />
        <span className="mt-1 block text-xs text-gray-400">Sanitized server-side; the storefront renders it via /pages/&lt;slug&gt;.</span>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">SEO title</span><input className={field} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={title} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">SEO description</span><input className={field} value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} /></label>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-4 w-4" /> Published</label>

      <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3">
          <button type="button" onClick={() => router.push("/admin/content/pages")} className="text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
          <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{pending ? "Saving…" : mode === "create" ? "Create page" : "Save changes"}</button>
        </div>
      </div>
    </form>
  );
}
