"use client";

import Link from "next/link";
import {
  useRecentCustomers,
  useRecentLeads,
  useRecentOrders,
} from "@/lib/api/hooks/dashboard";
import { formatBDT, formatDateTime } from "@/lib/format";
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
    return <div className="h-40 animate-pulse rounded-lg bg-gray-100" />;
  if (isError)
    return (
      <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        Couldn&apos;t load this list.
      </p>
    );
  if (isEmpty)
    return (
      <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        Nothing recent.
      </p>
    );
  return <>{children}</>;
}

function RecentOrders() {
  const { data, isLoading, isError } = useRecentOrders();
  const rows = data ?? [];
  return (
    <Panel title="Recent orders">
      <ListState isLoading={isLoading} isError={isError} isEmpty={rows.length === 0}>
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {rows.map((o) => (
            <li key={o.order_no}>
              <Link
                href={`/admin/orders/${o.order_no}`}
                className="flex items-center justify-between p-3 text-sm hover:bg-gray-50"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-gray-900">{o.order_no}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {o.customer ?? "—"}
                    {o.placed_at ? ` · ${formatDateTime(o.placed_at)}` : ""}
                  </span>
                </span>
                {o.grand_total != null && (
                  <span className="shrink-0 text-gray-700">{formatBDT(Number(o.grand_total))}</span>
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
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {rows.map((c) => (
            <li key={c.customer_id}>
              <Link
                href={`/admin/customers/${c.customer_id}`}
                className="flex items-center justify-between p-3 text-sm hover:bg-gray-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gray-900">{c.name ?? "—"}</span>
                  {c.phone && <span className="block text-xs text-gray-500">{c.phone}</span>}
                </span>
                {c.created_at && (
                  <span className="shrink-0 text-xs text-gray-400">{formatDateTime(c.created_at)}</span>
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
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {rows.map((l, i) => {
            const href = l.reference ? `/admin/leads/${l.reference}` : "/admin/leads";
            return (
              <li key={l.reference ?? i}>
                <Link
                  href={href}
                  className="flex items-center justify-between p-3 text-sm hover:bg-gray-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900">
                      {l.subject ?? l.name ?? "Enquiry"}
                    </span>
                    {l.name && l.subject && (
                      <span className="block truncate text-xs text-gray-500">{l.name}</span>
                    )}
                  </span>
                  {l.created_at && (
                    <span className="shrink-0 text-xs text-gray-400">{formatDateTime(l.created_at)}</span>
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
