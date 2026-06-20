"use client";

import Link from "next/link";
import { useState } from "react";
import { useTemplates, useCreateTemplate, useUpdateTemplate, type TemplateRow } from "@/lib/api/hooks/useNotif";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
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

/**
 * Notification templates (notif-templates-fe) on the AD6 Data Table primitive
 * (design-system §8.6): Card-wrapped table (event/channel/locale/version/status)
 * with an inline body editor that expands as a full-width row beneath the
 * template (PATCH creates a new version). No pagination — the templates endpoint
 * returns a small bounded set with no page/limit/total. Create a new template
 * (event/channel/locale/body); 409 active-exists + 400 bad-placeholder +
 * NO_BANGLA_TEMPLATE (422) guards.
 */
const TEXTAREA = "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1";

export function TemplatesView() {
  const { data, isLoading, isError, refetch } = useTemplates({});
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold leading-7 text-text">Notification templates</h1>
        <div className="flex items-center gap-4">
          {/* New campaign — hidden per product (kept for re-enable).
          <Can permission="notifications.campaign.send"><Link href="/admin/notifications/campaigns/new" className="text-sm font-medium text-accent-700 hover:underline">New campaign</Link></Can>
          */}
          <Can permission="notifications.template.create"><Button variant="primary" onClick={() => setAdding((a) => !a)}>{adding ? "Close" : "New template"}</Button></Can>
        </div>
      </div>

      {error && <p role="alert" className="rounded-md bg-error-50 px-3 py-2 text-sm text-error">{error}</p>}

      {adding && (
        <Card className="space-y-2 p-4">
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[16rem] flex-1">
              <Input placeholder="event_type (e.g. order.shipped)" aria-label="Event type" value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} />
            </div>
            <div className="w-32">
              <Select aria-label="Channel" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}><option value="sms">SMS</option><option value="email">Email</option></Select>
            </div>
            <div className="w-28">
              <Select aria-label="Locale" value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}><option value="en">en</option><option value="bn">bn</option></Select>
            </div>
          </div>
          <textarea className={TEXTAREA} rows={3} placeholder="Body with {{placeholders}}" aria-label="Template body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <Button variant="primary" onClick={add} loading={create.isPending}>Create</Button>
        </Card>
      )}

      <Card>
        {isLoading ? (
          <SkeletonRows rows={8} cols={6} />
        ) : isError ? (
          <ErrorState description="Couldn't load templates." onRetry={() => refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No templates yet." description="Create your first notification template." />
        ) : (
          <Table>
            <THead>
              <TR hover={false}>
                <TH>Event</TH>
                <TH>Channel</TH>
                <TH>Locale</TH>
                <TH>Version</TH>
                <TH>Status</TH>
                <TH className="text-right"><span className="sr-only">Actions</span></TH>
              </TR>
            </THead>
            <TBody>
              {data.map((t) => <TemplateRowItem key={t.id} template={t} />)}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function TemplateRowItem({ template }: { template: TemplateRow }) {
  const update = useUpdateTemplate(template.id);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(template.body ?? "");

  return (
    <>
      <TR hover={!editing}>
        <TD className="font-medium text-text">{template.event_type}</TD>
        <TD><Badge tone="neutral">{template.channel}</Badge></TD>
        <TD>{template.locale ?? "—"}</TD>
        <TD>{template.version ? `v${template.version}` : "—"}</TD>
        <TD><StatusPill status={template.is_active ? "active" : "inactive"} /></TD>
        <TD className="text-right">
          <Can permission="notifications.template.update">
            <button type="button" onClick={() => setEditing((e) => !e)} className="text-sm font-medium text-accent-700 hover:underline">{editing ? "Close" : "Edit"}</button>
          </Can>
        </TD>
      </TR>
      {editing && (
        <TR hover={false}>
          <TD colSpan={6} className="bg-surface-subtle">
            <div className="space-y-2">
              <textarea className={TEXTAREA} rows={3} aria-label={`Body for ${template.event_type}`} value={body} onChange={(e) => setBody(e.target.value)} />
              <Button variant="primary" loading={update.isPending} onClick={() => update.mutate({ body }, { onSuccess: () => { setEditing(false); toast("Template updated (new version)."); } })}>Save new version</Button>
            </div>
          </TD>
        </TR>
      )}
    </>
  );
}
