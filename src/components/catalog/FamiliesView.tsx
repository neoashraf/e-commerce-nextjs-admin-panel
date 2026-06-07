"use client";

import Link from "next/link";
import { useState } from "react";
import { useFamilies, useDeleteFamily } from "@/lib/api/hooks/useCatalog";
import type { FamilyRow } from "@/lib/api/schemas/catalog";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Attribute families list (attribute-families-list.md, catalog-attribute-
 * families-fe). Table/cards of id/code/name; Create CTA; Delete (default row
 * pre-disabled with tooltip; FAMILY_IN_USE / DEFAULT_FAMILY guarded, no
 * optimistic removal). <Can catalog.attribute.*>.
 */
export function FamiliesView() {
  const { data, isLoading, isError, refetch } = useFamilies();
  const del = useDeleteFamily();
  const [target, setTarget] = useState<FamilyRow | null>(null);
  const [guard, setGuard] = useState<string | null>(null);

  async function onDelete() {
    if (!target) return;
    try {
      await del.mutateAsync(target.id);
      setTarget(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === "FAMILY_IN_USE") setGuard("This family is used by products. Reassign them before deleting.");
      else if (err instanceof ApiError && err.code === "DEFAULT_FAMILY") setGuard("The default family can't be deleted.");
      else setGuard("Couldn't delete this family. Try again.");
      setTarget(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Attribute families</h1>
        <Can permission="catalog.attribute.create">
          <Link href="/admin/attribute-families/new" className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">New family</Link>
        </Can>
      </div>

      {guard && <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{guard}</p>}

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">Couldn&apos;t load families.</p>
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button>
        </div>
      ) : !data || data.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">No families yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-4 font-medium">Code</th>
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((f) => (
              <tr key={f.id} className="border-b border-gray-100">
                <td className="py-3 pr-4 font-mono text-xs text-gray-700">{f.code}</td>
                <td className="py-3 pr-4 font-medium text-gray-900">
                  {f.name}
                  {f.is_default && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">Default</span>}
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <Can permission="catalog.attribute.update">
                      <Link href={`/admin/attribute-families/${f.id}`} className="text-sm font-medium text-brand-700 hover:underline">Edit</Link>
                    </Can>
                    <Can permission="catalog.attribute.delete">
                      {f.is_default ? (
                        <span title="The default family can't be deleted" className="text-sm text-gray-300">Delete</span>
                      ) : (
                        <button type="button" onClick={() => setTarget(f)} className="text-sm font-medium text-red-600 hover:underline">Delete</button>
                      )}
                    </Can>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={!!target}
        title="Delete family?"
        message={`"${target?.name}" will be deleted.`}
        confirmLabel="Delete"
        danger
        pending={del.isPending}
        onConfirm={onDelete}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}
