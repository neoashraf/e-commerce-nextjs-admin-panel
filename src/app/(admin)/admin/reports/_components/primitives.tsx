"use client";

import { formatDateTime } from "@/lib/format";
import {
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  Table,
  TableTotalsRow,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";

/**
 * Shared presentational primitives for the report viewers — state wrapper, stat
 * cards, sections, a generic data table, and the "as of" stamp. Re-skinned to
 * the design system (AD0 primitives); keeps the per-report viewers thin and
 * consistent (design §4 regions, §6 states).
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
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }
  if (isError) {
    return (
      <Card>
        <ErrorState description="Couldn't load the report." onRetry={onRetry} />
      </Card>
    );
  }
  if (isEmpty) {
    return (
      <Card>
        <EmptyState title="No data for this period." />
      </Card>
    );
  }
  return <>{children}</>;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-eyebrow uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-text">{value}</p>
    </Card>
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
      <h2 className="text-[18px] font-semibold text-text">{title}</h2>
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
  totalRow,
}: {
  caption?: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row, i: number) => string;
  /** Optional emphasized totals row, pinned at the bottom (design §8.6). */
  totalRow?: React.ReactNode;
}) {
  return (
    <Card>
      <Table>
        {caption && <caption className="sr-only">{caption}</caption>}
        <THead>
          <TR hover={false}>
            {columns.map((c) => (
              <TH key={c.header} numeric={c.align === "right"}>
                {c.header}
              </TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {rows.map((row, i) => (
            <TR key={rowKey(row, i)}>
              {columns.map((c) => (
                <TD key={c.header} numeric={c.align === "right"}>
                  {c.cell(row)}
                </TD>
              ))}
            </TR>
          ))}
          {totalRow}
        </TBody>
      </Table>
    </Card>
  );
}

/** Emphasized totals row for DataTable — cells aligned to the column set. */
export function TotalsRow({
  cells,
}: {
  cells: { content: React.ReactNode; align?: "left" | "right" }[];
}) {
  return (
    <TableTotalsRow>
      {cells.map((c, i) => (
        <td
          key={i}
          className={
            "px-4 py-3 " + (c.align === "right" ? "text-right tabular-nums" : "")
          }
        >
          {c.content}
        </td>
      ))}
    </TableTotalsRow>
  );
}

export function AsOf({ value }: { value?: string }) {
  if (!value) return null;
  return <p className="text-xs text-text-muted">As of {formatDateTime(value)}</p>;
}
