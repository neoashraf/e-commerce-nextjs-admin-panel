"use client";

import Link from "next/link";
import {
  useRecentCustomers,
  useRecentLeads,
  useRecentOrders,
} from "@/lib/api/hooks/dashboard";
import { formatBDT, formatDateTime } from "@/lib/format";
import { Skeleton } from "@/components/ui";
import { Panel } from "./widgets";

/**
 * Recent activity (FR-DASH-020/021) — three deep-linked lists (orders /
 * customers / leads), each with its own loading / empty / degraded state so a
 * single failing source degrades only its column (partial-outage rule §12.7).
 * Each column renders only when its widget is in the visible set.
 */

export function RecentActivity({
  showOrders,
  showCustomers,
  showLeads,
}: {
  showOrders: boolean;
  showCustomers: boolean;
  showLeads: boolean;
}) {
  if (!showOrders && !showCustomers && !showLeads) return null;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {showOrders && <RecentOrders />}
      {showCustomers && <RecentCustomers />}
      {showLeads && <RecentLeads />}
    </div>
  );
}

function ListState({
  isLoading,
  isError,
  isEmpty,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  if (isLoading)
    return (
      <div className="space-y-2 p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  if (isError)
    return (
      <p className="p-3 text-sm text-text-muted" role="alert">
        Couldn&apos;t load this list.
      </p>
    );
  if (isEmpty)
    return <p className="p-3 text-sm text-text-muted">Nothing recent.</p>;
  return <>{children}</>;
}

const ROW =
  "flex items-center justify-between gap-3 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600";

function RecentOrders() {
  const { data, isLoading, isError } = useRecentOrders();
  const rows = data ?? [];
  return (
    <Panel title="Recent orders">
      <ListState isLoading={isLoading} isError={isError} isEmpty={rows.length === 0}>
        <ul className="space-y-0.5">
          {rows.map((o) => (
            <li key={o.order_no}>
              <Link href={`/admin/orders/${o.order_no}`} className={ROW}>
                <span className="min-w-0">
                  <span className="block font-medium text-accent-700">{o.order_no}</span>
                  <span className="block truncate text-xs text-text-muted">
                    {o.customer ?? "—"}
                    {o.placed_at ? ` · ${formatDateTime(o.placed_at)}` : ""}
                  </span>
                </span>
                {o.grand_total != null && (
                  <span className="shrink-0 tabular-nums text-text-secondary">
                    {formatBDT(Number(o.grand_total))}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </ListState>
    </Panel>
  );
}

function RecentCustomers() {
  const { data, isLoading, isError } = useRecentCustomers();
  const rows = data ?? [];
  return (
    <Panel title="New customers">
      <ListState isLoading={isLoading} isError={isError} isEmpty={rows.length === 0}>
        <ul className="space-y-0.5">
          {rows.map((c) => (
            <li key={c.customer_id}>
              <Link href={`/admin/customers/${c.customer_id}`} className={ROW}>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-text">{c.name ?? "—"}</span>
                  {c.phone && <span className="block text-xs text-text-muted">{c.phone}</span>}
                </span>
                {c.created_at && (
                  <span className="shrink-0 text-xs text-text-faint">{formatDateTime(c.created_at)}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </ListState>
    </Panel>
  );
}

function RecentLeads() {
  const { data, isLoading, isError } = useRecentLeads();
  const rows = data ?? [];
  return (
    <Panel title="New leads">
      <ListState isLoading={isLoading} isError={isError} isEmpty={rows.length === 0}>
        <ul className="space-y-0.5">
          {rows.map((l, i) => {
            const href = l.reference ? `/admin/leads/${l.reference}` : "/admin/leads";
            return (
              <li key={l.reference ?? i}>
                <Link href={href} className={ROW}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-text">
                      {l.subject ?? l.name ?? "Enquiry"}
                    </span>
                    {l.name && l.subject && (
                      <span className="block truncate text-xs text-text-muted">{l.name}</span>
                    )}
                  </span>
                  {l.created_at && (
                    <span className="shrink-0 text-xs text-text-faint">{formatDateTime(l.created_at)}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </ListState>
    </Panel>
  );
}
