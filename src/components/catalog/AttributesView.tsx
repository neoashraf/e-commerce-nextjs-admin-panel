"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Minus, MoreHorizontal, Plus, Search, SquarePen, Tag, Trash2, X } from "lucide-react";
import { useAttributes, useDeleteAttribute } from "@/lib/api/hooks/useCatalog";
import type { AttributeRow } from "@/lib/api/schemas/catalog";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { usePageParams } from "@/lib/usePageParams";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Attributes list (catalog-attributes-fe) — Catalog (CAT) redesign. Realizes
 * attributes-list.md on the shared admin design language used by Categories /
 * Products / Orders / Reports: a page header + count, a toolbar (search / type /
 * flag toggles / origin segmented), the DS data table (eyebrow headers, centered
 * ✓/— flags, System chip) with a per-row ••• portal menu (Edit / Delete), and a
 * design-styled pagination footer backed by `meta.total`. Search + type + flags +
 * origin + `page` are URL-reflected. Delete is guarded by ATTRIBUTE_IN_USE /
 * SYSTEM_ATTRIBUTE. The flag/origin filters pass through to the API as query
 * params; an older backend that ignores them simply doesn't narrow (graceful).
 * Behaviour parity with the old view — presentation + filters only.
 */

const TYPES = ["text", "select", "multiselect", "boolean", "number", "price", "date"] as const;
/** Flag filters: URL param ↔ label. Sent as `true` when on; absent when off. */
const FLAGS = [
  { param: "is_required", label: "Required" },
  { param: "is_unique", label: "Unique" },
  { param: "is_filterable", label: "Filterable" },
] as const;

function Flag({ on }: { on?: boolean }) {
  return on ? (
    <Check className="mx-auto h-4 w-4 text-success" aria-label="yes" />
  ) : (
    <Minus className="mx-auto h-4 w-4 text-text-faint" aria-label="no" />
  );
}

export function AttributesView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const type = sp.get("type") ?? "";
  const q = sp.get("q") ?? "";
  const origin = sp.get("origin") ?? ""; // "" | "system" | "user"
  const { page, pageSize, setPage, setPageSize } = usePageParams();

  const { data, isLoading, isError, refetch } = useAttributes({
    type: type || undefined,
    q: q || undefined,
    // Flag toggles → `true` when present in the URL.
    is_required: sp.get("is_required") === "1" || undefined,
    is_unique: sp.get("is_unique") === "1" || undefined,
    is_filterable: sp.get("is_filterable") === "1" || undefined,
    // Origin → is_user_defined (system = false, user = true).
    is_user_defined: origin === "system" ? false : origin === "user" ? true : undefined,
    page,
    limit: pageSize,
  });
  const del = useDeleteAttribute();
  const [target, setTarget] = useState<AttributeRow | null>(null);
  const [guard, setGuard] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const hasFilters = !!(q || type || origin || sp.get("is_required") || sp.get("is_unique") || sp.get("is_filterable"));

  // Close the ••• menu on any outside click (menu/trigger stop their own propagation).
  useEffect(() => {
    if (openMenu === null) return;
    const close = () => setOpenMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenu]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page"); // filter/search change → back to page 1
    setOpenMenu(null);
    router.push(`${pathname}?${next.toString()}`);
  }

  function toggleFlag(param: string) {
    setParam(param, sp.get(param) === "1" ? "" : "1");
  }

  function clearFilters() {
    setOpenMenu(null);
    router.push(pathname);
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

  return (
    <div className="mx-auto max-w-[1320px]">
      {/* ===== A. PAGE HEADER ===== */}
      <div className="mb-[18px] flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-7 tracking-[-0.01em] text-text">Attributes</h1>
          <p className="mt-[3px] text-[13px] tabular-nums text-text-secondary">
            {total} {total === 1 ? "attribute" : "attributes"}
          </p>
        </div>
        <Can permission="catalog.attribute.create">
          <Link
            href="/admin/attributes/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-accent-600 px-[15px] text-[13px] font-semibold text-accent-fg hover:bg-accent-700"
          >
            <Plus className="h-4 w-4" />
            Create Attribute
          </Link>
        </Can>
      </div>

      {/* ===== B. TOOLBAR ===== */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-9 min-w-[236px] max-w-[320px] flex-1 items-center gap-2.5 rounded-md border border-border-strong bg-surface px-3">
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            type="text"
            aria-label="Search attributes"
            placeholder="Search code or label…"
            defaultValue={q}
            key={q}
            onKeyDown={(e) => e.key === "Enter" && setParam("q", (e.target as HTMLInputElement).value)}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-muted"
          />
          {q.length > 0 && (
            <button type="button" onClick={() => setParam("q", "")} aria-label="Clear search" className="text-text-muted hover:text-text-secondary">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Type filter */}
        <select
          aria-label="Type"
          value={type}
          onChange={(e) => setParam("type", e.target.value)}
          className="h-9 rounded-md border border-border-strong bg-surface px-3 text-[12.5px] font-semibold text-text-secondary outline-none hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-accent-600"
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Flag toggles */}
        <div className="inline-flex h-9 items-center overflow-hidden rounded-md border border-border-strong bg-surface">
          {FLAGS.map((f, i) => {
            const on = sp.get(f.param) === "1";
            return (
              <span key={f.param} className="inline-flex h-full items-center">
                {i > 0 && <span className="h-5 w-px bg-border" />}
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleFlag(f.param)}
                  className={
                    "inline-flex h-full items-center px-3 text-[12.5px] font-semibold " +
                    (on ? "bg-accent-50 text-accent-700" : "text-text-secondary hover:bg-surface-subtle")
                  }
                >
                  {f.label}
                </button>
              </span>
            );
          })}
        </div>

        {/* Origin segmented (All / System / User-defined) */}
        <div className="inline-flex h-9 items-center overflow-hidden rounded-md border border-border-strong bg-surface">
          {[
            { value: "", label: "All" },
            { value: "system", label: "System" },
            { value: "user", label: "User-defined" },
          ].map((o, i) => {
            const active = origin === o.value;
            return (
              <span key={o.value || "all"} className="inline-flex h-full items-center">
                {i > 0 && <span className="h-5 w-px bg-border" />}
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setParam("origin", o.value)}
                  className={
                    "inline-flex h-full items-center px-3 text-[12.5px] font-semibold " +
                    (active ? "bg-accent-50 text-accent-700" : "text-text-secondary hover:bg-surface-subtle")
                  }
                >
                  {o.label}
                </button>
              </span>
            );
          })}
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-semibold text-text-secondary hover:bg-surface-subtle"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {guard && (
        <p role="alert" className="mb-3.5 rounded-md border border-warning/30 bg-warning-50 px-3 py-2 text-[13px] text-warning">
          {guard}
        </p>
      )}

      {/* ===== C. TABLE ===== */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <p className="text-[15px] font-semibold text-text">Couldn&apos;t load attributes.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 inline-flex h-[34px] items-center gap-[7px] rounded-md border border-border-strong bg-surface px-3.5 text-[13px] font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <span className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-muted">
              <Tag className="h-[22px] w-[22px]" />
            </span>
            <p className="text-[15px] font-semibold text-text">
              {hasFilters ? "No attributes match your filters." : "No attributes yet."}
            </p>
            <p className="mt-1 text-[13px] text-text-secondary">
              {hasFilters ? "Try clearing search or the filters." : "Create your first attribute to get started."}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex h-[34px] items-center gap-[7px] rounded-md border border-border-strong bg-surface px-3.5 text-[13px] font-semibold text-text-secondary hover:bg-surface-subtle"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr className="bg-surface-subtle">
                    <Th className="pl-[18px] text-left">Code</Th>
                    <Th className="text-left">Label</Th>
                    <Th className="text-left">Type</Th>
                    <Th className="w-20 text-center">Req</Th>
                    <Th className="w-20 text-center">Unique</Th>
                    <Th className="w-20 text-center">Filter</Th>
                    <Th className="w-20 text-center">Config</Th>
                    <Th className="text-left">Created</Th>
                    <Th className="w-[90px] pr-[18px] text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="border-b border-surface-subtle transition-colors last:border-0 hover:bg-surface-hover">
                      <td className="py-[11px] pl-[18px] pr-4 align-middle font-mono text-[12px] text-text-secondary">{a.code}</td>
                      <td className="py-[11px] pr-4 align-middle">
                        <span className="text-[13px] font-medium text-text">{a.admin_label}</span>
                        {a.is_user_defined === false && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-text-muted">
                            System
                          </span>
                        )}
                      </td>
                      <td className="py-[11px] pr-4 align-middle">
                        <span className="inline-flex items-center rounded-full bg-surface-subtle px-2.5 py-0.5 text-[11.5px] font-medium text-text-secondary">
                          {a.type ?? "—"}
                        </span>
                      </td>
                      <td className="py-[11px] pr-4 text-center align-middle"><Flag on={a.is_required} /></td>
                      <td className="py-[11px] pr-4 text-center align-middle"><Flag on={a.is_unique} /></td>
                      <td className="py-[11px] pr-4 text-center align-middle"><Flag on={a.is_filterable} /></td>
                      <td className="py-[11px] pr-4 text-center align-middle">
                        {a.type === "select" ? <Flag on={a.is_configurable} /> : <span className="text-text-faint">—</span>}
                      </td>
                      <td className="py-[11px] pr-4 align-middle text-[12.5px] text-text-muted">{a.created_at ? formatDate(a.created_at) : "—"}</td>
                      <td className="relative py-[11px] pr-[18px] text-right align-middle" onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          editHref={`/admin/attributes/${a.id}`}
                          editLabel={`Edit ${a.admin_label}`}
                          canDelete={a.is_user_defined !== false}
                          menuOpen={openMenu === a.id}
                          onMenuOpen={() => setOpenMenu((cur) => (cur === a.id ? null : a.id))}
                          onDelete={() => {
                            setOpenMenu(null);
                            setTarget(a);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationFooter page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        )}
      </div>

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

/* ----------------------- ROW ACTIONS (••• menu) ----------------------- */

export function RowActions({
  editHref,
  editLabel,
  canDelete,
  menuOpen,
  onMenuOpen,
  onDelete,
}: {
  editHref: string;
  editLabel: string;
  canDelete: boolean;
  menuOpen: boolean;
  onMenuOpen: () => void;
  onDelete: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onMenuOpen}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={
          "inline-flex h-[30px] w-[30px] items-center justify-center rounded-md text-text-secondary hover:bg-surface-subtle " +
          (menuOpen ? "bg-surface-subtle" : "")
        }
      >
        <MoreHorizontal className="h-[18px] w-[18px]" />
      </button>
      {menuOpen && (
        <RowMenu anchorRef={triggerRef} editHref={editHref} editLabel={editLabel} canDelete={canDelete} onDelete={onDelete} />
      )}
    </>
  );
}

function RowMenu({
  anchorRef,
  editHref,
  editLabel,
  canDelete,
  onDelete,
}: {
  anchorRef: React.RefObject<HTMLButtonElement>;
  editHref: string;
  editLabel: string;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const MENU_WIDTH = 176;
  const GAP = 6;
  const [pos, setPos] = useState<{ left: number; top: number; openUp: boolean } | null>(null);

  // Position against the trigger in viewport coords (position: fixed) so the menu
  // escapes the table's overflow container instead of growing a scrollbar.
  useLayoutEffect(() => {
    function place() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const left = Math.max(8, r.right - MENU_WIDTH);
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < 120 && r.top > 120;
      const top = openUp ? r.top - GAP : r.bottom + GAP;
      setPos({ left, top, openUp });
    }
    place();
    window.addEventListener("scroll", place, true);
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
      <Can permission="catalog.attribute.update">
        <Link
          href={editHref}
          role="menuitem"
          aria-label={editLabel}
          className="flex h-[34px] w-full items-center gap-[9px] rounded-md px-2.5 text-left text-[13px] text-text-secondary hover:bg-surface-subtle"
        >
          <SquarePen className="h-4 w-4" />
          Edit
        </Link>
      </Can>
      {canDelete && (
        <Can permission="catalog.attribute.delete">
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
      )}
    </div>,
    document.body,
  );
}

/* --------------------------- FOOTER / SKELETON --------------------------- */

export function PaginationFooter({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-[18px] py-[13px]">
      <div className="flex items-center gap-3">
        <span className="text-[12.5px] tabular-nums text-text-secondary">
          Showing {from}–{to} of {total}
        </span>
        <select
          aria-label="Rows per page"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-8 rounded-md border border-border bg-surface px-2 text-[12.5px] text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
        >
          {[20, 50, 100].map((s) => (
            <option key={s} value={s}>
              {s} / page
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-[3px]">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text-secondary hover:bg-surface-subtle disabled:text-text-faint disabled:hover:bg-surface"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-[12.5px] tabular-nums text-text-secondary">
          {page} / {lastPage}
        </span>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text-secondary hover:bg-surface-subtle disabled:text-text-faint disabled:hover:bg-surface"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-4 border-b border-border bg-surface-subtle px-[18px] py-3">
        <div className="h-3 w-24 rounded bg-border" />
        <div className="h-3 w-40 rounded bg-border" />
        <div className="ml-auto h-3 w-16 rounded bg-border" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-surface-subtle px-[18px] py-[13px]">
          <div className="h-3.5 w-24 rounded bg-surface-subtle" />
          <div className="h-3.5 w-44 rounded bg-surface-subtle" />
          <div className="ml-auto h-3.5 w-20 rounded bg-surface-subtle" />
        </div>
      ))}
    </div>
  );
}

export function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={
        "whitespace-nowrap border-b border-border py-[9px] pr-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-secondary " + className
      }
    >
      {children}
    </th>
  );
}
