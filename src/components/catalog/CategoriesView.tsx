"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpCircle,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Eye,
  EyeOff,
  Folder,
  GripVertical,
  MoveVertical,
  Plus,
  Search,
  SquarePen,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import {
  useCategoryTree,
  usePatchCategory,
  useReorderCategory,
  useDeleteCategory,
} from "@/lib/api/hooks/useCatalog";
import type { CategoryNode } from "@/lib/api/schemas/catalog";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/cn";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  StatusPill,
  Table,
  TBody,
  TH,
  THead,
  RowActions,
  ConfirmDialog,
} from "@/components/ui";

/* -------------------------------------------------------------------------- */
/* Tree helpers                                                               */
/* -------------------------------------------------------------------------- */

type UnitType = "line" | "mid" | "end" | "empty";

interface FlatRow {
  node: CategoryNode;
  level: number;
  units: UnitType[];
  hasChildren: boolean;
  expanded: boolean;
  /** Dimmed because this node or an ancestor is unpublished (FR-CAT-005 cascade). */
  dim: boolean;
  parentUnpub: boolean;
  /** 0-based index among its visible siblings. */
  index: number;
  siblingCount: number;
  parentId: string | null;
}

const clone = (tree: CategoryNode[]): CategoryNode[] =>
  tree.map((n) => ({ ...n, children: clone(n.children) }));

function findNode(tree: CategoryNode[], id: string): CategoryNode | null {
  for (const n of tree) {
    if (n.id === id) return n;
    const f = findNode(n.children, id);
    if (f) return f;
  }
  return null;
}

/** The children array holding `parentId`'s siblings (roots when null). */
function siblingsOf(tree: CategoryNode[], parentId: string | null): CategoryNode[] | null {
  if (parentId === null) return tree;
  return findNode(tree, parentId)?.children ?? null;
}

function patchNode(tree: CategoryNode[], id: string, patch: Partial<CategoryNode>): CategoryNode[] {
  return tree.map((n) =>
    n.id === id
      ? { ...n, ...patch }
      : { ...n, children: patchNode(n.children, id, patch) },
  );
}

function removeNode(tree: CategoryNode[], id: string): CategoryNode[] {
  return tree.filter((n) => n.id !== id).map((n) => ({ ...n, children: removeNode(n.children, id) }));
}

/** Every node id that has children (for "Expand all" / first-load default). */
function expandableIds(tree: CategoryNode[], acc: string[] = []): string[] {
  for (const n of tree) {
    if (n.children.length) {
      acc.push(n.id);
      expandableIds(n.children, acc);
    }
  }
  return acc;
}

function countAll(tree: CategoryNode[]): number {
  return tree.reduce((c, n) => c + (n.is_deleted ? 0 : 1) + countAll(n.children), 0);
}

/** Flatten the visible tree to rows with indentation/connector metadata. */
function flatten(
  tree: CategoryNode[],
  opts: { expanded: Record<string, boolean>; search: string; showDeleted: boolean },
): FlatRow[] {
  const q = opts.search.trim().toLowerCase();
  const matches = (n: CategoryNode): boolean => n.name.toLowerCase().includes(q);
  const subMatches = (n: CategoryNode): boolean => matches(n) || n.children.some(subMatches);
  const visibleKids = (n: CategoryNode) =>
    n.children.filter((c) => opts.showDeleted || !c.is_deleted);

  const out: FlatRow[] = [];
  const walk = (
    nodes: CategoryNode[],
    ancHasNext: boolean[],
    level: number,
    parentUnpub: boolean,
    parentId: string | null,
  ) => {
    let vis = nodes.filter((n) => opts.showDeleted || !n.is_deleted);
    if (q) vis = vis.filter(subMatches);
    vis.forEach((n, idx) => {
      const isLast = idx === vis.length - 1;
      const hasChildren = visibleKids(n).length > 0;
      const expanded = q ? true : !!opts.expanded[n.id];
      const units: UnitType[] = [];
      for (let i = 0; i < level; i++) {
        if (i < level - 1) units.push(ancHasNext[i] ? "line" : "empty");
        else units.push(isLast ? "end" : "mid");
      }
      out.push({
        node: n,
        level,
        units,
        hasChildren,
        expanded,
        dim: parentUnpub || !n.is_published,
        parentUnpub,
        index: idx,
        siblingCount: vis.length,
        parentId,
      });
      if (hasChildren && expanded) {
        walk(n.children, [...ancHasNext, !isLast], level + 1, parentUnpub || !n.is_published, n.id);
      }
    });
  };
  walk(tree, [], 0, false, null);
  return out;
}

/** One indentation cell with its connector guides (FR-CAT-003 depth context). */
function Connector({ type }: { type: UnitType }) {
  const vt = type === "line" || type === "mid" || type === "end";
  const vb = type === "line" || type === "mid";
  const h = type === "mid" || type === "end";
  return (
    <span className="relative w-[22px] shrink-0 self-stretch" aria-hidden="true">
      {vt && <span className="absolute left-[10px] top-0 h-1/2 w-0.5 bg-border-strong" />}
      {vb && <span className="absolute bottom-0 left-[10px] top-1/2 w-0.5 bg-border-strong" />}
      {h && <span className="absolute left-[10px] top-1/2 h-0.5 w-[11px] bg-border-strong" />}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Categories tree                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Admin categories tree (catalog-categories-redesign-fe) — built to
 * `Categories (CAT).dc.html`. Indented 3-level tree with connector guides,
 * Published + In-menu badges, sibling-only drag + keyboard reorder, inline
 * publish/show-in-menu, cascade-dim on an unpublished subtree, a delete-blocked
 * dialog with real counts, and toasts. <Can>-gated.
 */
export function CategoriesView() {
  const [showDeleted, setShowDeleted] = useState(false);
  const { data, isLoading, isError, refetch } = useCategoryTree(showDeleted);
  const patch = usePatchCategory();
  const reorder = useReorderCategory();
  const del = useDeleteCategory();

  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  // Keyboard-reorder state.
  const [lifted, setLifted] = useState<string | null>(null);
  const liftOrig = useRef<string[]>([]);
  const [focusHandle, setFocusHandle] = useState<string | null>(null);
  const [liveMsg, setLiveMsg] = useState("");

  // Drag state.
  const [dragId, setDragId] = useState<string | null>(null);
  const dragParent = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dropPos, setDropPos] = useState<"before" | "after" | null>(null);
  const [dropInvalid, setDropInvalid] = useState(false);

  // Delete dialogs.
  const [confirmTarget, setConfirmTarget] = useState<CategoryNode | null>(null);
  const [blocked, setBlocked] = useState<{ name: string; children: number; products: number } | null>(null);

  const initialized = useRef(false);

  // Seed/reconcile the local working tree from the server. Reordering and the
  // optimistic toggles mutate `tree`; a refetch (after settle) reseeds it — which
  // is also how a failed write rolls back. Expansion is initialised once.
  useEffect(() => {
    if (!data) return;
    setTree(clone(data));
    if (!initialized.current) {
      const ex: Record<string, boolean> = {};
      for (const id of expandableIds(data)) ex[id] = true;
      setExpanded(ex);
      initialized.current = true;
    }
  }, [data]);

  function live(msg: string) {
    setLiveMsg(msg);
  }

  const rows = flatten(tree, { expanded, search, showDeleted });
  const q = search.trim();
  const total = countAll(tree);
  const roots = tree.filter((n) => showDeleted || !n.is_deleted);

  /* ----- inline toggles (optimistic + toast) ----- */

  async function togglePublish(n: CategoryNode) {
    const next = !n.is_published;
    setTree((t) => patchNode(t, n.id, { is_published: next }));
    try {
      await patch.mutateAsync({ id: n.id, body: { is_published: next } });
      toast(
        next
          ? "Category published."
          : "Category unpublished — it and its sub-categories are now hidden from the storefront.",
        next ? "success" : "info",
      );
    } catch {
      setTree((t) => patchNode(t, n.id, { is_published: n.is_published }));
      toast("Couldn’t update the category. Try again.", "error");
    }
  }

  async function toggleMenu(n: CategoryNode) {
    const next = !n.show_in_menu;
    setTree((t) => patchNode(t, n.id, { show_in_menu: next }));
    try {
      await patch.mutateAsync({ id: n.id, body: { show_in_menu: next } });
      toast(next ? "Shown in menu." : "Hidden from menu.");
    } catch {
      setTree((t) => patchNode(t, n.id, { show_in_menu: n.show_in_menu }));
      toast("Couldn’t update the category. Try again.", "error");
    }
  }

  /* ----- reorder (sibling-only; absolute 0-based positions) ----- */

  /** Persist a sibling array's new order: PATCH every node whose slot changed. */
  async function commitOrder(parentId: string | null, ordered: CategoryNode[]) {
    const updates = ordered
      .map((n, i) => ({ id: n.id, position: i }))
      .filter((u, i) => ordered[i].position !== u.position);
    if (!updates.length) return;
    try {
      await reorder.mutateAsync(updates);
      toast("Order saved.");
    } catch {
      toast("Couldn’t save the new order. Try again.", "error");
    }
  }

  function moveByDrag(parentId: string | null, draggedId: string, targetId: string, pos: "before" | "after") {
    const sibs = siblingsOf(tree, parentId);
    if (!sibs) return;
    const arr = [...sibs];
    const from = arr.findIndex((x) => x.id === draggedId);
    if (from < 0) return;
    const [item] = arr.splice(from, 1);
    let ti = arr.findIndex((x) => x.id === targetId);
    if (ti < 0) return;
    if (pos === "after") ti += 1;
    arr.splice(ti, 0, item);
    setTree((t) => setSiblings(t, parentId, arr));
    void commitOrder(parentId, arr);
  }

  function setSiblings(t: CategoryNode[], parentId: string | null, arr: CategoryNode[]): CategoryNode[] {
    if (parentId === null) return arr;
    return t.map((n) =>
      n.id === parentId
        ? { ...n, children: arr }
        : { ...n, children: setSiblings(n.children, parentId, arr) },
    );
  }

  /* ----- keyboard reorder ----- */

  function onHandleKey(row: FlatRow, e: React.KeyboardEvent) {
    const n = row.node;
    const k = e.key;
    const sibs = siblingsOf(tree, row.parentId) ?? [];
    if (lifted !== n.id) {
      if (k === " " || k === "Enter" || k === "Spacebar") {
        e.preventDefault();
        liftOrig.current = sibs.map((x) => x.id);
        setLifted(n.id);
        live(`Lifted ${n.name}. Use Arrow Up and Down to move, Space to drop.`);
      }
      return;
    }
    if (k === "ArrowUp" || k === "ArrowDown") {
      e.preventDefault();
      const arr = [...sibs];
      const i = arr.findIndex((x) => x.id === n.id);
      const j = k === "ArrowUp" ? i - 1 : i + 1;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      setTree((t) => setSiblings(t, row.parentId, arr));
      live(`Moved ${n.name} to position ${j + 1} of ${arr.length}.`);
    } else if (k === " " || k === "Enter" || k === "Spacebar") {
      e.preventDefault();
      const arr = siblingsOf(tree, row.parentId) ?? [];
      const i = arr.findIndex((x) => x.id === n.id);
      setLifted(null);
      live(`Dropped ${n.name} at position ${i + 1} of ${arr.length}.`);
      void commitOrder(row.parentId, arr);
    } else if (k === "Escape") {
      e.preventDefault();
      const orig = liftOrig.current;
      const arr = [...(siblingsOf(tree, row.parentId) ?? [])].sort(
        (a, b) => orig.indexOf(a.id) - orig.indexOf(b.id),
      );
      setTree((t) => setSiblings(t, row.parentId, arr));
      setLifted(null);
      live("Reorder cancelled.");
    }
  }

  /* ----- delete ----- */

  async function onConfirmDelete() {
    if (!confirmTarget) return;
    const n = confirmTarget;
    try {
      await del.mutateAsync(n.id);
      setTree((t) => removeNode(t, n.id));
      setConfirmTarget(null);
      toast("Category deleted.");
    } catch (err) {
      setConfirmTarget(null);
      if (err instanceof ApiError && err.code === "CATEGORY_HAS_DEPENDENTS") {
        const ctx = err.context ?? {};
        setBlocked({
          name: n.name,
          children: Number(ctx.child_categories ?? 0),
          products: Number(ctx.published_products ?? 0),
        });
      } else {
        toast("Couldn’t delete the category. Try again.", "error");
      }
    }
  }

  function expandAll() {
    const ex: Record<string, boolean> = {};
    for (const id of expandableIds(tree)) ex[id] = true;
    setExpanded(ex);
  }

  return (
    <div className="space-y-4">
      {/* A. Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-7 tracking-tight text-text">Categories</h1>
          <p className="mt-0.5 text-sm text-text-muted tabular-nums">{total} categories</p>
        </div>
        <Can permission="catalog.category.create">
          <Link href="/admin/categories/new">
            <Button leadingIcon={<Plus className="h-4 w-4" />}>Create Category</Button>
          </Link>
        </Can>
      </div>

      {/* B. Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex h-9 min-w-[236px] max-w-xs flex-1 items-center gap-2 rounded-md border border-border-strong bg-surface px-3">
          <Search className="h-4 w-4 shrink-0 text-text-faint" aria-hidden="true" />
          <input
            type="text"
            aria-label="Search categories"
            placeholder="Search categories by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-faint"
          />
          {q && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="shrink-0 text-text-faint hover:text-text-secondary">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="inline-flex h-9 items-center overflow-hidden rounded-md border border-border-strong bg-surface">
          <button type="button" onClick={expandAll} className="inline-flex h-full items-center gap-1.5 px-3 text-[13px] font-medium text-text-secondary hover:bg-surface-subtle">
            <ChevronsUpDown className="h-3.5 w-3.5" /> Expand all
          </button>
          <span className="h-5 w-px bg-border" />
          <button type="button" onClick={() => setExpanded({})} className="inline-flex h-full items-center gap-1.5 px-3 text-[13px] font-medium text-text-secondary hover:bg-surface-subtle">
            <ChevronsDownUp className="h-3.5 w-3.5" /> Collapse all
          </button>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={showDeleted}
          onClick={() => setShowDeleted((v) => !v)}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[13px] font-medium",
            showDeleted ? "border-accent-600 bg-accent-50 text-accent-700" : "border-border-strong bg-surface text-text-secondary hover:bg-surface-subtle",
          )}
        >
          <span className={cn("relative h-[17px] w-[30px] rounded-full transition-colors", showDeleted ? "bg-accent-600" : "bg-border-strong")}>
            <span className={cn("absolute top-0.5 h-[13px] w-[13px] rounded-full bg-white shadow-sm transition-all", showDeleted ? "left-[15px]" : "left-0.5")} />
          </span>
          Show deleted
        </button>

        <span className="ml-auto whitespace-nowrap text-sm text-text-muted tabular-nums">
          {roots.length} top-level {roots.length === 1 ? "category" : "categories"}
        </span>
      </div>

      {/* C. Tree table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-surface-subtle" style={{ marginLeft: (i % 3) * 22 }} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState title="Couldn’t load categories." onRetry={() => refetch()} />
        ) : roots.length === 0 ? (
          <EmptyState
            icon={Folder}
            title="No categories yet."
            description="Create your first category to organise the catalog. The tree can be up to 3 levels deep."
            action={
              <Can permission="catalog.category.create">
                <Link href="/admin/categories/new">
                  <Button leadingIcon={<Plus className="h-4 w-4" />}>Create your first category</Button>
                </Link>
              </Can>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Search}
            title={`No categories match “${q}”.`}
            action={<Button variant="secondary" leadingIcon={<X className="h-4 w-4" />} onClick={() => setSearch("")}>Clear search</Button>}
          />
        ) : (
          <Table className="min-w-[920px]">
            <THead>
              <tr>
                <TH className="w-[42px]" aria-label="Reorder" />
                <TH className="min-w-[360px]">Name</TH>
                <TH className="w-24 text-center">Position</TH>
                <TH className="w-[140px]">Published</TH>
                <TH className="w-32">In menu</TH>
                <TH className="w-[118px] text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <CategoryRow
                  key={row.node.id}
                  row={row}
                  searching={!!q}
                  lifted={lifted === row.node.id}
                  showHint={focusHandle === row.node.id || lifted === row.node.id}
                  dropBefore={dropTarget === row.node.id && !dropInvalid && dropPos === "before"}
                  dropAfter={dropTarget === row.node.id && !dropInvalid && dropPos === "after"}
                  dragging={dragId === row.node.id}
                  onToggleExpand={() => setExpanded((s) => ({ ...s, [row.node.id]: !s[row.node.id] }))}
                  onHandleKey={(e) => onHandleKey(row, e)}
                  onHandleFocus={() => setFocusHandle(row.node.id)}
                  onHandleBlur={() => { if (lifted !== row.node.id) setFocusHandle(null); }}
                  onDragStart={() => { setDragId(row.node.id); dragParent.current = row.parentId; }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragId === null || dragId === row.node.id) return;
                    if (row.parentId !== dragParent.current) {
                      setDropTarget(row.node.id); setDropInvalid(true); setDropPos(null);
                      e.dataTransfer.dropEffect = "none";
                      return;
                    }
                    const r = e.currentTarget.getBoundingClientRect();
                    const pos = e.clientY - r.top < r.height / 2 ? "before" : "after";
                    setDropTarget(row.node.id); setDropPos(pos); setDropInvalid(false);
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = dragId; const parent = dragParent.current;
                    const invalid = dropInvalid || row.parentId !== parent;
                    const target = row.node.id; const pos = dropPos;
                    setDragId(null); setDropTarget(null); setDropPos(null); setDropInvalid(false);
                    if (id && !invalid && pos) moveByDrag(parent, id, target, pos);
                  }}
                  onDragEnd={() => { setDragId(null); setDropTarget(null); setDropPos(null); setDropInvalid(false); }}
                  onTogglePublish={() => togglePublish(row.node)}
                  onToggleMenu={() => toggleMenu(row.node)}
                  onDelete={() => setConfirmTarget(row.node)}
                />
              ))}
            </TBody>
          </Table>
        )}

        {/* D. Footer — roots pagination (single page at current scale) */}
        {!isLoading && !isError && roots.length > 0 && (
          <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
            <span className="text-[13px] text-text-muted tabular-nums">
              Showing 1–{roots.length} of {roots.length} top-level categories
            </span>
          </div>
        )}
      </Card>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirmTarget}
        title="Delete category?"
        message={<>“{confirmTarget?.name}” will be soft-deleted and hidden from the catalog. You can restore it via “Show deleted”.</>}
        confirmLabel="Delete"
        danger
        pending={del.isPending}
        onConfirm={onConfirmDelete}
        onClose={() => setConfirmTarget(null)}
      />

      {/* Delete-blocked dialog (409 CATEGORY_HAS_DEPENDENTS) */}
      {blocked && <DeleteBlockedDialog blocked={blocked} onClose={() => setBlocked(null)} />}

      {/* Keyboard-reorder live region */}
      {liveMsg && (
        <div aria-live="polite" className="fixed bottom-5 left-5 z-[90] flex max-w-sm items-center gap-2 rounded-lg bg-text px-3.5 py-2.5 text-[13px] font-medium text-surface shadow-lg">
          <MoveVertical className="h-4 w-4 shrink-0 text-accent-100" aria-hidden="true" />
          {liveMsg}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Row                                                                        */
/* -------------------------------------------------------------------------- */

function CategoryRow({
  row,
  searching,
  lifted,
  showHint,
  dropBefore,
  dropAfter,
  dragging,
  onToggleExpand,
  onHandleKey,
  onHandleFocus,
  onHandleBlur,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onTogglePublish,
  onToggleMenu,
  onDelete,
}: {
  row: FlatRow;
  searching: boolean;
  lifted: boolean;
  showHint: boolean;
  dropBefore: boolean;
  dropAfter: boolean;
  dragging: boolean;
  onToggleExpand: () => void;
  onHandleKey: (e: React.KeyboardEvent) => void;
  onHandleFocus: () => void;
  onHandleBlur: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onTogglePublish: () => void;
  onToggleMenu: () => void;
  onDelete: () => void;
}) {
  const n = row.node;
  const isDel = !!n.is_deleted;
  const canReorder = !isDel && !searching;
  const atMaxDepth = row.level >= 2; // level is 0-based here → 2 == 3rd level
  const dimStyle = isDel ? "opacity-60" : row.dim ? "opacity-50" : "";
  const showHiddenHint = !isDel && !n.is_published && !row.parentUnpub;

  return (
    <tr
      draggable={canReorder}
      onDragStart={canReorder ? onDragStart : undefined}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "border-b border-border last:border-0 transition-colors hover:bg-surface-hover",
        dragging && "bg-surface-subtle",
        lifted && "shadow-[inset_0_0_0_2px_var(--accent-600)]",
        dropBefore && "shadow-[inset_0_2px_0_0_var(--accent-600)]",
        dropAfter && "shadow-[inset_0_-2px_0_0_var(--accent-600)]",
      )}
    >
      {/* Drag handle */}
      <td className="relative w-[42px] pl-3 align-middle">
        {canReorder && (
          <button
            type="button"
            onKeyDown={onHandleKey}
            onFocus={onHandleFocus}
            onBlur={onHandleBlur}
            aria-label={`Reorder ${n.name}. Space to lift, Arrow Up or Down to move, Space to drop, Escape to cancel.`}
            className={cn(
              "inline-flex h-6 w-6 cursor-grab items-center justify-center rounded text-text-faint hover:bg-surface-subtle",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
              lifted && "bg-accent-50 text-accent-700",
            )}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        {showHint && (
          <div role="status" className="absolute left-2 top-9 z-30 whitespace-nowrap rounded-lg bg-text px-2.5 py-1.5 text-[11px] font-medium text-surface shadow-lg">
            Space to lift · ↑/↓ to move · Space to drop · Esc to cancel
          </div>
        )}
      </td>

      {/* Name */}
      <td className="py-0 pr-4 align-middle">
        <div className="flex min-h-[44px] items-stretch">
          {row.units.map((u, i) => (
            <Connector key={i} type={u} />
          ))}
          <div className={cn("flex min-w-0 items-center gap-2.5", dimStyle)}>
            {row.hasChildren ? (
              <button
                type="button"
                onClick={onToggleExpand}
                aria-label={`${row.expanded ? "Collapse" : "Expand"} ${n.name}`}
                aria-expanded={row.expanded}
                className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded text-text-muted hover:bg-surface-subtle"
              >
                <ChevronRight className={cn("h-4 w-4 transition-transform", row.expanded && "rotate-90")} />
              </button>
            ) : (
              <span className="w-[22px] shrink-0" />
            )}
            <span className="shrink-0 text-text-faint">
              {row.hasChildren ? <Folder className="h-4 w-4" /> : <Tag className="h-4 w-4" />}
            </span>
            <Link
              href={`/admin/categories/${n.id}`}
              title={n.name}
              className={cn(
                "max-w-[300px] truncate text-[13.5px] hover:text-accent-600",
                row.level === 0 ? "font-semibold" : "font-medium",
                isDel ? "text-text-faint" : "text-text",
              )}
            >
              {n.name}
            </Link>
            {showHiddenHint && (
              <span
                title="Unpublished — this category and its sub-categories are hidden from the storefront."
                className="inline-flex shrink-0 cursor-help items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[10.5px] font-semibold text-warning"
              >
                <EyeOff className="h-3 w-3" /> Hidden on storefront
              </span>
            )}
            {isDel && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-subtle px-2 py-0.5 text-[10.5px] font-semibold text-text-muted">
                <Trash2 className="h-3 w-3" /> Deleted · read-only
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Position */}
      <td className="w-24 px-4 text-center align-middle">
        <span className={cn("text-[12.5px] font-semibold tabular-nums text-text-secondary", dimStyle)}>{row.index + 1}</span>
      </td>

      {/* Published */}
      <td className="w-[140px] px-4 align-middle">
        <span className={dimStyle}>
          {n.is_published ? (
            <StatusPill status="published" label="Published" />
          ) : (
            <StatusPill status="unpublished" label="Unpublished" />
          )}
        </span>
      </td>

      {/* In menu */}
      <td className="w-32 px-4 align-middle">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium",
            n.show_in_menu ? "bg-info-50 text-info" : "bg-surface-subtle text-text-muted",
            dimStyle,
          )}
        >
          {n.show_in_menu ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {n.show_in_menu ? "In menu" : "Hidden"}
        </span>
      </td>

      {/* Actions */}
      <td className="w-[118px] py-3 pr-4 text-right align-middle">
        {!isDel && (
          <Can anyOf={["catalog.category.update", "catalog.category.create", "catalog.category.delete"]}>
          <div className="inline-flex items-center gap-1">
            <Can permission="catalog.category.update">
              <Link
                href={`/admin/categories/${n.id}`}
                aria-label={`Edit ${n.name}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2.5 text-[12.5px] font-medium text-text-secondary hover:bg-surface-subtle"
              >
                <SquarePen className="h-3.5 w-3.5" /> Edit
              </Link>
            </Can>
            <RowActions label={`More actions for ${n.name}`} width="w-52">
              {(close) => (
                <>
                  <Can permission="catalog.category.update">
                    <MenuItem
                      icon={n.is_published ? <EyeOff className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                      label={n.is_published ? "Unpublish" : "Publish"}
                      onClick={() => { onTogglePublish(); close(); }}
                    />
                    {n.is_published && (
                      <p className="px-2.5 pb-1.5 pl-[34px] text-[11px] leading-snug text-text-faint">
                        Unpublishing also hides all sub-categories.
                      </p>
                    )}
                    <MenuItem
                      icon={n.show_in_menu ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      label={n.show_in_menu ? "Hide from menu" : "Show in menu"}
                      onClick={() => { onToggleMenu(); close(); }}
                    />
                  </Can>
                  <Can permission="catalog.category.create">
                    <div className="my-1 h-px bg-border" />
                    {atMaxDepth ? (
                      <span title="Maximum depth is 3 levels." className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-text-faint">
                        <Plus className="h-4 w-4" /> Add sub-category
                      </span>
                    ) : (
                      <Link
                        href={`/admin/categories/new?parent=${n.id}`}
                        role="menuitem"
                        onClick={close}
                        className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-text-secondary hover:bg-surface-subtle"
                      >
                        <Plus className="h-4 w-4" /> Add sub-category
                      </Link>
                    )}
                  </Can>
                  <Can permission="catalog.category.delete">
                    <div className="my-1 h-px bg-border" />
                    <MenuItem
                      icon={<Trash2 className="h-4 w-4" />}
                      label="Delete"
                      danger
                      onClick={() => { onDelete(); close(); }}
                    />
                  </Can>
                </>
              )}
            </RowActions>
          </div>
          </Can>
        )}
      </td>
    </tr>
  );
}

function MenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-surface-subtle",
        danger ? "text-error hover:bg-error-50" : "text-text-secondary",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Delete-blocked dialog                                                      */
/* -------------------------------------------------------------------------- */

function DeleteBlockedDialog({
  blocked,
  onClose,
}: {
  blocked: { name: string; children: number; products: number };
  onClose: () => void;
}) {
  const productWord = blocked.products === 1 ? "product" : "products";
  const childWord = blocked.children === 1 ? "sub-category" : "sub-categories";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Can't delete this category" className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning-50 text-warning">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-text">Can&apos;t delete this category</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
              This category has {blocked.products} published {productWord} and {blocked.children} {childWord}. Move or unpublish them first, then try again.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Link href="/admin/products" className="inline-flex h-9 items-center rounded-md border border-border-strong bg-surface px-3.5 text-[13px] font-medium text-text-secondary hover:bg-surface-subtle">
            View products
          </Link>
          <Button variant="secondary" onClick={onClose}>View sub-categories</Button>
          <Button onClick={onClose}>Got it</Button>
        </div>
      </div>
    </div>
  );
}
