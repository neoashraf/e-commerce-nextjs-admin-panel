import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";

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
  const Icon = sort === "asc" ? ChevronUp : ChevronDown;
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
            "inline-flex items-center gap-1 rounded-sm hover:text-text-secondary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
            numeric && "flex-row-reverse",
          )}
        >
          {children}
          {sort && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
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

/** Footer: "Showing X–Y of N" + prev/next pager. */
export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-t border-border px-4 py-3 text-sm text-text-muted",
        className,
      )}
    >
      <span className="tabular-nums">
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-subtle disabled:cursor-not-allowed disabled:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="px-2 tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-subtle disabled:cursor-not-allowed disabled:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
