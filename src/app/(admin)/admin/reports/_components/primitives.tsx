"use client";

import { formatDateTime } from "@/lib/format";

/**
 * Shared presentational primitives for the report viewers — state wrapper,
 * stat cards, sections, a generic data table, and the "as of" stamp. Keeps the
 * per-report viewers thin and consistent (design §4 regions, §6 states).
 */

/** Wraps a report body in loading / error / empty handling (design §6). */
export function ReportState({
  isLoading,
  isError,
  isEmpty,
  onRetry,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty?: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-72 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-600">Couldn&apos;t load the report.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-sm font-medium text-brand-700 hover:underline"
          >
            Try again
          </button>
        )}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
        <p className="text-sm text-gray-500">No data for this period.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

export interface Column<Row> {
  header: string;
  cell: (row: Row) => React.ReactNode;
  align?: "left" | "right";
}

/** Generic data table — the accessible equivalent of every chart (design §10). */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
}: {
  caption?: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row, i: number) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className={
                  "px-3 py-2 font-medium " +
                  (c.align === "right" ? "text-right" : "")
                }
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="border-b border-gray-100 last:border-0">
              {columns.map((c) => (
                <td
                  key={c.header}
                  className={
                    "px-3 py-2 text-gray-700 " +
                    (c.align === "right" ? "text-right" : "")
                  }
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AsOf({ value }: { value?: string }) {
  if (!value) return null;
  return <p className="text-xs text-gray-400">As of {formatDateTime(value)}</p>;
}
