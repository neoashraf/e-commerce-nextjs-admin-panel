"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAttributes, useDeleteAttribute } from "@/lib/api/hooks/useCatalog";
import type { AttributeRow } from "@/lib/api/schemas/catalog";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Attributes list (catalog-attributes-fe). Table/cards with code/label/type/flag
 * cells (✓/—) + System chip; search + type filter (URL-reflected); delete with
 * ATTRIBUTE_IN_USE / SYSTEM_ATTRIBUTE guard toasts. <Can catalog.attribute.*>.
 */
function Flag({ on }: { on?: boolean }) {
  return <span className={on ? "text-green-600" : "text-gray-300"} aria-label={on ? "yes" : "no"}>{on ? "✓" : "—"}</span>;
}

export function AttributesView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const type = sp.get("type") ?? "";
  const q = sp.get("q") ?? "";

  const { data, isLoading, isError, refetch } = useAttributes({
    type: type || undefined,
    q: q || undefined,
    page: 1,
    limit: 100,
  });
  const del = useDeleteAttribute();
  const [target, setTarget] = useState<AttributeRow | null>(null);
  const [guard, setGuard] = useState<string | null>(null);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  async function onDelete() {
    if (!target) return;
    try {
      await del.mutateAsync(target.id);
      setTarget(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === "ATTRIBUTE_IN_USE") setGuard("This attribute is in use by products. Disable it instead of deleting.");
      else if (err instanceof ApiError && err.code === "SYSTEM_ATTRIBUTE") setGuard("System attributes can't be deleted.");
      else setGuard("Couldn't delete this attribute. Try again.");
      setTarget(null);
    }
  }

  const inp = "h-10 rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Attributes</h1>
        <Can permission="catalog.attribute.create">
          <Link href="/admin/attributes/new" className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">New attribute</Link>
        </Can>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input className={inp + " w-64"} placeholder="Search code or label…" defaultValue={q} onKeyDown={(e) => e.key === "Enter" && setParam("q", (e.target as HTMLInputElement).value)} />
        <select className={inp} value={type} onChange={(e) => setParam("type", e.target.value)}>
          <option value="">All types</option>
          {["text", "select", "multiselect", "boolean", "number", "price", "date"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {guard && <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{guard}</p>}

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">Couldn&apos;t load attributes.</p>
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button>
        </div>
      ) : !data || data.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">No attributes match your filters.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-4 font-medium">Code</th>
              <th className="py-2 pr-4 font-medium">Label</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-3 text-center font-medium">Req</th>
              <th className="py-2 pr-3 text-center font-medium">Filter</th>
              <th className="py-2 pr-3 text-center font-medium">Config</th>
              <th className="py-2 pr-4 font-medium">Created</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id} className="border-b border-gray-100">
                <td className="py-3 pr-4 font-mono text-xs text-gray-700">{a.code}</td>
                <td className="py-3 pr-4 font-medium text-gray-900">
                  {a.admin_label}
                  {a.is_user_defined === false && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">System</span>}
                </td>
                <td className="py-3 pr-4"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{a.type}</span></td>
                <td className="py-3 pr-3 text-center"><Flag on={a.is_required} /></td>
                <td className="py-3 pr-3 text-center"><Flag on={a.is_filterable} /></td>
                <td className="py-3 pr-3 text-center">{a.type === "select" ? <Flag on={a.is_configurable} /> : <span className="text-gray-300">—</span>}</td>
                <td className="py-3 pr-4 text-gray-400">{a.created_at ? formatDate(a.created_at) : "—"}</td>
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <Can permission="catalog.attribute.update">
                      <Link href={`/admin/attributes/${a.id}`} className="text-sm font-medium text-brand-700 hover:underline">Edit</Link>
                    </Can>
                    {a.is_user_defined !== false && (
                      <Can permission="catalog.attribute.delete">
                        <button type="button" onClick={() => setTarget(a)} className="text-sm font-medium text-red-600 hover:underline">Delete</button>
                      </Can>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={!!target}
        title="Delete attribute?"
        message={`"${target?.admin_label}" will be deleted.`}
        confirmLabel="Delete"
        danger
        pending={del.isPending}
        onConfirm={onDelete}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}
