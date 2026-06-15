"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAdminUsers } from "@/lib/api/hooks/useAdminUsers";
import {
  useCreateSchedule,
  useUpdateSchedule,
  type ScheduleInput,
} from "@/lib/api/hooks/reports";
import {
  REPORT_KEYS,
  SCHEDULE_CADENCES,
  type Schedule,
  type ScheduleCadence,
} from "@/lib/api/schemas/reports";
import { toast } from "@/lib/stores/toast";
import { getReportMeta } from "./catalog";

/**
 * Create / edit a scheduled report digest (FR-RPT-071) in a modal dialog.
 * Report + cadence + ≥1 active recipient required; the rolling params template
 * captures range + bucket. Suspended recipients are flagged (they're skipped at
 * send). Server-confirmed via POST/PATCH.
 */
const inp =
  "h-10 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

const RANGES = [
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "today", label: "Today" },
];
const BUCKETS = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

export function ScheduleForm({
  existing,
  onClose,
}: {
  existing?: Schedule;
  onClose: () => void;
}) {
  const create = useCreateSchedule();
  const update = useUpdateSchedule();
  const { data: admins } = useAdminUsers({ status: "active" });
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  const [reportKey, setReportKey] = useState<string>(existing?.report_key ?? "sales");
  const [range, setRange] = useState<string>(
    (existing?.params?.range as string) ?? "last_7d",
  );
  const [bucket, setBucket] = useState<string>(
    (existing?.params?.bucket as string) ?? "day",
  );
  const [cadence, setCadence] = useState<ScheduleCadence>(existing?.cadence ?? "weekly");
  const [recipients, setRecipients] = useState<string[]>(
    existing?.recipients_admin_ids ?? [],
  );
  const [isActive, setIsActive] = useState<boolean>(existing?.is_active ?? true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    prevFocus.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLElement>("select,input,button")?.focus(),
    );
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      prevFocus.current?.focus?.();
    };
  }, [onClose]);

  const activeAdmins = useMemo(() => admins ?? [], [admins]);
  const recipientsError =
    submitted && recipients.length === 0 ? "Add at least one recipient." : null;

  const pending = create.isPending || update.isPending;

  function toggleRecipient(id: string) {
    setRecipients((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  async function onSave() {
    setSubmitted(true);
    if (recipients.length === 0) return;
    const body: ScheduleInput = {
      report_key: reportKey,
      params: { range, bucket },
      cadence,
      recipients_admin_ids: recipients,
      is_active: isActive,
    };
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, body });
        toast("Schedule updated.");
      } else {
        await create.mutateAsync(body);
        toast("Schedule created.");
      }
      onClose();
    } catch {
      toast("Couldn't save the schedule. Try again.", "error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
      >
        <h2 id={titleId} className="text-base font-semibold text-gray-900">
          {existing ? "Edit schedule" : "New schedule"}
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Digests are emailed to the selected admins on the cadence. Suspended admins are skipped.
        </p>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-900">Report</span>
            <select className={inp} value={reportKey} onChange={(e) => setReportKey(e.target.value)}>
              {REPORT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {getReportMeta(k)?.label ?? k}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-900">Range</span>
              <select className={inp} value={range} onChange={(e) => setRange(e.target.value)}>
                {RANGES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-900">Bucket</span>
              <select className={inp} value={bucket} onChange={(e) => setBucket(e.target.value)}>
                {BUCKETS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-900">Cadence</span>
            <select
              className={inp}
              value={cadence}
              onChange={(e) => setCadence(e.target.value as ScheduleCadence)}
            >
              {SCHEDULE_CADENCES.map((c) => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-gray-900">Recipients</legend>
            <div
              className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-gray-300 p-2"
              aria-describedby={recipientsError ? "recipients-err" : undefined}
            >
              {activeAdmins.length === 0 ? (
                <p className="p-1 text-xs text-gray-400">No active admins available.</p>
              ) : (
                activeAdmins.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={recipients.includes(a.id)}
                      onChange={() => toggleRecipient(a.id)}
                    />
                    <span className="text-gray-700">{a.full_name}</span>
                    <span className="text-xs text-gray-400">{a.email}</span>
                  </label>
                ))
              )}
            </div>
            {recipientsError && (
              <span id="recipients-err" role="alert" className="mt-1 block text-xs text-red-600">
                {recipientsError}
              </span>
            )}
          </fieldset>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active (run on the cadence)
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            aria-busy={pending}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
