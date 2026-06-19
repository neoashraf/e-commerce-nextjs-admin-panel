"use client";

import Link from "next/link";
import { useState } from "react";
import { useFamilies, useDeleteFamily } from "@/lib/api/hooks/useCatalog";
import type { FamilyRow } from "@/lib/api/schemas/catalog";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  SkeletonRows,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";

/**
 * Attribute families list (attribute-families-list.md, catalog-attribute-
 * families-fe) on the AD6 Data Table primitive (design-system §8.6): Card-wrapped
 * table with eyebrow headers. No pagination — the families endpoint returns a
 * small bounded set (no page/limit/total). Create CTA; Delete (default row
 * pre-disabled with tooltip; FAMILY_IN_USE / DEFAULT_FAMILY guarded). <Can>-gated.
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
        <h1 className="text-[22px] font-bold leading-7 text-text">Attribute families</h1>
        <Can permission="catalog.attribute.create">
          <Link
            href="/admin/attribute-families/new"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent-600 px-4 text-sm font-medium text-accent-fg shadow-xs transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
          >
            New family
          </Link>
        </Can>
      </div>

      {guard && <p role="alert" className="rounded-md bg-warning-50 px-3 py-2 text-sm text-warning">{guard}</p>}

      <Card>
        {isLoading ? (
          <SkeletonRows rows={6} cols={3} />
        ) : isError ? (
          <ErrorState description="Couldn't load families." onRetry={() => refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No families yet." description="Create your first attribute family." />
        ) : (
          <Table>
            <THead>
              <TR hover={false}>
                <TH>Code</TH>
                <TH>Name</TH>
                <TH className="text-right"><span className="sr-only">Actions</span></TH>
              </TR>
            </THead>
            <TBody>
              {data.map((f) => (
                <TR key={f.id}>
                  <TD className="font-mono text-xs text-text-secondary">{f.code}</TD>
                  <TD className="font-medium text-text">
                    {f.name}
                    {f.is_default && <Badge tone="neutral" className="ml-2">Default</Badge>}
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Can permission="catalog.attribute.update">
                        <Link href={`/admin/attribute-families/${f.id}`} className="text-sm font-medium text-accent-700 hover:underline">Edit</Link>
                      </Can>
                      <Can permission="catalog.attribute.delete">
                        {f.is_default ? (
                          <span title="The default family can't be deleted" className="text-sm text-text-faint">Delete</span>
                        ) : (
                          <button type="button" onClick={() => setTarget(f)} className="text-sm font-medium text-error hover:underline">Delete</button>
                        )}
                      </Can>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

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
