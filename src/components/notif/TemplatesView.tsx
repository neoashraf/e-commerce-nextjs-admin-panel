"use client";

import { useState } from "react";
import { useTemplates, useCreateTemplate, useUpdateTemplate, type TemplateRow } from "@/lib/api/hooks/useNotif";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";

/**
 * Notification templates (notif-templates-fe). List by event/channel/locale +
 * inline body editor (PATCH creates a new version). Create a new template
 * (event/channel/locale/body); 409 active-exists + 400 bad-placeholder guards.
 * NO_BANGLA_TEMPLATE (422) handled on promotional events.
 */
export function TemplatesView() {
  const { data, isLoading, isError, refetch } = useTemplates({ page: 1, limit: 100 });
  const create = useCreateTemplate();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ event_type: "", channel: "sms", locale: "en", body: "" });
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    if (!form.event_type.trim() || !form.body.trim()) { setError("Event type and body are required."); return; }
    try {
      await create.mutateAsync(form);
      setForm({ event_type: "", channel: "sms", locale: "en", body: "" }); setAdding(false); toast("Template created.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError("An active template already exists for this event/channel/locale.");
      else if (err instanceof ApiError && err.code === "NO_BANGLA_TEMPLATE") setError("Promotional SMS requires a Bangla (bn) template.");
      else if (err instanceof ApiError && err.status === 400) setError("The body references an unknown placeholder.");
      else setError("Couldn't create the template.");
    }
  }

  const inp = "h-9 rounded-md border border-gray-300 px-2 text-sm";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Notification templates</h1>
        <Can permission="notifications.template.create"><button type="button" onClick={() => setAdding((a) => !a)} className="text-sm font-medium text-brand-700 hover:underline">+ New template</button></Can>
      </div>

      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {adding && (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap gap-2">
            <input className={inp + " flex-1"} placeholder="event_type (e.g. order.shipped)" value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} />
            <select className={inp} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}><option value="sms">SMS</option><option value="email">Email</option></select>
            <select className={inp} value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}><option value="en">en</option><option value="bn">bn</option></select>
          </div>
          <textarea className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" rows={3} placeholder="Body with {{placeholders}}" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <button type="button" onClick={add} disabled={create.isPending} className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Create</button>
        </div>
      )}

      {isLoading ? <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        : isError ? <div className="py-12 text-center"><p className="text-sm text-gray-600">Couldn&apos;t load templates.</p><button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button></div>
        : !data || data.length === 0 ? <p className="py-12 text-center text-sm text-gray-500">No templates yet.</p>
        : <ul className="space-y-2">{data.map((t) => <TemplateRowItem key={t.id} template={t} />)}</ul>}
    </div>
  );
}

function TemplateRowItem({ template }: { template: TemplateRow }) {
  const update = useUpdateTemplate(template.id);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(template.body ?? "");

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">{template.event_type}<span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{template.channel} · {template.locale}{template.version ? ` · v${template.version}` : ""}</span></span>
        <Can permission="notifications.template.update"><button type="button" onClick={() => setEditing((e) => !e)} className="text-sm font-medium text-brand-700 hover:underline">{editing ? "Close" : "Edit"}</button></Can>
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          <button type="button" onClick={() => update.mutate({ body }, { onSuccess: () => { setEditing(false); toast("Template updated (new version)."); } })} disabled={update.isPending} className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Save new version</button>
        </div>
      ) : template.body ? <p className="mt-1 whitespace-pre-line break-words text-sm text-gray-600">{template.body}</p> : null}
    </li>
  );
}
