import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { PAGE_SIZE_OPTIONS } from "@/lib/constants";

/**
 * The one data table (design-system §8.6). Composable, real <table> semantics:
 * surface-subtle eyebrow headers, hairline rows, right-aligned tabular numerics,
 * an emphasized totals row, and a paginated footer. Replaces hand-rolled tables.
 */

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-border bg-surface-subtle", className)}
      {...props}
    />
  );
}

export function TBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export type SortDir = "asc" | "desc" | null;

/** Header cell — eyebrow style; pass `sort` + `onSort` to make it sortable. */
export function TH({
  numeric = false,
  sort,
  onSort,
  className,
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
  sort?: SortDir;
  onSort?: () => void;
}) {
  const sortable = onSort !== undefined;
  // A sortable header ALWAYS shows a chevron so its sortability is obvious:
  // a faint up/down ChevronsUpDown when inactive, an accent up/down when active.
  const active = sort === "asc" || sort === "desc";
  const Icon = active ? (sort === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th
      scope="col"
      aria-sort={
        sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined
      }
      className={cn(
        "px-4 py-2.5 text-eyebrow uppercase tracking-wide text-text-muted",
        numeric ? "text-right" : "text-left",
        className,
      )}
      {...props}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            // Re-apply `text-eyebrow` on the button: a <button> resets font-size to
            // the UA default, so without this sortable headers render bigger than
            // plain ones. This pins every sortable header to the same 11px/600 eyebrow.
            "group inline-flex items-center gap-1 rounded-sm text-eyebrow hover:text-text-secondary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
            numeric && "flex-row-reverse",
          )}
        >
          {children}
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              active
                ? "text-accent-600"
                : "text-text-faint/70 group-hover:text-text-muted",
            )}
            aria-hidden="true"
          />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function TR({
  className,
  hover = true,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { hover?: boolean }) {
  return (
    <tr
      className={cn(
        "border-b border-border last:border-0",
        hover && "transition-colors hover:bg-surface-hover",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  numeric = false,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle text-text-secondary",
        numeric && "text-right tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

/** Emphasized totals row, pinned at the bottom of report tables. */
export function TableTotalsRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-t-2 border-border bg-surface-subtle font-semibold text-text",
        className,
      )}
      {...props}
    />
  );
}

/** A compact page window like [1, "…", 4, 5, 6, "…", 12]. */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

/**
 * Footer (design-system §8.6): "Showing X–Y of N" (left) + a rows-per-page select
 * and a numbered, ellipsis-compressed pager with prev/next (right). The select renders
 * only when `onPageSizeChange` is provided. Wraps to two rows on narrow widths.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = pageWindow(page, totalPages);
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border px-4 py-3 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <span className="tabular-nums">
        Showing {from}–{to} of {total}
      </span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 whitespace-nowrap">
            Rows per page
            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                aria-label="Rows per page"
                className="h-8 appearance-none rounded-md border border-border-strong bg-surface pl-2.5 pr-7 text-sm tabular-nums text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1"
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
            </div>
          </label>
        )}
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-subtle disabled:cursor-not-allowed disabled:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          {pages.map((p, i) =>
            p === "…" ? (
              <span
                key={`gap-${i}`}
                className="px-1.5 text-text-faint"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={cn(
                  "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
                  p === page
                    ? "bg-accent-600 text-accent-fg"
                    : "text-text-secondary hover:bg-surface-subtle",
                )}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-subtle disabled:cursor-not-allowed disabled:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  );
}
