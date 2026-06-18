"use client";

import { useMemo, useState } from "react";
import {
  Boxes,
  CreditCard,
  Download,
  FileText,
  Link2Off,
  Package,
  RotateCw,
  Search,
  ShoppingCart,
  Tag,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useCreateExport, useExportList } from "@/lib/api/hooks/reports";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  Card,
  EmptyState,
  ErrorState,
  Select,
  SkeletonRows,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/stores/toast";
import { getReportMeta, REPORTS_EXPORT_PERMISSION } from "./catalog";
import type {
  ExportFormat,
  ExportRow,
  ExportStatus,
} from "@/lib/api/schemas/reports";

/**
 * Export manager (FR-RPT-070) — the MANAGE › Exports view: every generated
 * report file with its parameters, format, request time, status, and an
 * expiring download link. A LIST screen on the AD0 `Table` (no period controls,
 * KPIs, or chart), matching `Reports - Exports (RPT).dc.html`. Consumes
 * `GET /admin/reports/exports` (degrades to the empty state until that endpoint
 * ships); Retry re-queues via the existing export mutation. Gated on
 * `reports.report.export`. Data layer untouched (AD4 / admin-redesign README §2).
 */

const REPORT_ICON: Record<string, LucideIcon> = {
  sales: TrendingUp,
  orders: ShoppingCart,
  products: Package,
  inventory: Boxes,
  customers: Users,
  payments: CreditCard,
  promotions: Tag,
  search: Search,
};

const STATUS_META: Record<ExportStatus, { label: string; pill: string; dot: string }> = {
  processing: { label: "Processing", pill: "bg-info-50 text-info", dot: "bg-info" },
  ready: { label: "Ready", pill: "bg-success-50 text-success", dot: "bg-success" },
  failed: { label: "Failed", pill: "bg-error-50 text-error", dot: "bg-error" },
};

type StatusFilter = "all" | ExportStatus;

/** Compact, defensive summary of an export's params (range · bucket/view). */
function formatParams(params?: Record<string, unknown>): string {
  if (!params) return "—";
  const humanize = (v: unknown) =>
    typeof v === "string"
      ? v.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : null;
  const parts = [
    humanize(params.range ?? params.period),
    humanize(params.bucket ?? params.view),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

function StatusPill({ status }: { status: ExportStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        meta.pill,
      )}
    >
      {status === "processing" ? (
        <span
          className="h-2.5 w-2.5 animate-spin rounded-full border-[1.6px] border-current border-t-transparent motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden="true" />
      )}
      {meta.label}
    </span>
  );
}

const actionBase =
  "inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2";

export function ExportManager() {
  const { can, ready } = usePermissions();
  const enabled = ready && can(REPORTS_EXPORT_PERMISSION);
  const { data, isLoading, isError, refetch } = useExportList(enabled);
  const create = useCreateExport();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [reportFilter, setReportFilter] = useState<string>("all");

  const rows = useMemo(() => data ?? [], [data]);

  const counts = useMemo(() => {
    const c = { all: rows.length, processing: 0, ready: 0, failed: 0 };
    rows.forEach((r) => {
      c[r.status] += 1;
    });
    return c;
  }, [rows]);

  const reportOptions = useMemo(() => {
    const present = new Set(rows.map((r) => r.report_key));
    return Array.from(present);
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (reportFilter !== "all" && r.report_key !== reportFilter) return false;
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        return true;
      }),
    [rows, statusFilter, reportFilter],
  );

  function isExpired(r: ExportRow): boolean {
    if (r.status !== "ready" || !r.expires_at) return false;
    const t = new Date(r.expires_at).getTime();
    return !Number.isNaN(t) && t < Date.now();
  }

  function retry(r: ExportRow) {
    const format = (
      String(r.format).toLowerCase() === "pdf" ? "pdf" : "csv"
    ) as ExportFormat;
    create.mutate(
      { report_key: r.report_key, params: r.params ?? {}, format },
      {
        onSuccess: () =>
          toast("Re-queued — we’ll notify you when it’s ready."),
        onError: () => toast("Couldn’t re-queue the export.", "error"),
      },
    );
  }

  if (ready && !can(REPORTS_EXPORT_PERMISSION)) {
    return (
      <Card className="p-0">
        <EmptyState
          icon={FileText}
          title="No access to exports"
          description="You don’t have permission to manage report exports."
        />
      </Card>
    );
  }

  const statusTabs: { key: StatusFilter; label: string; dot?: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "processing", label: "Processing", dot: "bg-info", count: counts.processing },
    { key: "ready", label: "Ready", dot: "bg-success", count: counts.ready },
    { key: "failed", label: "Failed", dot: "bg-error", count: counts.failed },
  ];

  const resultCount =
    filtered.length === rows.length
      ? `${rows.length} export${rows.length === 1 ? "" : "s"}`
      : `${filtered.length} of ${rows.length} exports`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold leading-7 tracking-tight text-text">
          Exports
        </h1>
        <p className="mt-1 text-[13px] text-text-muted">
          Generated report files — download links expire.
        </p>
      </div>

      {/* Toolbar: status filter + report filter + result count */}
      <div className="flex flex-wrap items-center gap-3.5">
        <div className="inline-flex h-9 items-center overflow-hidden rounded-md border border-border-strong bg-surface">
          {statusTabs.map((s, i) => {
            const on = statusFilter === s.key;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                onClick={() => setStatusFilter(s.key)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 px-3 text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-600",
                  i > 0 && "border-l border-border",
                  on
                    ? "bg-surface-subtle font-semibold text-text"
                    : "font-medium text-text-muted hover:bg-surface-hover",
                )}
              >
                {s.dot && (
                  <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden="true" />
                )}
                {s.label}
                <span className="text-[11px] font-semibold tabular-nums text-text-faint">
                  {s.count}
                </span>
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2">
          <span className="text-eyebrow uppercase tracking-wide text-text-faint">
            Report
          </span>
          <div className="w-44">
            <Select
              aria-label="Filter by report"
              value={reportFilter}
              onChange={(e) => setReportFilter(e.target.value)}
            >
              <option value="all">All reports</option>
              {reportOptions.map((key) => (
                <option key={key} value={key}>
                  {getReportMeta(key)?.label ?? key}
                </option>
              ))}
            </Select>
          </div>
        </label>

        <div className="flex-1" />
        <span
          aria-live="polite"
          className="whitespace-nowrap text-xs tabular-nums text-text-muted"
        >
          {resultCount}
        </span>
      </div>

      {isLoading ? (
        <Card className="p-0">
          <SkeletonRows rows={6} cols={6} />
        </Card>
      ) : isError ? (
        <Card className="p-0">
          <ErrorState
            description="Couldn’t load the exports."
            onRetry={() => refetch()}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={FileText}
            title="No exports yet."
            description="Use “Export” on any report to generate one."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table className="min-w-[920px]">
            <caption className="sr-only">Generated report exports</caption>
            <THead>
              <TR hover={false}>
                <TH>Report</TH>
                <TH>Parameters</TH>
                <TH>Format</TH>
                <TH>Requested</TH>
                <TH>Status</TH>
                <TH>Expires</TH>
                <TH className="text-right" />
              </TR>
            </THead>
            <TBody>
              {filtered.map((r) => {
                const Icon = REPORT_ICON[r.report_key] ?? FileText;
                const expired = isExpired(r);
                const fmt = String(r.format).toUpperCase();
                return (
                  <TR key={r.export_id}>
                    <TD className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-2.5">
                        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="font-semibold text-text">
                          {getReportMeta(r.report_key)?.label ?? r.report_key}
                        </span>
                      </span>
                    </TD>
                    <TD className="whitespace-nowrap tabular-nums text-text-faint">
                      {formatParams(r.params)}
                    </TD>
                    <TD>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-[5px] px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide",
                          fmt === "PDF"
                            ? "bg-error-50 text-error"
                            : "bg-info-50 text-info",
                        )}
                      >
                        {fmt}
                      </span>
                    </TD>
                    <TD className="whitespace-nowrap tabular-nums">
                      {r.created_at ? formatDateTime(r.created_at) : "—"}
                    </TD>
                    <TD>
                      <StatusPill status={r.status} />
                    </TD>
                    <TD
                      className={cn(
                        "whitespace-nowrap tabular-nums",
                        expired
                          ? "font-semibold text-error"
                          : r.expires_at
                            ? "text-text-muted"
                            : "text-text-faint",
                      )}
                    >
                      {r.expires_at ? (expired ? "Expired" : formatDate(r.expires_at)) : "—"}
                    </TD>
                    <TD className="text-right">
                      {r.status === "ready" && !expired && r.file_url ? (
                        <a
                          href={r.file_url}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            actionBase,
                            "border border-border-strong bg-surface text-text hover:bg-surface-subtle",
                          )}
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          Download
                        </a>
                      ) : r.status === "failed" ? (
                        <button
                          type="button"
                          onClick={() => retry(r)}
                          disabled={create.isPending}
                          className={cn(
                            actionBase,
                            "border border-error/40 bg-surface text-error hover:bg-error-50 disabled:opacity-50",
                          )}
                        >
                          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                          Retry
                        </button>
                      ) : expired ? (
                        <span className="inline-flex h-8 items-center gap-1.5 text-[13px] font-medium text-text-faint">
                          <Link2Off className="h-3.5 w-3.5" aria-hidden="true" />
                          Link expired
                        </span>
                      ) : (
                        <span
                          className={cn(
                            actionBase,
                            "cursor-not-allowed border border-border bg-surface-subtle text-text-faint",
                          )}
                          aria-disabled="true"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          Download
                        </span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <div className="border-t border-border px-5 py-3 text-xs tabular-nums text-text-muted">
            Showing {filtered.length} of {rows.length} export
            {rows.length === 1 ? "" : "s"}
          </div>
        </Card>
      )}
    </div>
  );
}
