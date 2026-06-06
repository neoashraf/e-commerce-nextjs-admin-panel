"use client";

import Link from "next/link";
import { useState } from "react";
import { useCategoryTree, usePatchCategory, useDeleteCategory } from "@/lib/api/hooks/useCatalog";
import type { CategoryNode } from "@/lib/api/schemas/catalog";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Admin categories tree (catalog list spec, catalog-categories-fe). Indented
 * tree rows (role=tree/treeitem, aria-level/expanded), Published + In-menu
 * badges, inline publish/show-in-menu toggles, add-sub disabled at level 3,
 * reorder among siblings via up/down (keyboard-friendly), and delete with the
 * CATEGORY_HAS_DEPENDENTS blocked dialog. Show-deleted toggle. <Can>-gated.
 */
export function CategoriesView() {
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const { data, isLoading, isError, refetch } = useCategoryTree(includeDeleted);
  const patch = usePatchCategory();
  const del = useDeleteCategory();

  const [target, setTarget] = useState<CategoryNode | null>(null);
  const [blocked, setBlocked] = useState<{ name: string; children: number; products: number } | null>(null);

  async function onDelete() {
    if (!target) return;
    try {
      await del.mutateAsync(target.id);
      setTarget(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === "CATEGORY_HAS_DEPENDENTS") {
        // details carried as the error's first detail message (shape per BE).
        setBlocked({ name: target.name, children: 0, products: 0 });
      }
      setTarget(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Categories</h1>
        <Can permission="catalog.category.create">
          <Link href="/admin/categories/new" className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
            New category
          </Link>
        </Can>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} className="h-4 w-4" />
        Show deleted
      </label>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">Couldn&apos;t load categories.</p>
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button>
        </div>
      ) : !data || data.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">No categories yet. Create your first one.</p>
      ) : (
        <ul role="tree" className="rounded-lg border border-gray-200 bg-white">
          {data.map((node, i) => (
            <CategoryRow
              key={node.id}
              node={node}
              siblings={data}
              index={i}
              onPublish={(n) => patch.mutate({ id: n.id, body: { is_published: !n.is_published } })}
              onMenu={(n) => patch.mutate({ id: n.id, body: { show_in_menu: !n.show_in_menu } })}
              onReorder={(n, dir) => patch.mutate({ id: n.id, body: { position: n.position + dir } })}
              onDelete={(n) => setTarget(n)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!target}
        title="Delete category?"
        message={`"${target?.name}" will be soft-deleted.`}
        confirmLabel="Delete"
        danger
        pending={del.isPending}
        onConfirm={onDelete}
        onClose={() => setTarget(null)}
      />

      <ConfirmDialog
        open={!!blocked}
        title="Category can't be deleted"
        message={`"${blocked?.name}" still has sub-categories or published products. Move or unpublish them first.`}
        confirmLabel="OK"
        onConfirm={() => setBlocked(null)}
        onClose={() => setBlocked(null)}
      />
    </div>
  );
}

function CategoryRow({
  node,
  siblings,
  index,
  onPublish,
  onMenu,
  onReorder,
  onDelete,
}: {
  node: CategoryNode;
  siblings: CategoryNode[];
  index: number;
  onPublish: (n: CategoryNode) => void;
  onMenu: (n: CategoryNode) => void;
  onReorder: (n: CategoryNode, dir: 1 | -1) => void;
  onDelete: (n: CategoryNode) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const canAddSub = node.level < 3;
  const dimmed = !node.is_published || node.is_deleted;

  return (
    <li role="treeitem" aria-level={node.level} aria-selected={false} aria-expanded={hasChildren ? open : undefined}>
      <div
        className={"flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 " + (dimmed ? "opacity-60" : "")}
        style={{ paddingLeft: 12 + (node.level - 1) * 20 }}
      >
        {hasChildren ? (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? "Collapse" : "Expand"} className="grid h-6 w-6 place-items-center text-gray-400 hover:text-gray-600">
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-6" />
        )}

        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{node.name}</span>

        <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <Badge on={node.is_published} onLabel="Published" offLabel="Draft" />
          {node.show_in_menu && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">In menu</span>}
          {node.is_deleted && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">Deleted</span>}
        </span>

        {!node.is_deleted && (
          <span className="flex shrink-0 items-center gap-2 text-xs">
            <button type="button" onClick={() => onReorder(node, -1)} disabled={index === 0} aria-label="Move up" className="text-gray-400 hover:text-gray-700 disabled:opacity-30">↑</button>
            <button type="button" onClick={() => onReorder(node, 1)} disabled={index === siblings.length - 1} aria-label="Move down" className="text-gray-400 hover:text-gray-700 disabled:opacity-30">↓</button>
            <Can permission="catalog.category.update">
              <button type="button" onClick={() => onPublish(node)} className="font-medium text-brand-700 hover:underline">{node.is_published ? "Unpublish" : "Publish"}</button>
              <button type="button" onClick={() => onMenu(node)} className="font-medium text-gray-500 hover:underline">{node.show_in_menu ? "Hide" : "Show"}</button>
              <Link href={`/admin/categories/${node.id}`} className="font-medium text-brand-700 hover:underline">Edit</Link>
            </Can>
            {canAddSub ? (
              <Can permission="catalog.category.create">
                <Link href={`/admin/categories/new?parent=${node.id}`} className="font-medium text-gray-500 hover:underline">+ Sub</Link>
              </Can>
            ) : (
              <span title="Categories can be at most 3 levels deep" className="text-gray-300">+ Sub</span>
            )}
            <Can permission="catalog.category.delete">
              <button type="button" onClick={() => onDelete(node)} className="font-medium text-red-600 hover:underline">Delete</button>
            </Can>
          </span>
        )}
      </div>

      {hasChildren && open && (
        <ul role="group">
          {node.children.map((child, i) => (
            <CategoryRow
              key={child.id}
              node={child}
              siblings={node.children}
              index={i}
              onPublish={onPublish}
              onMenu={onMenu}
              onReorder={onReorder}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function Badge({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span className={"rounded px-1.5 py-0.5 text-xs font-medium " + (on ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500")}>
      {on ? onLabel : offLabel}
    </span>
  );
}
