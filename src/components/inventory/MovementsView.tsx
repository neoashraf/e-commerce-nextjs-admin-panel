"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, ClipboardList, ExternalLink } from "lucide-react";
import { useMovements, type Movement } from "@/lib/api/hooks/useInventory";
import { formatDateTime } from "@/lib/format";
import {
  Badge,
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
  type BadgeTone,
} from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * SKU movement ledger (inv-movements-fe; design Stock Movements (INV).dc.html).
 * Read-only append-only history of stock movements for one variant. Reached from
 * the stock list. Read-only — no edit/delete affordance (FR-INV-052). Re-skinned
 * onto the AD0 Table; Type + date-range filters are URL-reflected and applied
 * client-side, so the fetch params stay untouched (AD6 / README §2).
 *
 * Note: the movements endpoint returns only the ledger — the SKU's product
 * title / reserved / available / derived status are not available here, so the
 * header shows the identifier + on-hand derived from the newest entry. Those
 * extra header fields would need the stock row (out of scope for this reskin).
 */
const TYPE_TONE: Record<string, BadgeTone> = {
  receive: "success",
  received: "success",
  restock: "success",
  restocked: "success",
  adjust: "accent",
  adjusted: "accent",
  correction: "info",
  reserve: "warning",
  reserved: "warning",
  release: "warning",
  released: "warning",
  sale: "neutral",
  sold: "neutral",
  scrap: "error",
  scrapped: "error",
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

function actorLabel(actor?: string): string {
  if (!actor) return "—";
  return actor.toLowerCase() === "system" ? "System" : humanize(actor);
}

export function MovementsView({ variantId }: { variantId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const typeFilter = sp.get("type") ?? "all";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  const { data, isLoading, isError, refetch } = useMovements(variantId, { page: 1, limit: 100 });

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
  const hasFilters = typeFilter !== "all" || from !== "" || to !== "";
  // Newest entry's resulting on-hand ≈ the SKU's current on-hand.
  const currentOnHand = useMemo(() => {
    const newest = (data ?? [])
      .filter((m): m is Movement & { resulting_on_hand: number } => typeof m.resulting_on_hand === "number")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    return newest?.resulting_on_hand;
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold leading-7 tracking-tight text-text tabular-nums">
            Movements — {variantId}
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            An append-only record of every stock change for this SKU. Read-only.
          </p>
        </div>
        <Link
          href="/admin/inventory"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-text transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          View stock
        </Link>
      </div>

      {currentOnHand !== undefined && (
        <Card className="flex items-center gap-3 px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-subtle text-text-faint">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-eyebrow uppercase tracking-wide text-text-muted">Current on-hand</p>
            <p className="text-lg font-bold tabular-nums text-text">{currentOnHand}</p>
          </div>
        </Card>
      )}

      {/* Filters (URL-reflected; applied client-side over the fetched page). */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44">
          <Select
            aria-label="Filter by movement type"
            value={typeFilter}
            onChange={(e) => patchQuery({ type: e.target.value === "all" ? undefined : e.target.value })}
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "All types" : humanize(t)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <label className="flex items-center gap-1.5">
            <span className="sr-only">From date</span>
            <input
              type="date"
              value={from}
              onChange={(e) => patchQuery({ from: e.target.value || undefined })}
              className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-text tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            />
          </label>
          <span aria-hidden="true">–</span>
          <label className="flex items-center gap-1.5">
            <span className="sr-only">To date</span>
            <input
              type="date"
              value={to}
              onChange={(e) => patchQuery({ to: e.target.value || undefined })}
              className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-text tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            />
          </label>
        </div>
        {data && (
          <span className="ml-auto whitespace-nowrap text-sm tabular-nums text-text-muted">
            {rows.length === total ? `${total} entries` : `${rows.length} of ${total} entries`}
          </span>
        )}
      </div>

      {isLoading ? (
        <Card className="p-0">
          <SkeletonRows rows={8} cols={6} />
        </Card>
      ) : isError ? (
        <Card className="p-0">
          <ErrorState description="Couldn't load movements." onRetry={() => refetch()} />
        </Card>
      ) : total === 0 ? (
        <Card className="p-0">
          <EmptyState icon={ClipboardList} title="No stock movements yet." />
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={ClipboardList}
            title="No movements match these filters."
            description="Try a different type or date range."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table className="min-w-[960px]">
            <caption className="sr-only">Stock movements for {variantId}, newest first.</caption>
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
                return (
                  <TR key={m.id}>
                    <TD className="whitespace-nowrap tabular-nums text-text-muted">
                      {formatDateTime(m.created_at)}
                    </TD>
                    <TD>
                      <Badge tone={TYPE_TONE[m.type.toLowerCase()] ?? "neutral"} className="capitalize">
                        {humanize(m.type)}
                      </Badge>
                    </TD>
                    <TD numeric>
                      <span
                        className={cn(
                          "inline-flex items-center justify-end gap-0.5 font-semibold tabular-nums",
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
                    <TD className="text-text-muted">{m.reason ?? "—"}</TD>
                    <TD>
                      {m.order_id ? (
                        <Link
                          href={`/admin/orders/${m.order_id}`}
                          className="inline-flex items-center gap-1 font-medium text-accent-700 hover:underline"
                        >
                          {m.order_id}
                          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      ) : (
                        <span className="text-text-faint">—</span>
                      )}
                    </TD>
                    <TD className="text-text-muted">{actorLabel(m.actor_type)}</TD>
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
