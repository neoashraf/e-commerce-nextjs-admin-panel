"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useAdminLead,
  useReplyLead,
  useAddInternalNote,
  useChangeLeadStatus,
  useAssignLead,
  type LeadAttachment,
} from "@/lib/api/hooks/useLeadsAdmin";
import { useAdminUsers } from "@/lib/api/hooks/useAdminUsers";
import { Can } from "@/lib/permissions/Can";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/stores/toast";
import { LeadClaimHandoff } from "@/components/leads/LeadClaimHandoff";

/** Lead types eligible for a claim → Orders exchange handoff (FR-LEAD-016). */
const HANDOFF_TYPES = ["claim_return", "order_issue"];

const STATUS_OPTIONS = ["open", "awaiting_customer", "resolved", "closed", "spam"] as const;

/**
 * Admin lead thread (lead-inbox-fe). Submitter + linked order, message thread
 * (inbound/outbound/internal), reply (NOTIF-delivered) + internal note.
 */
export function LeadThreadView({ reference }: { reference: string }) {
  const { data, isLoading, isError } = useAdminLead(reference);
  const reply = useReplyLead(reference);
  const note = useAddInternalNote(reference);
  const [replyBody, setReplyBody] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [showHandoff, setShowHandoff] = useState(false);

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
  if (isError || !data) {
    return <div className="py-12 text-center"><p className="text-sm text-gray-600">We couldn&apos;t find that lead.</p><Link href="/admin/leads" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">Back to leads</Link></div>;
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/admin/leads" className="text-sm text-brand-700 hover:underline">← Leads</Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">{data.subject ?? data.reference}</h1>
        <p className="text-xs text-gray-500">{data.reference} · {data.status.replace(/_/g, " ")} · {data.submitter?.name ?? data.submitter?.phone}{data.order_reference ? ` · Order ${data.order_reference}` : ""}</p>
      </div>

      {/* Manage bar — status + assignment (FR-LEAD-012/014), each behind its own gate. */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
        <Can permission="leads.lead.respond">
          <StatusControl reference={reference} status={data.status} />
        </Can>
        <Can permission="leads.lead.assign">
          <AssigneePicker reference={reference} current={data.assigned_admin_id ?? null} />
        </Can>
        {HANDOFF_TYPES.includes(data.type) && (
          <Can allOf={["leads.lead.respond", "orders.exchange.review"]}>
            <button
              type="button"
              onClick={() => setShowHandoff(true)}
              className="ml-auto h-9 rounded-md border border-brand-600 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              Process exchange in Orders
            </button>
          </Can>
        )}
      </div>

      {showHandoff && (
        <LeadClaimHandoff
          reference={reference}
          defaultOrderRef={data.order_reference ?? data.links?.order_reference ?? null}
          onClose={() => setShowHandoff(false)}
        />
      )}

      <ul className="space-y-3">
        {data.messages.map((m, i) => (
          <li key={i} className={"flex " + (m.direction === "outbound" ? "justify-end" : "justify-start")}>
            <div className={"max-w-[80%] rounded-lg px-4 py-2 text-sm " + (m.internal ? "bg-amber-50 text-amber-900" : m.direction === "outbound" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-800")}>
              {m.internal && <p className="text-[11px] font-semibold uppercase">Internal note</p>}
              <p className="whitespace-pre-line break-words">{m.body}</p>
              <p className={"mt-1 text-[11px] " + (m.direction === "outbound" && !m.internal ? "text-white/70" : "text-gray-400")}>{formatDateTime(m.created_at)}</p>
            </div>
          </li>
        ))}
      </ul>

      {data.attachments.length > 0 && <LeadAttachments items={data.attachments} />}

      <Can permission="leads.lead.respond">
        <div className="space-y-3 border-t border-gray-100 pt-4">
          <div className="space-y-1.5">
            <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} rows={3} placeholder="Reply to the customer…" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <button type="button" disabled={!replyBody.trim() || reply.isPending} onClick={() => reply.mutate(replyBody.trim(), { onSuccess: () => { setReplyBody(""); toast("Reply sent."); } })} className="h-9 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">Send reply</button>
          </div>
          <div className="space-y-1.5">
            <input value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Add an internal note…" className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" />
            <button type="button" disabled={!noteBody.trim() || note.isPending} onClick={() => note.mutate(noteBody.trim(), { onSuccess: () => { setNoteBody(""); toast("Note added."); } })} className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Add internal note</button>
          </div>
        </div>
      </Can>
    </div>
  );
}

/** Status `<select>` (FR-LEAD-014). Keeps the current value selectable even if it's `new`. */
function StatusControl({ reference, status }: { reference: string; status: string }) {
  const change = useChangeLeadStatus(reference);
  const known = (STATUS_OPTIONS as readonly string[]).includes(status);
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      <span className="font-medium text-gray-700">Status</span>
      <select
        value={known ? status : ""}
        disabled={change.isPending}
        onChange={(e) =>
          change.mutate(e.target.value, {
            onSuccess: () => toast("Status updated."),
            onError: () => toast("Couldn't update status.", "error"),
          })
        }
        className="h-9 rounded-md border border-gray-300 px-2 text-sm"
      >
        {!known && <option value="">{status.replace(/_/g, " ")}</option>}
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>
    </label>
  );
}

/** Assignee picker (FR-LEAD-012). The active-admins list needs `rbac.admin_user.read`; without it we show the current assignee read-only. */
function AssigneePicker({ reference, current }: { reference: string; current: string | null }) {
  const { can } = usePermissions();
  if (!can("rbac.admin_user.read")) {
    return <span className="text-sm text-gray-500">Assignee: {current ?? "Unassigned"}</span>;
  }
  return <AssigneeSelect reference={reference} current={current} />;
}

function AssigneeSelect({ reference, current }: { reference: string; current: string | null }) {
  const assign = useAssignLead(reference);
  const { data: admins } = useAdminUsers({ status: "active", page: 1, limit: 100 });
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      <span className="font-medium text-gray-700">Assignee</span>
      <select
        value={current ?? ""}
        disabled={assign.isPending}
        onChange={(e) => {
          if (!e.target.value) return;
          assign.mutate(e.target.value, {
            onSuccess: () => toast("Lead assigned."),
            onError: () => toast("Couldn't assign the lead.", "error"),
          });
        }}
        className="h-9 rounded-md border border-gray-300 px-2 text-sm"
      >
        <option value="">Unassigned</option>
        {admins?.data.map((a) => (
          <option key={a.id} value={a.id}>{a.full_name}</option>
        ))}
      </select>
    </label>
  );
}

/** Evidence viewer (FR-LEAD-011): images inline (open full-size on click), others as a download link. */
function LeadAttachments({ items }: { items: LeadAttachment[] }) {
  return (
    <div className="border-t border-gray-100 pt-4">
      <h2 className="mb-2 text-sm font-semibold text-gray-700">Attachments</h2>
      <ul className="flex flex-wrap gap-3">
        {items.map((a) => {
          const isImage = (a.content_type ?? "").startsWith("image/");
          return (
            <li key={a.id}>
              {isImage ? (
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt="Lead attachment" className="h-24 w-24 rounded-md border border-gray-200 object-cover" />
                </a>
              ) : (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-md border border-gray-300 px-3 text-sm font-medium text-brand-700 hover:bg-gray-50"
                >
                  Download attachment
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
