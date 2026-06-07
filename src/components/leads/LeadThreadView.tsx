"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminLead, useReplyLead, useAddInternalNote } from "@/lib/api/hooks/useLeadsAdmin";
import { Can } from "@/lib/permissions/Can";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/stores/toast";

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
