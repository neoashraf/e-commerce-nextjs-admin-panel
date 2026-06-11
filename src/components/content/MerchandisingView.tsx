"use client";

import { useState } from "react";
import { useBanners, useBannerActions, useHomeSections, useHomeSectionActions } from "@/lib/api/hooks/useContent";
import type { Banner, HomeSection } from "@/lib/api/schemas/content";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";
import { resolveMediaUrl } from "@/lib/media";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * CMS merchandising (cms-merchandising-fe). Two panels: home-top Banners
 * (image/link/active, placement-limit 409 guard) and Home Sections (type/title/
 * item refs/published). Add/edit-active/delete inline. <Can content.*manage>.
 */
export function MerchandisingView() {
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900">Merchandising</h1>
      <BannersPanel />
      <SectionsPanel />
    </div>
  );
}

function BannersPanel() {
  const { data, isLoading } = useBanners();
  const actions = useBannerActions();
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState<Banner | null>(null);
  const [form, setForm] = useState({ image_url: "", alt_text: "", link_ref: "" });
  const field = "h-10 w-full rounded-md border border-gray-300 px-3 text-sm";

  async function add() {
    if (!form.image_url.trim()) return;
    try {
      await actions.create.mutateAsync({ placement: "home_top", image_url: form.image_url.trim(), alt_text: form.alt_text.trim(), link_type: "url", link_ref: form.link_ref.trim() || undefined, priority: 1, is_active: true });
      setForm({ image_url: "", alt_text: "", link_ref: "" }); setAdding(false); toast("Banner added.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) toast("This placement already has its maximum active banners.", "error");
      else toast("Couldn't add the banner.", "error");
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Home banners</h2>
        <Can permission="content.banner.manage"><button type="button" onClick={() => setAdding((a) => !a)} className="text-sm font-medium text-brand-700 hover:underline">+ Add banner</button></Can>
      </div>

      {adding && (
        <div className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-3">
          <input className={field} placeholder="Image URL" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
          <input className={field} placeholder="Alt text" value={form.alt_text} onChange={(e) => setForm({ ...form, alt_text: e.target.value })} />
          <input className={field} placeholder="Link URL (optional)" value={form.link_ref} onChange={(e) => setForm({ ...form, link_ref: e.target.value })} />
          <div className="sm:col-span-3"><button type="button" onClick={add} disabled={actions.create.isPending} className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Save banner</button></div>
        </div>
      )}

      {isLoading ? <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
        : !data || data.length === 0 ? <p className="text-sm text-gray-400">No banners yet.</p>
        : (
          <ul className="space-y-2">
            {data.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <span className="h-10 w-16 shrink-0 overflow-hidden rounded bg-gray-100">{b.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveMediaUrl(b.image_url)} alt="" className="h-full w-full object-cover" />)}</span>
                <span className="min-w-0 flex-1 truncate text-gray-700">{b.alt_text || b.image_url}</span>
                <Can permission="content.banner.manage">
                  <button type="button" onClick={() => actions.update.mutate({ id: b.id, body: { is_active: !b.is_active } })} className={"text-sm font-medium " + (b.is_active ? "text-amber-700" : "text-green-700")}>{b.is_active ? "Deactivate" : "Activate"}</button>
                  <button type="button" onClick={() => setTarget(b)} className="text-sm font-medium text-red-600">Delete</button>
                </Can>
              </li>
            ))}
          </ul>
        )}

      <ConfirmDialog open={!!target} title="Delete banner?" message="This banner will be removed." confirmLabel="Delete" danger pending={actions.remove.isPending} onConfirm={() => target && actions.remove.mutate(target.id, { onSuccess: () => { setTarget(null); toast("Banner deleted."); } })} onClose={() => setTarget(null)} />
    </section>
  );
}

function SectionsPanel() {
  const { data, isLoading } = useHomeSections();
  const actions = useHomeSectionActions();
  const [target, setTarget] = useState<HomeSection | null>(null);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Home sections</h2>
        <Can permission="content.section.manage"><button type="button" onClick={() => actions.create.mutate({ type: "featured_products", title: "New section", item_refs: [], display_order: (data?.length ?? 0) + 1, is_published: false })} className="text-sm font-medium text-brand-700 hover:underline">+ Add section</button></Can>
      </div>

      {isLoading ? <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
        : !data || data.length === 0 ? <p className="text-sm text-gray-400">No home sections yet.</p>
        : (
          <ul className="space-y-2">
            {data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <input className="h-9 flex-1 rounded-md border border-gray-300 px-2 text-sm font-medium" defaultValue={s.title} onBlur={(e) => e.target.value !== s.title && actions.update.mutate({ id: s.id, body: { title: e.target.value } })} aria-label="Section title" />
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{s.type.replace(/_/g, " ")}</span>
                <span className="text-xs text-gray-400">{s.item_refs.length} items</span>
                <Can permission="content.section.manage">
                  <button type="button" onClick={() => actions.update.mutate({ id: s.id, body: { is_published: !s.is_published } })} className={"text-sm font-medium " + (s.is_published ? "text-amber-700" : "text-green-700")}>{s.is_published ? "Unpublish" : "Publish"}</button>
                  <button type="button" onClick={() => setTarget(s)} className="text-sm font-medium text-red-600">Delete</button>
                </Can>
              </li>
            ))}
          </ul>
        )}
      <p className="text-xs text-gray-400">Item-ref pickers (products/categories) land with the CAT picker integration — flagged.</p>

      <ConfirmDialog open={!!target} title="Delete section?" message={`"${target?.title}" will be removed from the home page.`} confirmLabel="Delete" danger pending={actions.remove.isPending} onConfirm={() => target && actions.remove.mutate(target.id, { onSuccess: () => { setTarget(null); toast("Section deleted."); } })} onClose={() => setTarget(null)} />
    </section>
  );
}
