"use client";

import Link from "next/link";
import { useState } from "react";
import { usePages, useDeletePage } from "@/lib/api/hooks/useContent";
import type { PageRow } from "@/lib/api/schemas/content";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/stores/toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * CMS pages list (cms-pages-fe). Slug/title/status/system badge; create + edit
 * + delete with PAGE_LINKED guard. System pages can't be deleted.
 */
export function PagesView() {
  const { data, isLoading, isError, refetch } = usePages();
  const del = useDeletePage();
  const [target, setTarget] = useState<PageRow | null>(null);

  async function onDelete() {
    if (!target) return;
    try { await del.mutateAsync(target.id); setTarget(null); toast("Page deleted."); }
    catch (err) {
      setTarget(null);
      if (err instanceof ApiError && err.code === "PAGE_LINKED") toast("This page is a system policy page or linked in a menu — it can't be deleted.", "error");
      else toast("Couldn't delete the page.", "error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Pages</h1>
        <Can permission="content.page.manage">
          <Link href="/admin/content/pages/new" className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">New page</Link>
        </Can>
      </div>

      {isLoading ? <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        : isError ? <div className="py-12 text-center"><p className="text-sm text-gray-600">Couldn&apos;t load pages.</p><button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button></div>
        : !data || data.length === 0 ? <p className="py-12 text-center text-sm text-gray-500">No pages yet.</p>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-4 font-medium">Title</th><th className="py-2 pr-4 font-medium">Slug</th><th className="py-2 pr-4 font-medium">Status</th><th className="py-2 pr-4 font-medium">Updated</th><th className="py-2 font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 font-medium text-gray-900">{p.title}{p.is_system && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">System</span>}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-gray-500">/{p.slug}</td>
                  <td className="py-3 pr-4"><span className={"rounded-full px-2 py-0.5 text-xs font-medium " + (p.is_published ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500")}>{p.is_published ? "Published" : "Draft"}</span></td>
                  <td className="py-3 pr-4 text-gray-400">{p.updated_at ? formatDate(p.updated_at) : "—"}</td>
                  <td className="py-3">
                    <Can permission="content.page.manage">
                      <div className="flex items-center gap-3">
                        <Link href={`/admin/content/pages/${p.id}`} className="text-sm font-medium text-brand-700 hover:underline">Edit</Link>
                        {!p.is_system && <button type="button" onClick={() => setTarget(p)} className="text-sm font-medium text-red-600 hover:underline">Delete</button>}
                      </div>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      <ConfirmDialog open={!!target} title="Delete page?" message={`"${target?.title}" will be deleted.`} confirmLabel="Delete" danger pending={del.isPending} onConfirm={onDelete} onClose={() => setTarget(null)} />
    </div>
  );
}
