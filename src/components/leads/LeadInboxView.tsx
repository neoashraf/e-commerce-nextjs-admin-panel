"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminLeads } from "@/lib/api/hooks/useLeadsAdmin";
import { formatDateTime } from "@/lib/format";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Select,
  SkeletonRows,
  StatusPill,
  Table,
  TablePagination,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";

/**
 * Admin leads inbox (lead-inbox-fe) on the AD6 Data Table primitive
 * (design-system §8.6): Card-wrapped table, eyebrow headers, StatusPill, and a
 * 15/page paginated footer backed by the API `meta.total`. Status/type filter +
 * `page` URL-reflected; rows open the thread. Presentation + pagination only.
 */
const PAGE_SIZE = DEFAULT_PAGE_SIZE;

export function LeadInboxView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "";
  const type = sp.get("type") ?? "";
  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);

  const { data, isLoading, isError, refetch } = useAdminLeads({ status: status || undefined, type: type || undefined, page, limit: PAGE_SIZE });

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page"); // filter change → back to page 1
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-bold leading-7 text-text">Leads</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44">
          <Select aria-label="Status" value={status} onChange={(e) => setParam("status", e.target.value)}>
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="open">Open</option>
            <option value="awaiting_customer">Awaiting customer</option>
            <option value="resolved">Resolved</option>
          </Select>
        </div>
        <div className="w-48">
          <Select aria-label="Type" value={type} onChange={(e) => setParam("type", e.target.value)}>
            <option value="">All types</option>
            <option value="general">General</option>
            <option value="product">Product question</option>
            <option value="order_issue">Order issue</option>
            <option value="claim_return">Claim / return</option>
            <option value="bulk_order">Bulk / team order</option>
            <option value="feedback">Feedback</option>
          </Select>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <SkeletonRows rows={10} cols={5} />
        ) : isError ? (
          <ErrorState description="Couldn't load leads." onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No leads match your filters." description="Try clearing the status or type filter." />
        ) : (
          <>
            <Table>
              <THead>
                <TR hover={false}>
                  <TH>Reference</TH>
                  <TH>Subject</TH>
                  <TH>Submitter</TH>
                  <TH>Status</TH>
                  <TH>Created</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((l) => (
                  <TR key={l.reference} className="cursor-pointer" onClick={() => router.push(`/admin/leads/${l.reference}`)}>
                    <TD>
                      <Link
                        href={`/admin/leads/${l.reference}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-xs font-medium text-accent-700 hover:underline"
                      >
                        {l.reference}
                      </Link>
                    </TD>
                    <TD className="text-text">
                      {l.subject}
                      <Badge tone="neutral" className="ml-2">{l.type.replace(/_/g, " ")}</Badge>
                    </TD>
                    <TD>{l.submitter?.name ?? l.submitter?.phone ?? "—"}</TD>
                    <TD><StatusPill status={l.status} /></TD>
                    <TD className="text-text-muted">{formatDateTime(l.created_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={(p) => setParam("page", String(p))} />
          </>
        )}
      </Card>
    </div>
  );
}
