"use client";

import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { useTemplates } from "@/lib/api/hooks/useNotif";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";

/**
 * Promotional campaign flow (notif-campaign-fe). Stepped: pick a promotional
 * template (block on missing bn) → recipient set → dry-run eligibility summary
 * (eligible / suppressed-by-reason / estimated segments) → confirm & send →
 * route to the filtered delivery log. Endpoint paths confirmed against
 * notif-promotional-be (flagged).
 */
const dryRunSchema = z.object({
  eligible: z.number().default(0),
  suppressed: z.record(z.number()).default({}),
  estimated_segments: z.number().optional(),
});
type DryRun = z.infer<typeof dryRunSchema>;

const RECIPIENT_SETS = [
  { value: "all_opted_in", label: "All promo-opted-in customers" },
  { value: "recent_buyers", label: "Bought in last 30 days" },
  { value: "inactive", label: "No order in 90 days" },
];

export function CampaignView() {
  const router = useRouter();
  const { data: templates } = useTemplates({ channel: "sms", page: 1, limit: 100 });
  const [templateId, setTemplateId] = useState("");
  const [recipientSet, setRecipientSet] = useState(RECIPIENT_SETS[0].value);
  const [dry, setDry] = useState<DryRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dryRun = useMutation({
    mutationFn: (body: { template_id: string; recipient_set: string }): Promise<DryRun> =>
      api.post("/admin/campaigns/dry-run", body, { schema: dryRunSchema }) as Promise<DryRun>,
  });
  const send = useMutation({
    mutationFn: (body: { template_id: string; recipient_set: string }) => api.post("/admin/campaigns", body),
  });

  async function onDryRun() {
    setError(null);
    if (!templateId) { setError("Choose a template."); return; }
    try { setDry(await dryRun.mutateAsync({ template_id: templateId, recipient_set: recipientSet })); }
    catch (err) {
      if (err instanceof ApiError && err.code === "NO_BANGLA_TEMPLATE") setError("A Bangla (bn) template is required for promotional SMS.");
      else setError("Couldn't estimate the audience. Try again.");
    }
  }
  async function onSend() {
    try {
      await send.mutateAsync({ template_id: templateId, recipient_set: recipientSet });
      toast("Campaign queued for sending.");
      router.push("/admin/notifications/log");
    } catch { toast("Couldn't send the campaign.", "error"); }
  }

  const inp = "h-11 w-full rounded-md border border-gray-300 px-3 text-sm";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/notifications" className="text-sm text-brand-700 hover:underline">← Templates</Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">New campaign</h1>
      </div>

      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">1. Template &amp; audience</h2>
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Promotional template (SMS)</span>
          <select className={inp} value={templateId} onChange={(e) => { setTemplateId(e.target.value); setDry(null); }}>
            <option value="">Choose a template…</option>
            {templates?.map((t) => <option key={t.id} value={t.id}>{t.event_type} · {t.locale}</option>)}
          </select>
        </label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-900">Recipient set</span>
          <select className={inp} value={recipientSet} onChange={(e) => { setRecipientSet(e.target.value); setDry(null); }}>
            {RECIPIENT_SETS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={onDryRun} disabled={!templateId || dryRun.isPending} className="inline-flex h-10 items-center rounded-md border border-gray-300 px-5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">{dryRun.isPending ? "Estimating…" : "Estimate audience"}</button>
      </section>

      {dry && (
        <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">2. Eligibility</h2>
          <p className="text-sm text-gray-700">Eligible recipients: <strong>{dry.eligible}</strong>{dry.estimated_segments != null ? ` · est. ${dry.estimated_segments} SMS segments` : ""}</p>
          {Object.keys(dry.suppressed).length > 0 && (
            <ul className="text-sm text-gray-500">
              {Object.entries(dry.suppressed).map(([reason, n]) => <li key={reason}>Suppressed ({reason.replace(/_/g, " ")}): {n}</li>)}
            </ul>
          )}
          <button type="button" onClick={onSend} disabled={dry.eligible === 0 || send.isPending} className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{send.isPending ? "Sending…" : `Send to ${dry.eligible} recipients`}</button>
        </section>
      )}
    </div>
  );
}
