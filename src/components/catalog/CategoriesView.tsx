"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Eye,
  EyeOff,
  Folder,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  SquarePen,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useCategoryTree, usePatchCategory, useDeleteCategory, useReorderCategory } from "@/lib/api/hooks/useCatalog";
import type { CategoryNode } from "@/lib/api/schemas/catalog";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";

/**
 * Admin categories tree — Categories (CAT) redesign. Realizes the
 * `docs/design/admin-panel-design-files/Categories (CAT).dc.html` mock: a page
 * header + toolbar (search / expand-collapse / show-deleted), the indented
 * 3-level DS data table (connector guides, carets, folder/tag icons, dimmed
 * unpublished subtree, Published + In-menu badges), drag-and-drop sibling
 * reorder (keyboard ↑/↓ fallback), per-row Edit + ••• menu (publish, show-in-
 * menu, add sub-category disabled at L3, delete) and the CATEGORY_HAS_DEPENDENTS
 * 409 blocked dialog. Chrome (sidebar/topbar) comes from the admin shell.
 *
 * Data: GET /admin/categories (full tree incl. unpublished). Mutations PATCH/
 * DELETE via the existing hooks; reorder persists `position`. <Can>-gated.
 */

const MAX_DEPTH = 3;

/** A row flattened out of the tree for rendering, carrying its indentation. */
interface FlatRow {
  node: CategoryNode;
  level: number; // 0-based depth
  parentId: string | null;
  siblings: CategoryNode[];
  index: number; // position among visible siblings
  /** Per-level connector guide: whether each ancestor column has a continuing line. */
  ancestorHasNext: boolean[];
  isLast: boolean;
  hasChildren: boolean;
  expanded: boolean;
  /** This node or an ancestor is unpublished → the subtree is dimmed. */
  parentUnpublished: boolean;
}

export function CategoriesView() {
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const { data, isLoading, isError, refetch } = useCategoryTree(includeDeleted);
  const patch = usePatchCategory();
  const del = useDeleteCategory();
  const reorderMut = useReorderCategory(includeDeleted);

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // delete target + the 409-blocked dialog (with dependent counts from the error)
  const [target, setTarget] = useState<CategoryNode | null>(null);
  const [blocked, setBlocked] = useState<{ name: string; children: number; products: number } | null>(null);

  const tree = useMemo(() => data ?? [], [data]);
  const q = search.trim().toLowerCase();

  // Close the ••• menu on any outside click (the cell stops its own propagation).
  useEffect(() => {
    if (openMenu === null) return;
    const close = () => setOpenMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenu]);

  const total = useMemo(() => countLive(tree), [tree]);
  const rootCount = useMemo(() => tree.filter((n) => includeDeleted || !n.is_deleted).length, [tree, includeDeleted]);

  // Default-expand the first time data arrives so the structure is visible.
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && tree.length > 0) {
      const next: Record<string, boolean> = {};
      walkAll(tree, (n) => {
        if (n.children.length > 0) next[n.id] = true;
      });
      setExpanded(next);
      seeded.current = true;
    }
  }, [tree]);

  const rows = useMemo(() => flatten(tree, { q, expanded, includeDeleted }), [tree, q, expanded, includeDeleted]);
  const isSearchEmpty = rows.length === 0 && q.length > 0;

  function toggle(id: string) {
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
  }
  function expandAll() {
    const next: Record<string, boolean> = {};
    walkAll(tree, (n) => {
      if (n.children.length > 0) next[n.id] = true;
    });
    setExpanded(next);
  }
  function collapseAll() {
    setExpanded({});
  }

  function onPublish(n: CategoryNode) {
    setOpenMenu(null);
    patch.mutate(
      { id: n.id, body: { is_published: !n.is_published } },
      {
        onSuccess: () =>
          toast(
            n.is_published
              ? "Category unpublished — it and its sub-categories are now hidden from the storefront."
              : "Category published.",
            n.is_published ? "info" : "success",
          ),
        onError: () => toast("Couldn't update the category. Try again.", "error"),
      },
    );
  }
  function onMenuToggle(n: CategoryNode) {
    setOpenMenu(null);
    patch.mutate(
      { id: n.id, body: { show_in_menu: !n.show_in_menu } },
      {
        onSuccess: () => toast(n.show_in_menu ? "Hidden from menu." : "Shown in menu."),
        onError: () => toast("Couldn't update the category. Try again.", "error"),
      },
    );
  }

  /** Move the live ids so `dragId` lands before/after `targetId`, return new order. */
  function reorderedIds(liveIds: string[], dragId: string, targetId: string, pos: "before" | "after"): string[] | null {
    const next = liveIds.filter((id) => id !== dragId);
    const at = next.indexOf(targetId);
    if (at < 0) return null;
    next.splice(pos === "after" ? at + 1 : at, 0, dragId);
    // No-op guard — same order as before.
    if (next.length === liveIds.length && next.every((id, i) => id === liveIds[i])) return null;
    return next;
  }

  function commitReorder(parentId: string | null, orderedIds: string[]) {
    reorderMut.mutate(
      { parentId, orderedIds },
      {
        onSuccess: () => toast("Order saved."),
        onError: () => toast("Couldn't save the new order. Try again.", "error"),
      },
    );
  }

  /** Drag reorder: move `node` before/after `targetId` among its siblings. */
  function reorder(
    node: CategoryNode,
    targetId: string,
    pos: "before" | "after",
    siblings: CategoryNode[],
    parentId: string | null,
  ) {
    if (node.id === targetId) return;
    const liveIds = siblings.filter((s) => includeDeleted || !s.is_deleted).map((s) => s.id);
    const next = reorderedIds(liveIds, node.id, targetId, pos);
    if (next) commitReorder(parentId, next);
  }

  /** Keyboard reorder: nudge `row` up/down one slot among its siblings. */
  function onReorderStep(row: FlatRow, dir: -1 | 1) {
    const liveIds = row.siblings.filter((s) => includeDeleted || !s.is_deleted).map((s) => s.id);
    const from = liveIds.indexOf(row.node.id);
    const j = from + dir;
    if (from < 0 || j < 0 || j >= liveIds.length) return;
    const next = [...liveIds];
    [next[from], next[j]] = [next[j], next[from]];
    commitReorder(row.parentId, next);
  }

  async function confirmDelete() {
    if (!target) return;
    try {
      await del.mutateAsync(target.id);
      toast("Category deleted.");
      setTarget(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === "CATEGORY_HAS_DEPENDENTS") {
        const d = (err.details?.[0] as unknown as { child_categories?: number; published_products?: number }) ?? {};
        setBlocked({
          name: target.name,
          children: d.child_categories ?? 0,
          products: d.published_products ?? 0,
        });
      } else {
        toast("Couldn't delete the category. Try again.", "error");
      }
      setTarget(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1320px]">
      {/* ===== A. PAGE HEADER ===== */}
      <div className="mb-[18px] flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-7 tracking-[-0.01em] text-text">Categories</h1>
          <p className="mt-[3px] text-[13px] tabular-nums text-text-secondary">
            {total} {total === 1 ? "category" : "categories"}
          </p>
        </div>
        <Can permission="catalog.category.create">
          <Link
            href="/admin/categories/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-accent-600 px-[15px] text-[13px] font-semibold text-accent-fg hover:bg-accent-700"
          >
            <Plus className="h-4 w-4" />
            Create Category
          </Link>
        </Can>
      </div>

      {/* ===== B. TOOLBAR ===== */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-9 min-w-[236px] max-w-[320px] flex-1 items-center gap-2.5 rounded-md border border-border-strong bg-surface px-3">
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            type="text"
            aria-label="Search categories"
            placeholder="Search categories by name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpenMenu(null);
            }}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-muted"
          />
          {q.length > 0 && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="text-text-muted hover:text-text-secondary">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Expand / Collapse all */}
        <div className="inline-flex h-9 items-center overflow-hidden rounded-md border border-border-strong bg-surface">
          <button
            type="button"
            onClick={expandAll}
            className="inline-flex h-full items-center gap-[7px] px-3 text-[12.5px] font-semibold text-text-secondary hover:bg-surface-subtle"
          >
            <ChevronsUpDown className="h-[15px] w-[15px]" />
            Expand all
          </button>
          <div className="h-5 w-px bg-border" />
          <button
            type="button"
            onClick={collapseAll}
            className="inline-flex h-full items-center gap-[7px] px-3 text-[12.5px] font-semibold text-text-secondary hover:bg-surface-subtle"
          >
            <ChevronsDownUp className="h-[15px] w-[15px]" />
            Collapse all
          </button>
        </div>

        {/* Show deleted toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={includeDeleted}
          onClick={() => setIncludeDeleted((v) => !v)}
          className={
            "inline-flex h-9 items-center gap-[9px] rounded-md border pl-[11px] pr-[13px] text-[12.5px] font-semibold " +
            (includeDeleted
              ? "border-accent-600 bg-accent-50 text-accent-700"
              : "border-border-strong bg-surface text-text-secondary hover:bg-surface-subtle")
          }
        >
          <span
            className={
              "relative h-[17px] w-[30px] shrink-0 rounded-full transition-colors " +
              (includeDeleted ? "bg-accent-600" : "bg-border-strong")
            }
          >
            <span
              className="absolute top-0.5 h-[13px] w-[13px] rounded-full bg-white shadow-[0_1px_2px_rgba(16,24,40,.25)] transition-[left]"
              style={{ left: includeDeleted ? 15 : 2 }}
            />
          </span>
          Show deleted
        </button>

        <span className="ml-auto whitespace-nowrap text-[13px] tabular-nums text-text-secondary">
          {rootCount} {rootCount === 1 ? "top-level category" : "top-level categories"}
        </span>
      </div>

      {/* ===== C. TREE TABLE ===== */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        {isLoading ? (
          <TreeSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <p className="text-[15px] font-semibold text-text">Couldn&apos;t load categories.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 inline-flex h-[34px] items-center gap-[7px] rounded-md border border-border-strong bg-surface px-3.5 text-[13px] font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              Try again
            </button>
          </div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <span className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-muted">
              <Folder className="h-[22px] w-[22px]" />
            </span>
            <p className="text-[15px] font-semibold text-text">No categories yet.</p>
            <Can permission="catalog.category.create">
              <Link
                href="/admin/categories/new"
                className="mt-4 inline-flex h-[34px] items-center gap-[7px] rounded-md bg-accent-600 px-3.5 text-[13px] font-semibold text-accent-fg hover:bg-accent-700"
              >
                <Plus className="h-4 w-4" />
                Create your first category
              </Link>
            </Can>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse">
                <caption className="sr-only">
                  Category tree. {total} categories. Drag a handle or use the keyboard to reorder siblings.
                </caption>
                <thead>
                  <tr className="bg-surface-subtle">
                    <th scope="col" className="w-[42px] border-b border-border" />
                    <Th className="min-w-[360px] pl-0.5 text-left">Name</Th>
                    <Th className="w-24 text-center">Position</Th>
                    <Th className="w-[140px] text-left">Published</Th>
                    <Th className="w-32 text-left">In menu</Th>
                    <Th className="w-[118px] text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {isSearchEmpty ? (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <div className="flex flex-col items-center justify-center px-5 py-[60px] text-center">
                          <span className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-muted">
                            <Search className="h-[22px] w-[22px]" />
                          </span>
                          <div className="text-[15px] font-semibold text-text">No categories match “{search.trim()}”.</div>
                          <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="mt-4 inline-flex h-[34px] items-center gap-[7px] rounded-md border border-border-strong bg-surface px-3.5 text-[13px] font-semibold text-text-secondary hover:bg-surface-subtle"
                          >
                            <X className="h-3.5 w-3.5" />
                            Clear search
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <CategoryRow
                        key={row.node.id}
                        row={row}
                        searching={q.length > 0}
                        menuOpen={openMenu === row.node.id}
                        onMenuOpen={(id) => setOpenMenu((cur) => (cur === id ? null : id))}
                        onCaret={() => toggle(row.node.id)}
                        onPublish={onPublish}
                        onShowInMenu={onMenuToggle}
                        onReorder={reorder}
                        onReorderStep={onReorderStep}
                        onDelete={(n) => {
                          setOpenMenu(null);
                          setTarget(n);
                        }}
                        includeDeleted={includeDeleted}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ===== D. FOOTER — top-level pagination ===== */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-[18px] py-[13px]">
              <span className="text-[12.5px] tabular-nums text-text-secondary">
                Showing 1–{rootCount} of {rootCount} top-level categories
              </span>
              <div className="flex items-center gap-[3px]">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text-faint"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-current="page"
                  className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-accent-600 bg-accent-600 px-1.5 text-[12.5px] font-semibold tabular-nums text-accent-fg"
                >
                  1
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text-faint"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ===== Confirm soft-delete ===== */}
      {target && (
        <ConfirmDeleteDialog
          name={target.name}
          pending={del.isPending}
          onConfirm={confirmDelete}
          onClose={() => setTarget(null)}
        />
      )}

      {/* ===== 409 dependents-blocked dialog ===== */}
      {blocked && <BlockedDialog info={blocked} onClose={() => setBlocked(null)} />}
    </div>
  );
}

/* ----------------------------- ROW ----------------------------- */

function CategoryRow({
  row,
  searching,
  menuOpen,
  onMenuOpen,
  onCaret,
  onPublish,
  onShowInMenu,
  onReorder,
  onReorderStep,
  onDelete,
  includeDeleted,
}: {
  row: FlatRow;
  searching: boolean;
  menuOpen: boolean;
  onMenuOpen: (id: string) => void;
  onCaret: () => void;
  onPublish: (n: CategoryNode) => void;
  onShowInMenu: (n: CategoryNode) => void;
  onReorder: (
    n: CategoryNode,
    targetId: string,
    pos: "before" | "after",
    siblings: CategoryNode[],
    parentId: string | null,
  ) => void;
  onReorderStep: (row: FlatRow, dir: -1 | 1) => void;
  onDelete: (n: CategoryNode) => void;
  includeDeleted: boolean;
}) {
  const { node, level, hasChildren, expanded, parentUnpublished } = row;
  const isDeleted = !!node.is_deleted;
  const dimmed = parentUnpublished || !node.is_published;
  const dimOpacity = isDeleted ? 0.55 : dimmed ? 0.5 : 1;
  const atMaxDepth = level >= MAX_DEPTH - 1;

  // Reorder is sibling-only and disabled while searching (tree is filtered/flat).
  const canReorder = !isDeleted && !searching;

  const [dragOver, setDragOver] = useState<null | "before" | "after">(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dragId = e.dataTransfer.getData("text/plain");
    const pos = dragOver ?? "before";
    setDragOver(null);
    if (!dragId || dragId === node.id) return;
    // Drops are valid among the same parent only — find the dragged node here.
    const dragged = row.siblings.find((s) => s.id === dragId);
    if (!dragged) return; // cross-parent → snap back (ignore)
    onReorder(dragged, node.id, pos, row.siblings, row.parentId);
  }

  const shadowClass =
    dragOver === "before"
      ? "shadow-[inset_0_2px_0_0_var(--accent-600)]"
      : dragOver === "after"
        ? "shadow-[inset_0_-2px_0_0_var(--accent-600)]"
        : "";

  return (
    <tr
      draggable={canReorder}
      onDragStart={(e) => {
        if (!canReorder) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", node.id);
      }}
      onDragOver={(e) => {
        if (!canReorder) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const next = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
        setDragOver((cur) => (cur === next ? cur : next));
      }}
      onDragLeave={() => setDragOver(null)}
      onDrop={handleDrop}
      className={"border-b border-surface-subtle transition-colors hover:bg-surface-hover " + shadowClass}
    >
      {/* DRAG HANDLE */}
      <td className="w-[42px] pl-3 align-middle">
        {canReorder && (
          <span
            tabIndex={0}
            role="button"
            aria-label={`Reorder ${node.name}. Use Arrow Up or Arrow Down to move.`}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                onReorderStep(row, -1);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                onReorderStep(row, 1);
              }
            }}
            className="inline-flex h-[26px] w-6 cursor-grab items-center justify-center rounded-md text-text-muted hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          >
            <GripVertical className="h-4 w-4" />
          </span>
        )}
      </td>

      {/* NAME: connector guides + caret + folder + link */}
      <td className="pl-0.5 pr-4 align-middle">
        <div className="flex h-[46px] items-stretch">
          {Array.from({ length: level }).map((_, i) => {
            // Per the design's unit() model. Ancestor columns (i < level-1) draw a
            // continuing vertical line iff that ancestor has a following sibling;
            // the node's own connector column (i === level-1) is "mid" (full
            // vertical + horizontal) or "end" (top-half vertical + horizontal)
            // when the node is the last among its siblings.
            const guide = "#CBD5E1";
            const isOwnColumn = i === level - 1;
            let vt = "transparent";
            let vb = "transparent";
            let h = "transparent";
            if (isOwnColumn) {
              vt = guide;
              vb = row.isLast ? "transparent" : guide;
              h = guide;
            } else if (row.ancestorHasNext[i]) {
              vt = guide;
              vb = guide;
            }
            return (
              <span key={i} className="relative w-[22px] flex-none self-stretch">
                <span className="absolute left-2.5 top-0 h-1/2 w-0.5" style={{ background: vt }} />
                <span className="absolute left-2.5 bottom-0 top-1/2 w-0.5" style={{ background: vb }} />
                <span className="absolute left-2.5 h-0.5 w-[11px]" style={{ top: "calc(50% - 1px)", background: h }} />
              </span>
            );
          })}

          <div className="flex min-w-0 items-center gap-[9px]" style={{ opacity: dimOpacity }}>
            {hasChildren ? (
              <button
                type="button"
                onClick={onCaret}
                aria-label={(expanded ? "Collapse " : "Expand ") + node.name}
                aria-expanded={expanded}
                className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md text-text-secondary transition-transform hover:bg-surface-subtle"
                style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <span className="w-[22px] flex-none" />
            )}

            <span className="flex-none text-text-muted">
              {hasChildren ? <Folder className="h-4 w-4" /> : <Tag className="h-4 w-4" />}
            </span>

            <Link
              href={`/admin/categories/${node.id}`}
              title={node.name}
              className={
                "max-w-[300px] truncate text-[13.5px] hover:text-accent-600 " +
                (level === 0 ? "font-semibold" : "font-medium") +
                (isDeleted ? " text-text-muted" : " text-text")
              }
            >
              {node.name}
            </Link>

            {!isDeleted && !node.is_published && !parentUnpublished && (
              <span
                title="Unpublished — this category and its sub-categories are hidden from the storefront."
                className="inline-flex flex-none cursor-help items-center gap-[5px] whitespace-nowrap rounded-full bg-warning-50 px-2 py-0.5 text-[10.5px] font-semibold text-[#B45309]"
              >
                <EyeOff className="h-3 w-3" />
                Hidden on storefront
              </span>
            )}

            {isDeleted && (
              <span className="inline-flex flex-none items-center gap-[5px] whitespace-nowrap rounded-full bg-surface-subtle px-2 py-0.5 text-[10.5px] font-semibold text-text-secondary">
                <Trash2 className="h-3 w-3" />
                Deleted · read-only
              </span>
            )}
          </div>
        </div>
      </td>

      {/* POSITION */}
      <td className="w-24 pr-4 text-center align-middle">
        <span className="text-[12.5px] font-semibold tabular-nums text-text-secondary" style={{ opacity: dimOpacity }}>
          {node.position}
        </span>
      </td>

      {/* PUBLISHED badge */}
      <td className="w-[140px] pr-4 align-middle">
        <span
          className={
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-0.5 pl-2 pr-[9px] text-[11.5px] font-semibold " +
            (node.is_published ? "bg-[#F0FDF4] text-[#15803D]" : "bg-surface-subtle text-text-secondary")
          }
          style={{ opacity: dimOpacity }}
        >
          <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + (node.is_published ? "bg-[#16A34A]" : "bg-text-muted")} />
          {node.is_published ? "Published" : "Unpublished"}
        </span>
      </td>

      {/* IN-MENU badge */}
      <td className="w-32 pr-4 align-middle">
        <span
          className={
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-[9px] py-0.5 text-[11.5px] font-semibold " +
            (node.show_in_menu ? "bg-info-50 text-[#0369A1]" : "bg-surface-hover text-text-muted")
          }
          style={{ opacity: dimOpacity }}
        >
          {node.show_in_menu ? <Eye className="h-[13px] w-[13px] text-[#0EA5E9]" /> : <EyeOff className="h-[13px] w-[13px]" />}
          {node.show_in_menu ? "In menu" : "Hidden"}
        </span>
      </td>

      {/* ACTIONS: ••• menu (Edit lives at the top of the dropdown) */}
      <td className="relative w-[118px] pr-3.5 text-right align-middle" onClick={(e) => e.stopPropagation()}>
        {!isDeleted && (
          <div className="inline-flex items-center justify-end">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => onMenuOpen(node.id)}
              aria-label={`More actions for ${node.name}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={
                "inline-flex h-[30px] w-[30px] items-center justify-center rounded-md text-text-secondary hover:bg-surface-subtle " +
                (menuOpen ? "bg-surface-subtle" : "")
              }
            >
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}

        {menuOpen && (
          <RowMenu
            anchorRef={triggerRef}
            node={node}
            atMaxDepth={atMaxDepth}
            onPublish={() => onPublish(node)}
            onShowInMenu={() => onShowInMenu(node)}
            onDelete={() => onDelete(node)}
          />
        )}
      </td>
    </tr>
  );
}

/* --------------------------- ••• MENU --------------------------- */

function RowMenu({
  anchorRef,
  node,
  atMaxDepth,
  onPublish,
  onShowInMenu,
  onDelete,
}: {
  anchorRef: React.RefObject<HTMLButtonElement>;
  node: CategoryNode;
  atMaxDepth: boolean;
  onPublish: () => void;
  onShowInMenu: () => void;
  onDelete: () => void;
}) {
  // Width must match min-w below so right-alignment with the trigger is exact.
  const MENU_WIDTH = 194;
  const GAP = 6; // px gap between trigger and menu (matches the old top-9 feel)

  const [pos, setPos] = useState<{ left: number; top: number; openUp: boolean } | null>(null);

  // Position against the trigger in viewport coords (position: fixed). Recompute
  // synchronously before paint, and again on scroll/resize so the menu stays
  // glued to its row instead of escaping the table's overflow container.
  useLayoutEffect(() => {
    function place() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Right-align the menu's right edge to the trigger's right edge.
      const left = Math.max(8, r.right - MENU_WIDTH);
      const spaceBelow = window.innerHeight - r.bottom;
      // Edit + publish/hide + add-sub + delete + dividers ≈ 280px; flip up if it
      // wouldn't fit below (and there's room above).
      const openUp = spaceBelow < 280 && r.top > 280;
      const top = openUp ? r.top - GAP : r.bottom + GAP;
      setPos({ left, top, openUp });
    }
    place();
    window.addEventListener("scroll", place, true); // capture: catch inner scrollers too
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchorRef]);

  if (pos === null) return null;

  return createPortal(
    <div
      role="menu"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        width: MENU_WIDTH,
        transform: pos.openUp ? "translateY(-100%)" : undefined,
      }}
      className="z-50 rounded-lg border border-border bg-surface p-[5px] text-left shadow-md"
    >
      <Can permission="catalog.category.update">
        <Link
          href={`/admin/categories/${node.id}`}
          role="menuitem"
          aria-label={`Edit ${node.name}`}
          className="flex h-[34px] w-full items-center gap-[9px] rounded-md px-2.5 text-left text-[13px] text-text-secondary hover:bg-surface-subtle"
        >
          <SquarePen className="h-4 w-4" />
          Edit
        </Link>
        <div className="mx-1.5 my-1 h-px bg-surface-subtle" />
        <button
          type="button"
          role="menuitem"
          onClick={onPublish}
          className="flex h-[34px] w-full items-center gap-[9px] rounded-md px-2.5 text-left text-[13px] text-text-secondary hover:bg-surface-subtle"
        >
          {node.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {node.is_published ? "Unpublish" : "Publish"}
        </button>
        {node.is_published && (
          <div className="px-2.5 pb-[5px] pl-[33px] text-[11px] leading-[1.35] text-text-muted">
            Unpublishing also hides all sub-categories.
          </div>
        )}
        <button
          type="button"
          role="menuitem"
          onClick={onShowInMenu}
          className="flex h-[34px] w-full items-center gap-[9px] rounded-md px-2.5 text-left text-[13px] text-text-secondary hover:bg-surface-subtle"
        >
          {node.show_in_menu ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {node.show_in_menu ? "Hide from menu" : "Show in menu"}
        </button>
      </Can>

      <Can permission="catalog.category.create">
        <div className="mx-1.5 my-1 h-px bg-surface-subtle" />
        {atMaxDepth ? (
          <span
            role="menuitem"
            aria-disabled
            title="Maximum depth is 3 levels."
            className="flex h-[34px] w-full cursor-not-allowed items-center gap-[9px] rounded-md px-2.5 text-left text-[13px] text-text-faint"
          >
            <Plus className="h-4 w-4" />
            Add sub-category
          </span>
        ) : (
          <Link
            href={`/admin/categories/new?parent=${node.id}`}
            role="menuitem"
            className="flex h-[34px] w-full items-center gap-[9px] rounded-md px-2.5 text-left text-[13px] text-text-secondary hover:bg-surface-subtle"
          >
            <Plus className="h-4 w-4" />
            Add sub-category
          </Link>
        )}
      </Can>

      <Can permission="catalog.category.delete">
        <div className="mx-1.5 my-1 h-px bg-surface-subtle" />
        <button
          type="button"
          role="menuitem"
          onClick={onDelete}
          className="flex h-[34px] w-full items-center gap-[9px] rounded-md px-2.5 text-left text-[13px] text-[#B91C1C] hover:bg-error-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </Can>
    </div>,
    document.body,
  );
}

/* --------------------------- DIALOGS --------------------------- */

function ConfirmDeleteDialog({
  name,
  pending,
  onConfirm,
  onClose,
}: {
  name: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEsc(onClose);
  return (
    <DialogShell label="Delete this category?" onClose={onClose}>
      <div className="mb-[18px] flex items-start gap-[13px]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-error-50 text-error">
          <Trash2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="m-0 text-base font-bold tracking-[-0.01em] text-text">Delete this category?</h3>
          <p className="mt-[7px] text-[13px] leading-[1.5] text-text-secondary">
            “{name}” will be soft-deleted and hidden from the storefront. You can restore it later via Show deleted.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-[9px]">
        <button
          type="button"
          onClick={onClose}
          className="h-[38px] rounded-md border border-border-strong bg-surface px-3.5 text-[13px] font-semibold text-text-secondary hover:bg-surface-subtle"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="h-[38px] rounded-md bg-error px-4 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
      </div>
    </DialogShell>
  );
}

function BlockedDialog({
  info,
  onClose,
}: {
  info: { name: string; children: number; products: number };
  onClose: () => void;
}) {
  useEsc(onClose);
  const pw = info.products === 1 ? "product" : "products";
  const cw = info.children === 1 ? "sub-category" : "sub-categories";
  return (
    <DialogShell label="Can't delete this category" onClose={onClose}>
      <div className="mb-[18px] flex items-start gap-[13px]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-50 text-warning">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="m-0 text-base font-bold tracking-[-0.01em] text-text">Can&apos;t delete this category</h3>
          <p className="mt-[7px] text-[13px] leading-[1.5] text-text-secondary">
            “{info.name}” has {info.products} published {pw} and {info.children} {cw}. Move or unpublish them first, then
            try again.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-[9px]">
        <button
          type="button"
          onClick={onClose}
          className="h-[38px] rounded-md bg-accent-600 px-4 text-[13px] font-semibold text-accent-fg hover:bg-accent-700"
        >
          Got it
        </button>
      </div>
    </DialogShell>
  );
}

function DialogShell({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div onClick={onClose} className="absolute inset-0 bg-[rgba(15,23,42,.40)]" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative w-[440px] max-w-full rounded-2xl bg-surface p-[22px] shadow-lg"
      >
        {children}
      </div>
    </div>
  );
}

/* --------------------------- SKELETON --------------------------- */

function TreeSkeleton() {
  return (
    <div className="divide-y divide-surface-subtle">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-[13px]" style={{ paddingLeft: 16 + (i % 3) * 22 }}>
          <span className="h-4 w-4 animate-pulse rounded bg-surface-subtle" />
          <span className="h-4 w-48 animate-pulse rounded bg-surface-subtle" />
          <span className="ml-auto h-5 w-20 animate-pulse rounded-full bg-surface-subtle" />
          <span className="h-5 w-16 animate-pulse rounded bg-surface-subtle" />
        </div>
      ))}
    </div>
  );
}

/* --------------------------- HELPERS --------------------------- */

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={
        "whitespace-nowrap border-b border-border py-[9px] pr-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-secondary " +
        className
      }
    >
      {children}
    </th>
  );
}

function useEsc(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
}

/** Count all non-deleted nodes in the tree. */
function countLive(nodes: CategoryNode[]): number {
  let c = 0;
  for (const n of nodes) {
    if (!n.is_deleted) {
      c += 1;
      c += countLive(n.children);
    }
  }
  return c;
}

function walkAll(nodes: CategoryNode[], fn: (n: CategoryNode) => void) {
  for (const n of nodes) {
    fn(n);
    walkAll(n.children, fn);
  }
}

/**
 * Flatten the tree into rows honouring expansion + search. When searching, every
 * matching node's ancestors stay visible (and expanded) so the match is reachable.
 */
function flatten(
  tree: CategoryNode[],
  opts: { q: string; expanded: Record<string, boolean>; includeDeleted: boolean },
): FlatRow[] {
  const { q, expanded, includeDeleted } = opts;
  const matches = (n: CategoryNode): boolean => n.name.toLowerCase().includes(q);
  const subtreeMatches = (n: CategoryNode): boolean => matches(n) || n.children.some(subtreeMatches);

  const out: FlatRow[] = [];
  const walk = (nodes: CategoryNode[], level: number, ancestorHasNext: boolean[], parentUnpublished: boolean, parentId: string | null) => {
    let visible = nodes.filter((n) => includeDeleted || !n.is_deleted);
    if (q) visible = visible.filter(subtreeMatches);

    visible.forEach((node, index) => {
      const isLast = index === visible.length - 1;
      const liveChildren = node.children.filter((c) => includeDeleted || !c.is_deleted);
      const hasChildren = liveChildren.length > 0;
      const isExpanded = q ? true : !!expanded[node.id];

      out.push({
        node,
        level,
        parentId,
        siblings: nodes,
        index,
        ancestorHasNext: level > 0 ? [...ancestorHasNext] : [],
        isLast,
        hasChildren,
        expanded: isExpanded,
        parentUnpublished,
      });

      if (hasChildren && isExpanded) {
        walk(node.children, level + 1, [...ancestorHasNext, !isLast], parentUnpublished || !node.is_published, node.id);
      }
    });
  };
  walk(tree, 0, [], false, null);
  return out;
}
