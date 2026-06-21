"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuditLog, exportAudit } from "@/lib/api/hooks/useAudit";
import type { AuditEntry, AuditResult } from "@/lib/api/schemas/audit";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  SkeletonRows,
  Table,
  TablePagination,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";

/**
 * Audit log (rbac-audit-log-fe) on the shared Data Table primitive: Card-wrapped
 * table, eyebrow headers, distinct result badges (icon+text, not colour-only), a
 * detail drawer, the shared TablePagination footer (DEFAULT_PAGE_SIZE/page), and a
 * CSV export honouring the active filters. Read-only — no create/edit/delete.
 */
const RESULT_STYLE: Record<AuditResult, { cls: string; icon: string; label: string }> = {
  success: { cls: "bg-success-50 text-success", icon: "✓", label: "Success" },
  denied: { cls: "bg-warning-50 text-warning", icon: "⊘", label: "Denied" },
  failed_login: { cls: "bg-error-50 text-error", icon: "✕", label: "Failed login" },
  failed: { cls: "bg-error-50 text-error", icon: "✕", label: "Failed" },
};

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function AuditView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const filters = {
    actor: sp.get("actor") ?? "",
    action: sp.get("action") ?? "",
    entity_type: sp.get("entity_type") ?? "",
    result: sp.get("result") ?? "",
    from: sp.get("from") ?? defaultFrom(),
    to: sp.get("to") ?? "",
  };
  const page = Math.max(1, Number(sp.get("page")) || 1);

  const { data, isLoading, isError, refetch } = useAuditLog({
    actor: filters.actor || undefined,
    action: filters.action || undefined,
    entity_type: filters.entity_type || undefined,
    result: filters.result || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    page,
    limit: DEFAULT_PAGE_SIZE,
  });

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }
  function goPage(p: number) {
    const next = new URLSearchParams(sp.toString());
    if (p > 1) next.set("page", String(p));
    else next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }
  function clearFilters() {
    router.push(pathname);
  }

  async function onExport() {
    setExporting(true);
    setExportError(false);
    try {
      await exportAudit({
        actor: filters.actor || undefined,
        action: filters.action || undefined,
        entity_type: filters.entity_type || undefined,
        result: filters.result || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      });
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold leading-7 tracking-tight text-text">Audit log</h1>
        <Button variant="secondary" size="sm" onClick={onExport} loading={exporting}>
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Input placeholder="Actor id" value={filters.actor} onChange={(e) => setParam("actor", e.target.value)} aria-label="Actor id" />
        </div>
        <div className="w-56">
          <Input placeholder="Action (e.g. orders.order.refund)" value={filters.action} onChange={(e) => setParam("action", e.target.value)} aria-label="Action" />
        </div>
        <div className="w-44">
          <Input placeholder="Entity type" value={filters.entity_type} onChange={(e) => setParam("entity_type", e.target.value)} aria-label="Entity type" />
        </div>
        <div className="w-40">
          <Select value={filters.result} onChange={(e) => setParam("result", e.target.value)} aria-label="Result">
            <option value="">All results</option>
            <option value="success">Success</option>
            <option value="denied">Denied</option>
            <option value="failed_login">Failed login</option>
          </Select>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-text-muted">
          From
          <Input type="date" className="w-auto" value={filters.from} onChange={(e) => setParam("from", e.target.value)} aria-label="From date" />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-text-muted">
          To
          <Input type="date" className="w-auto" value={filters.to} onChange={(e) => setParam("to", e.target.value)} aria-label="To date" />
        </label>
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      </div>

      {exportError && (
        <p role="alert" className="rounded-md bg-error-50 px-3 py-2 text-sm text-error">
          Couldn’t export the log. Try again.
        </p>
      )}

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <SkeletonRows rows={DEFAULT_PAGE_SIZE} cols={5} />
        ) : isError ? (
          <ErrorState description="Couldn’t load the audit log." onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No audit entries match your filters." />
        ) : (
          <>
            <Table>
              <THead>
                <TR hover={false}>
                  <TH>Time</TH>
                  <TH>Actor</TH>
                  <TH>Action</TH>
                  <TH>Entity</TH>
                  <TH>Result</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((e) => (
                  <TR key={e.id} className="cursor-pointer" onClick={() => setSelected(e)}>
                    <TD className="whitespace-nowrap tabular-nums text-text-muted">{formatDateTime(e.created_at)}</TD>
                    <TD className="text-text">{e.actor?.name ?? "System"}</TD>
                    <TD className="font-mono text-xs">{e.action}</TD>
                    <TD>{e.entity_type ? `${e.entity_type} ${e.entity_id ?? ""}` : "—"}</TD>
                    <TD>
                      <ResultBadge result={e.result} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <TablePagination
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={total}
              onPageChange={goPage}
            />
          </>
        )}
      </Card>

      {selected && <DetailDrawer entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ResultBadge({ result }: { result: AuditResult }) {
  const s = RESULT_STYLE[result];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", s.cls)}>
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}

function DetailDrawer({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const raw = JSON.stringify(entry.summary ?? {}, null, 2);
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Audit entry"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-text">Audit entry</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-text-muted hover:bg-surface-subtle"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm">
          <Row label="Action" value={entry.action} mono />
          <Row label="Actor" value={entry.actor?.name ?? "System"} />
          <Row label="Entity" value={entry.entity_type ? `${entry.entity_type} ${entry.entity_id ?? "(deleted)"}` : "—"} />
          <Row label="Result" value={RESULT_STYLE[entry.result].label} />
          <Row label="IP" value={entry.ip ?? "—"} />
          <Row label="Time" value={formatDateTime(entry.created_at)} />
          <div>
            <div className="flex items-center justify-between">
              <p className="text-eyebrow uppercase tracking-wide text-text-faint">Summary</p>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(raw)}
                className="text-xs font-medium text-accent-700 hover:underline"
              >
                Copy
              </button>
            </div>
            <pre className="mt-1 max-h-72 overflow-auto rounded-md bg-surface-subtle p-3 text-xs text-text-secondary">{raw}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-eyebrow uppercase tracking-wide text-text-faint">{label}</p>
      <p className={cn("text-text-secondary", mono && "font-mono text-xs")}>{value}</p>
    </div>
  );
}
