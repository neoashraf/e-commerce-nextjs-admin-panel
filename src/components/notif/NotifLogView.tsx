"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useNotifLog, useResendNotif } from "@/lib/api/hooks/useNotif";
import { Can } from "@/lib/permissions/Can";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/stores/toast";

/**
 * Notification delivery log (notif-log-fe). channel/event/recipient/status +
 * filters (URL-reflected); resend a failed notification. Read-mostly.
 */
const STATUS_STYLE: Record<string, string> = { sent: "bg-green-50 text-green-700", delivered: "bg-green-50 text-green-700", queued: "bg-blue-50 text-blue-700", failed: "bg-red-50 text-red-700" };

export function NotifLogView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const channel = sp.get("channel") ?? "";
  const status = sp.get("status") ?? "";

  const { data, isLoading, isError, refetch } = useNotifLog({ channel: channel || undefined, status: status || undefined, page: 1, limit: 100 });
  const resend = useResendNotif();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }
  const inp = "h-10 rounded-md border border-gray-300 px-3 text-sm";

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Notification log</h1>
      <div className="flex flex-wrap items-center gap-3">
        <select className={inp} value={channel} onChange={(e) => setParam("channel", e.target.value)}><option value="">All channels</option><option value="sms">SMS</option><option value="email">Email</option></select>
        <select className={inp} value={status} onChange={(e) => setParam("status", e.target.value)}><option value="">All statuses</option><option value="sent">Sent</option><option value="queued">Queued</option><option value="failed">Failed</option></select>
      </div>

      {isLoading ? <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        : isError ? <div className="py-12 text-center"><p className="text-sm text-gray-600">Couldn&apos;t load the log.</p><button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button></div>
        : !data || data.length === 0 ? <p className="py-12 text-center text-sm text-gray-500">No notifications match your filters.</p>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400"><th className="py-2 pr-4 font-medium">Time</th><th className="py-2 pr-4 font-medium">Channel</th><th className="py-2 pr-4 font-medium">Event</th><th className="py-2 pr-4 font-medium">Recipient</th><th className="py-2 pr-4 font-medium">Status</th><th className="py-2 font-medium">Actions</th></tr></thead>
            <tbody>
              {data.map((n) => (
                <tr key={n.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 text-gray-400">{n.created_at ? formatDateTime(n.created_at) : "—"}</td>
                  <td className="py-3 pr-4 text-gray-600">{n.channel}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-gray-700">{n.event_type ?? "—"}</td>
                  <td className="py-3 pr-4 text-gray-600">{n.recipient ?? "—"}</td>
                  <td className="py-3 pr-4"><span className={"rounded-full px-2 py-0.5 text-xs font-medium " + (STATUS_STYLE[n.status] ?? "bg-gray-100 text-gray-500")}>{n.status}</span></td>
                  <td className="py-3">{n.status === "failed" && <Can permission="notifications.log.resend"><button type="button" onClick={() => resend.mutate(n.id, { onSuccess: () => toast("Resend queued.") })} className="text-sm font-medium text-brand-700 hover:underline">Resend</button></Can>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}
