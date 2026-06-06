"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuditLog, exportAudit } from "@/lib/api/hooks/useAudit";
import type { AuditEntry, AuditResult } from "@/lib/api/schemas/audit";
import { formatDateTime } from "@/lib/format";

/**
 * Audit log (rbac-audit-log-fe). Read-only filter bar (URL-reflected, default
 * last 30 days) + desktop table / mobile cards + a detail drawer + CSV export
 * honoring the active filters. Distinct badges for denied/failed_login
 * (icon+text, not colour-only). No create/edit/delete controls anywhere.
 */
const RESULT_STYLE: Record<AuditResult, { cls: string; icon: string; label: string }> = {
  success: { cls: "bg-green-50 text-green-700", icon: "✓", label: "Success" },
  denied: { cls: "bg-amber-50 text-amber-700", icon: "⊘", label: "Denied" },
  failed_login: { cls: "bg-red-50 text-red-700", icon: "✕", label: "Failed login" },
  failed: { cls: "bg-red-50 text-red-700", icon: "✕", label: "Failed" },
};

function defaultFrom(): string {
  // Last 30 days — computed without Date.now() concerns (browser only).
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

  const { data, isLoading, isError, refetch } = useAuditLog({
    actor: filters.actor || undefined,
    action: filters.action || undefined,
    entity_type: filters.entity_type || undefined,
    result: filters.result || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    page: 1,
    limit: 50,
  });

  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
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

  const inp = "h-10 rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Audit log</h1>
        <button type="button" onClick={onExport} disabled={exporting} className="inline-flex h-10 items-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <input className={inp} placeholder="Actor id" value={filters.actor} onChange={(e) => setParam("actor", e.target.value)} />
        <input className={inp} placeholder="Action (e.g. orders.order.refund)" value={filters.action} onChange={(e) => setParam("action", e.target.value)} />
        <input className={inp} placeholder="Entity type" value={filters.entity_type} onChange={(e) => setParam("entity_type", e.target.value)} />
        <select className={inp} value={filters.result} onChange={(e) => setParam("result", e.target.value)}>
          <option value="">All results</option>
          <option value="success">Success</option>
          <option value="denied">Denied</option>
          <option value="failed_login">Failed login</option>
        </select>
        <label className="text-sm text-gray-600">From <input type="date" className={inp + " ml-1"} value={filters.from} onChange={(e) => setParam("from", e.target.value)} /></label>
        <label className="text-sm text-gray-600">To <input type="date" className={inp + " ml-1"} value={filters.to} onChange={(e) => setParam("to", e.target.value)} /></label>
        <button type="button" onClick={clearFilters} className="h-10 text-sm font-medium text-brand-700 hover:underline">Clear filters</button>
      </div>

      {exportError && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Couldn&apos;t export the log. Try again.</p>}

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">Couldn&apos;t load the audit log.</p>
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button>
        </div>
      ) : !data || data.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">No audit entries match your filters.</p>
      ) : (
        <>
          <table className="hidden w-full text-sm lg:table">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-4 font-medium">Time</th>
                <th className="py-2 pr-4 font-medium">Actor</th>
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 pr-4 font-medium">Entity</th>
                <th className="py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="cursor-pointer border-b border-gray-100 hover:bg-gray-50" onClick={() => setSelected(e)}>
                  <td className="py-3 pr-4 text-gray-500">{formatDateTime(e.created_at)}</td>
                  <td className="py-3 pr-4 text-gray-900">{e.actor?.name ?? "System"}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-gray-700">{e.action}</td>
                  <td className="py-3 pr-4 text-gray-600">{e.entity_type ? `${e.entity_type} ${e.entity_id ?? ""}` : "—"}</td>
                  <td className="py-3"><ResultBadge result={e.result} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="space-y-3 lg:hidden">
            {data.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setSelected(e)} className="w-full rounded-lg border border-gray-200 p-4 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-gray-700">{e.action}</span>
                    <ResultBadge result={e.result} />
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{e.actor?.name ?? "System"} · {formatDateTime(e.created_at)}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {selected && <DetailDrawer entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ResultBadge({ result }: { result: AuditResult }) {
  const s = RESULT_STYLE[result];
  return <span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium " + s.cls}><span aria-hidden>{s.icon}</span>{s.label}</span>;
}

function DetailDrawer({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const raw = JSON.stringify(entry.summary ?? {}, null, 2);
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Audit entry" className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Audit entry</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100">✕</button>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Summary</p>
              <button type="button" onClick={() => navigator.clipboard?.writeText(raw)} className="text-xs font-medium text-brand-700 hover:underline">Copy</button>
            </div>
            <pre className="mt-1 max-h-72 overflow-auto rounded-md bg-gray-50 p-3 text-xs text-gray-700">{raw}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={"text-gray-800 " + (mono ? "font-mono text-xs" : "")}>{value}</p>
    </div>
  );
}
