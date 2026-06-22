"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useNotifLog, useResendNotif } from "@/lib/api/hooks/useNotif";
import { Can } from "@/lib/permissions/Can";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/stores/toast";
import { usePageParams } from "@/lib/usePageParams";
import {
  Button,
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
 * Notification delivery log (notif-log-fe) on the shared Data Table primitive:
 * Card-wrapped table, StatusPill, and the shared TablePagination footer
 * (DEFAULT_PAGE_SIZE/page). channel/status filters URL-reflected; resend a failed
 * notification (gated). Read-mostly.
 */
export function NotifLogView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const channel = sp.get("channel") ?? "";
  const status = sp.get("status") ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const { pageSize, setPageSize } = usePageParams();

  const { data, isLoading, isError, refetch } = useNotifLog({
    channel: channel || undefined,
    status: status || undefined,
    page,
    limit: pageSize,
  });
  const resend = useResendNotif();

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;

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

  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-bold leading-7 tracking-tight text-text">Notification log</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-40">
          <Select value={channel} onChange={(e) => setParam("channel", e.target.value)} aria-label="Filter by channel">
            <option value="">All channels</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </Select>
        </div>
        <div className="w-40">
          <Select value={status} onChange={(e) => setParam("status", e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="sent">Sent</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <SkeletonRows rows={pageSize} cols={6} />
        ) : isError ? (
          <ErrorState description="Couldn’t load the log." onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No notifications match your filters." />
        ) : (
          <>
            <Table>
              <THead>
                <TR hover={false}>
                  <TH>Time</TH>
                  <TH>Channel</TH>
                  <TH>Event</TH>
                  <TH>Recipient</TH>
                  <TH>Status</TH>
                  <TH className="text-right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((n) => (
                  <TR key={n.id}>
                    <TD className="whitespace-nowrap tabular-nums text-text-muted">
                      {n.created_at ? formatDateTime(n.created_at) : "—"}
                    </TD>
                    <TD className="uppercase">{n.channel}</TD>
                    <TD className="font-mono text-xs">{n.event_type ?? "—"}</TD>
                    <TD>{n.recipient ?? "—"}</TD>
                    <TD>
                      <StatusPill status={n.status} />
                    </TD>
                    <TD className="text-right">
                      {n.status === "failed" && (
                        <Can permission="notifications.log.resend">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resend.mutate(n.id, { onSuccess: () => toast("Resend queued.") })}
                          >
                            Resend
                          </Button>
                        </Can>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={goPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </Card>
    </div>
  );
}
