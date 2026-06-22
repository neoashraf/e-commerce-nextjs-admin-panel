"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, ChevronRight, Cpu, ExternalLink, History } from "lucide-react";
import {
  useMovements,
  useStockRowFromCache,
  type Movement,
} from "@/lib/api/hooks/useInventory";
import { formatDateTime } from "@/lib/format";
import { StockThumb } from "@/app/(admin)/admin/inventory/_components/StockThumb";
import { optionsLabel, STATUS_LABEL } from "@/app/(admin)/admin/inventory/_components/shared";
import {
  Card,
  EmptyState,
  ErrorState,
  Select,
  SkeletonRows,
  StatusPill,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * SKU movement ledger (inv-movements-fe; design Stock Movements (INV).dc.html).
 * Read-only append-only history for one variant — breadcrumb, a SKU header card
 * (thumbnail, title, status, on-hand/reserved/available stats), Type + date-range
 * filters, and a design-styled table (newest first). Read-only — no edit/delete
 * (FR-INV-052); filters are URL-reflected and applied client-side.
 *
 * Data-bind notes (degrade gracefully until BE adds the fields):
 *  - SKU header (code/title/options/reserved/available/status) is resolved from the
 *    stock-list React Query cache; on-hand falls back to the newest ledger entry.
 *  - Order column shows/links `order_no` when present, else the raw `order_id`.
 *  - "By" shows `actor_name` when present, else the actor type.
 */
// Type → pill tone + dot color (design Movements TYPES map; dot + label, never color-only).
const TYPE_STYLE: Record<
  string,
  { label: string; bg: string; fg: string; dot: string }
> = {
  receive: { label: "Received", bg: "bg-success-50", fg: "text-success", dot: "bg-success" },
  received: { label: "Received", bg: "bg-success-50", fg: "text-success", dot: "bg-success" },
  adjust: { label: "Adjusted", bg: "bg-warning-50", fg: "text-warning", dot: "bg-warning" },
  adjusted: { label: "Adjusted", bg: "bg-warning-50", fg: "text-warning", dot: "bg-warning" },
  correction: { label: "Correction", bg: "bg-sky-50", fg: "text-sky-700", dot: "bg-sky-500" },
  reserve: { label: "Reserved", bg: "bg-violet-50", fg: "text-violet-700", dot: "bg-violet-500" },
  reserved: { label: "Reserved", bg: "bg-violet-50", fg: "text-violet-700", dot: "bg-violet-500" },
  release: { label: "Released", bg: "bg-indigo-50", fg: "text-indigo-700", dot: "bg-indigo-500" },
  released: { label: "Released", bg: "bg-indigo-50", fg: "text-indigo-700", dot: "bg-indigo-500" },
  sale: { label: "Sold", bg: "bg-slate-100", fg: "text-slate-600", dot: "bg-slate-500" },
  sold: { label: "Sold", bg: "bg-slate-100", fg: "text-slate-600", dot: "bg-slate-500" },
  restock: { label: "Restocked", bg: "bg-teal-50", fg: "text-teal-700", dot: "bg-teal-500" },
  restocked: { label: "Restocked", bg: "bg-teal-50", fg: "text-teal-700", dot: "bg-teal-500" },
  scrap: { label: "Scrapped", bg: "bg-error-50", fg: "text-error", dot: "bg-error" },
  scrapped: { label: "Scrapped", bg: "bg-error-50", fg: "text-error", dot: "bg-error" },
};

const TYPE_OPTIONS = [
  "all",
  "received",
  "adjusted",
  "correction",
  "reserved",
  "released",
  "sold",
  "restocked",
  "scrapped",
];

function humanize(s: string): string {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function typeStyle(type: string) {
  return (
    TYPE_STYLE[type.toLowerCase()] ?? {
      label: humanize(type),
      bg: "bg-surface-subtle",
      fg: "text-text-secondary",
      dot: "bg-text-faint",
    }
  );
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** A pill matching the design's type/status chips (dot + label). */
function TypePill({ type }: { type: string }) {
  const s = typeStyle(type);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-semibold",
        s.bg,
        s.fg,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function MovementsView({ variantId }: { variantId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const typeFilter = sp.get("type") ?? "all";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  const { data, isLoading, isError, refetch } = useMovements(variantId, { page: 1, limit: 100 });
  const stockRow = useStockRowFromCache(variantId);

  function patchQuery(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  // Newest-first; Type + date-range applied client-side over the fetched page.
  const rows = useMemo(() => {
    const list = [...(data ?? [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const fromMs = from ? new Date(from).getTime() : null;
    const toMs = to ? new Date(to).getTime() + 86_400_000 : null; // inclusive end-of-day
    return list.filter((m) => {
      if (typeFilter !== "all" && m.type.toLowerCase() !== typeFilter) return false;
      const t = new Date(m.created_at).getTime();
      if (fromMs != null && t < fromMs) return false;
      if (toMs != null && t >= toMs) return false;
      return true;
    });
  }, [data, typeFilter, from, to]);

  const total = data?.length ?? 0;

  // Newest entry's resulting on-hand ≈ the SKU's current on-hand (fallback when no cache).
  const newestOnHand = useMemo(() => {
    const newest = (data ?? [])
      .filter((m): m is Movement & { resulting_on_hand: number } => typeof m.resulting_on_hand === "number")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    return newest?.resulting_on_hand;
  }, [data]);

  // SKU header values — from the stock cache where available, else best-effort fallbacks.
  const skuCode = stockRow?.sku_code ?? variantId;
  const onHand = stockRow?.on_hand ?? newestOnHand;
  const reserved = stockRow?.reserved;
  const available = stockRow?.available ?? (onHand !== undefined && reserved !== undefined ? onHand - reserved : undefined);
  const optionsText = optionsLabel(stockRow?.options);
  const thumbRow = {
    sku_code: skuCode,
    product_title: stockRow?.product_title,
    product_image: stockRow?.product_image,
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb (design Movements). */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-text-muted">
        <span>Inventory</span>
        <ChevronRight className="h-3.5 w-3.5 text-text-faint" aria-hidden="true" />
        <Link href="/admin/inventory" className="hover:text-accent-600">
          Stock
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-text-faint" aria-hidden="true" />
        <span className="tabular-nums">{skuCode}</span>
        <ChevronRight className="h-3.5 w-3.5 text-text-faint" aria-hidden="true" />
        <span className="font-semibold text-text">Movements</span>
      </nav>

      {/* Title */}
      <div>
        <h1 className="text-[22px] font-bold leading-7 tracking-tight text-text tabular-nums">
          Movements — {skuCode}
        </h1>
        <p className="mt-0.5 text-[13px] text-text-muted">
          An append-only record of every stock change for this SKU. Read-only.
        </p>
      </div>

      {/* ===== A. SKU HEADER CARD ===== */}
      <Card className="flex flex-wrap items-center gap-5 px-5 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <StockThumb row={thumbRow} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-bold tracking-tight text-text">
                {stockRow?.product_title ?? skuCode}
              </h2>
              {stockRow && <StatusPill status={stockRow.status} label={STATUS_LABEL[stockRow.status]} />}
            </div>
            <div className="mt-0.5 text-[12.5px] text-text-muted">
              <span className="tabular-nums text-text-faint">{skuCode}</span>
              {optionsText && ` · ${optionsText}`}
            </div>
          </div>
        </div>
        {/* Stat group */}
        <div className="flex items-stretch overflow-hidden rounded-lg border border-border">
          <Stat label="On-hand" value={onHand} />
          <span className="w-px bg-border" aria-hidden="true" />
          <Stat label="Reserved" value={reserved} muted />
          <span className="w-px bg-border" aria-hidden="true" />
          <Stat label="Available" value={available} emphasized />
        </div>
        <Link
          href="/admin/inventory"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border-strong bg-surface px-3.5 text-sm font-medium text-text transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          View stock
        </Link>
      </Card>

      {/* ===== B. FILTERS (URL-reflected; applied client-side) ===== */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44">
          <Select
            aria-label="Filter by movement type"
            value={typeFilter}
            onChange={(e) => patchQuery({ type: e.target.value === "all" ? undefined : e.target.value })}
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "All types" : typeStyle(t).label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex h-9 items-center gap-2 rounded-md border border-border-strong bg-surface px-2.5 text-sm text-text-muted">
          <Calendar className="h-[15px] w-[15px] shrink-0 text-text-faint" aria-hidden="true" />
          <label className="flex items-center">
            <span className="sr-only">From date</span>
            <input
              type="date"
              value={from}
              onChange={(e) => patchQuery({ from: e.target.value || undefined })}
              className="bg-transparent text-[13px] tabular-nums text-text focus:outline-none"
            />
          </label>
          <span aria-hidden="true">–</span>
          <label className="flex items-center">
            <span className="sr-only">To date</span>
            <input
              type="date"
              value={to}
              onChange={(e) => patchQuery({ to: e.target.value || undefined })}
              className="bg-transparent text-[13px] tabular-nums text-text focus:outline-none"
            />
          </label>
        </div>
        {data && (
          <span className="ml-auto whitespace-nowrap text-[13px] tabular-nums text-text-muted">
            {rows.length === total ? `${total} movements` : `${rows.length} of ${total} movements`}
          </span>
        )}
      </div>

      {/* ===== C. MOVEMENTS TABLE ===== */}
      {isLoading ? (
        <Card className="p-0">
          <SkeletonRows rows={8} cols={7} />
        </Card>
      ) : isError ? (
        <Card className="p-0">
          <ErrorState description="Couldn't load movements." onRetry={() => refetch()} />
        </Card>
      ) : total === 0 ? (
        <Card className="p-0">
          <EmptyState icon={History} title="No stock movements yet." />
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={History}
            title="No movements match these filters."
            description="Try a different type or widen the date range."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table className="min-w-[960px]">
            <caption className="sr-only">Stock movements for {skuCode}, newest first.</caption>
            <THead>
              <TR hover={false}>
                <TH>Date</TH>
                <TH>Type</TH>
                <TH numeric>Change</TH>
                <TH numeric>On-hand after</TH>
                <TH>Reason</TH>
                <TH>Order</TH>
                <TH>By</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((m) => {
                const up = m.quantity_delta >= 0;
                const orderLabel = m.order_no ?? m.order_id ?? null;
                const isSystem = (m.actor_type ?? "").toLowerCase() === "system";
                const byName = m.actor_name ?? (isSystem ? "System" : humanize(m.actor_type ?? "—"));
                return (
                  <TR key={m.id}>
                    <TD className="whitespace-nowrap tabular-nums text-text-secondary">
                      {formatDateTime(m.created_at)}
                    </TD>
                    <TD>
                      <TypePill type={m.type} />
                    </TD>
                    <TD numeric>
                      <span
                        className={cn(
                          "font-bold tabular-nums",
                          up ? "text-success" : "text-error",
                        )}
                      >
                        {up ? "+" : "−"}
                        {Math.abs(m.quantity_delta)}
                      </span>
                    </TD>
                    <TD numeric className="text-text-secondary">
                      {m.resulting_on_hand ?? "—"}
                    </TD>
                    <TD className="max-w-[280px] text-text-secondary">{m.reason ?? "—"}</TD>
                    <TD>
                      {orderLabel ? (
                        <Link
                          href={`/admin/orders/${m.order_no ?? m.order_id}`}
                          className="font-semibold tabular-nums text-accent-600 hover:underline"
                        >
                          {m.order_no ? orderLabel : `#${orderLabel}`}
                        </Link>
                      ) : (
                        <span className="text-text-faint">—</span>
                      )}
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-2">
                        {isSystem ? (
                          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-surface-subtle text-text-muted">
                            <Cpu className="h-3 w-3" aria-hidden="true" />
                          </span>
                        ) : (
                          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent-100 text-[9.5px] font-bold text-accent-700">
                            {m.actor_name ? initials(m.actor_name) : "A"}
                          </span>
                        )}
                        <span className="whitespace-nowrap text-text-secondary">{byName}</span>
                      </span>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

/** One cell in the SKU header stat group (On-hand / Reserved / Available). */
function Stat({
  label,
  value,
  muted = false,
  emphasized = false,
}: {
  label: string;
  value: number | undefined;
  muted?: boolean;
  emphasized?: boolean;
}) {
  return (
    <div className={cn("px-4 py-2.5 text-center", emphasized && "bg-surface-subtle")}>
      <div className="text-eyebrow uppercase tracking-wide text-text-faint">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-lg font-bold tabular-nums",
          muted ? "text-text-muted" : "text-text",
        )}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}
