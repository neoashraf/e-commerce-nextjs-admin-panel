"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Layers, Plus } from "lucide-react";
import { useFamilies, useDeleteFamily } from "@/lib/api/hooks/useCatalog";
import type { FamilyRow } from "@/lib/api/schemas/catalog";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RowActions, Th } from "@/components/catalog/AttributesView";

/**
 * Attribute families list (attribute-families-list.md, catalog-attribute-
 * families-fe) — Catalog (CAT) redesign on the shared admin design language
 * (page header + count, DS data table card with eyebrow headers, per-row •••
 * portal menu Edit / Delete). No pagination — the families endpoint returns a
 * small bounded set. Delete is guarded (default family pre-disabled in the menu;
 * FAMILY_IN_USE / DEFAULT_FAMILY surfaced). <Can>-gated. Behaviour parity with
 * the old view — presentation only.
 */
export function FamiliesView() {
  const { data, isLoading, isError, refetch } = useFamilies();
  const del = useDeleteFamily();
  const [target, setTarget] = useState<FamilyRow | null>(null);
  const [guard, setGuard] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const families = data ?? [];

  // Close the ••• menu on any outside click.
  useEffect(() => {
    if (openMenu === null) return;
    const close = () => setOpenMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenu]);

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
    <div className="mx-auto max-w-[1320px]">
      {/* ===== A. PAGE HEADER ===== */}
      <div className="mb-[18px] flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-7 tracking-[-0.01em] text-text">Attribute families</h1>
          <p className="mt-[3px] text-[13px] tabular-nums text-text-secondary">
            {families.length} {families.length === 1 ? "family" : "families"}
          </p>
        </div>
        <Can permission="catalog.attribute.create">
          <Link
            href="/admin/attribute-families/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-accent-600 px-[15px] text-[13px] font-semibold text-accent-fg hover:bg-accent-700"
          >
            <Plus className="h-4 w-4" />
            Create Family
          </Link>
        </Can>
      </div>

      {guard && (
        <p role="alert" className="mb-3.5 rounded-md border border-warning/30 bg-warning-50 px-3 py-2 text-[13px] text-warning">
          {guard}
        </p>
      )}

      {/* ===== B. TABLE ===== */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        {isLoading ? (
          <FamilySkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <p className="text-[15px] font-semibold text-text">Couldn&apos;t load families.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 inline-flex h-[34px] items-center gap-[7px] rounded-md border border-border-strong bg-surface px-3.5 text-[13px] font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              Try again
            </button>
          </div>
        ) : families.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <span className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-muted">
              <Layers className="h-[22px] w-[22px]" />
            </span>
            <p className="text-[15px] font-semibold text-text">No families yet.</p>
            <p className="mt-1 text-[13px] text-text-secondary">Create your first attribute family to group attributes.</p>
            <Can permission="catalog.attribute.create">
              <Link
                href="/admin/attribute-families/new"
                className="mt-4 inline-flex h-[34px] items-center gap-[7px] rounded-md bg-accent-600 px-3.5 text-[13px] font-semibold text-accent-fg hover:bg-accent-700"
              >
                <Plus className="h-4 w-4" />
                Create your first family
              </Link>
            </Can>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="bg-surface-subtle">
                  <Th className="pl-[18px] text-left">Code</Th>
                  <Th className="text-left">Name</Th>
                  <Th className="w-[90px] pr-[18px] text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {families.map((f) => (
                  <tr key={f.id} className="border-b border-surface-subtle transition-colors last:border-0 hover:bg-surface-hover">
                    <td className="py-[11px] pl-[18px] pr-4 align-middle font-mono text-[12px] text-text-secondary">{f.code}</td>
                    <td className="py-[11px] pr-4 align-middle">
                      <span className="text-[13px] font-medium text-text">{f.name}</span>
                      {f.is_default && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-text-muted">
                          Default
                        </span>
                      )}
                    </td>
                    <td className="relative py-[11px] pr-[18px] text-right align-middle" onClick={(e) => e.stopPropagation()}>
                      <RowActions
                        editHref={`/admin/attribute-families/${f.id}`}
                        editLabel={`Edit ${f.name}`}
                        canDelete={!f.is_default}
                        menuOpen={openMenu === f.id}
                        onMenuOpen={() => setOpenMenu((cur) => (cur === f.id ? null : f.id))}
                        onDelete={() => {
                          setOpenMenu(null);
                          setTarget(f);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

function FamilySkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-4 border-b border-border bg-surface-subtle px-[18px] py-3">
        <div className="h-3 w-20 rounded bg-border" />
        <div className="h-3 w-32 rounded bg-border" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-surface-subtle px-[18px] py-[13px]">
          <div className="h-3.5 w-20 rounded bg-surface-subtle" />
          <div className="h-3.5 w-36 rounded bg-surface-subtle" />
        </div>
      ))}
    </div>
  );
}
