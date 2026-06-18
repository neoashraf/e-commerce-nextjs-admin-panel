"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
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
import { Button, Drawer, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/stores/toast";
import { getReportMeta } from "./catalog";
import { ToggleSwitch } from "./ToggleSwitch";

/**
 * Create / edit a scheduled report digest (FR-RPT-071/072) in the AD0 `Drawer`
 * (right slide-over, focus-trapped, scrim, unsaved guard). Report + cadence + ≥1
 * recipient required; the rolling params template captures range + bucket.
 * Recipients are picked from the active admins; a selected recipient who is no
 * longer active is flagged "will be skipped — suspended". Server-confirmed via
 * POST/PATCH. Data layer untouched (AD4 / admin-redesign README §2).
 */

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

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1.5 block text-sm font-medium text-text">{label}</span>
      {children}
    </label>
  );
}

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

  const [reportKey, setReportKey] = useState<string>(
    existing?.report_key ?? "sales",
  );
  const [range, setRange] = useState<string>(
    (existing?.params?.range as string) ?? "last_7d",
  );
  const [bucket, setBucket] = useState<string>(
    (existing?.params?.bucket as string) ?? "day",
  );
  const [cadence, setCadence] = useState<ScheduleCadence>(
    existing?.cadence ?? "weekly",
  );
  const [recipients, setRecipients] = useState<string[]>(
    existing?.recipients_admin_ids ?? [],
  );
  const [isActive, setIsActive] = useState<boolean>(existing?.is_active ?? true);
  const [submitted, setSubmitted] = useState(false);
  const [dirty, setDirty] = useState(false);

  const activeAdmins = useMemo(() => admins ?? [], [admins]);
  const adminsLoaded = admins !== undefined;
  const recipientsError =
    submitted && recipients.length === 0 ? "Add at least one recipient." : null;
  const pending = create.isPending || update.isPending;

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  function toggleRecipient(id: string) {
    markDirty();
    setRecipients((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  function handleClose() {
    if (pending) return;
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    onClose();
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
      toast("Couldn’t save the schedule. Try again.", "error");
    }
  }

  return (
    <Drawer
      open
      onClose={handleClose}
      title={existing ? "Edit schedule" : "New schedule"}
      subtitle="Digests are emailed to the selected admins on the cadence. Suspended admins are skipped."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={pending} disabled={pending}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Report">
          <Select
            value={reportKey}
            onChange={(e) => {
              markDirty();
              setReportKey(e.target.value);
            }}
          >
            {REPORT_KEYS.map((k) => (
              <option key={k} value={k}>
                {getReportMeta(k)?.label ?? k}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Range">
            <Select
              value={range}
              onChange={(e) => {
                markDirty();
                setRange(e.target.value);
              }}
            >
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bucket">
            <Select
              value={bucket}
              onChange={(e) => {
                markDirty();
                setBucket(e.target.value);
              }}
            >
              {BUCKETS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Cadence">
          <Select
            value={cadence}
            onChange={(e) => {
              markDirty();
              setCadence(e.target.value as ScheduleCadence);
            }}
          >
            {SCHEDULE_CADENCES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </Select>
        </Field>

        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-text">
            Recipients
          </legend>

          {recipients.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {recipients.map((id) => {
                const admin = activeAdmins.find((a) => a.id === id);
                const suspended = adminsLoaded && !admin;
                return (
                  <span
                    key={id}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
                      suspended
                        ? "bg-warning-50 text-warning"
                        : "bg-accent-50 text-accent-700",
                    )}
                  >
                    {suspended && (
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    )}
                    {suspended
                      ? "Suspended — will be skipped"
                      : (admin?.full_name ?? "…")}
                    <button
                      type="button"
                      onClick={() => toggleRecipient(id)}
                      aria-label={`Remove ${admin?.full_name ?? "recipient"}`}
                      className="-mr-0.5 ml-0.5 rounded-sm hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div
            className="max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-border-strong p-1.5"
            aria-describedby={recipientsError ? "recipients-err" : undefined}
          >
            {activeAdmins.length === 0 ? (
              <p className="p-1.5 text-xs text-text-faint">
                No active admins available.
              </p>
            ) : (
              activeAdmins.map((a) => {
                const checked = recipients.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-surface-hover"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRecipient(a.id)}
                      className="h-4 w-4 rounded border-border-strong text-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                    />
                    <span className="text-text">{a.full_name}</span>
                    <span className="truncate text-xs text-text-faint">
                      {a.email}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          {recipientsError && (
            <span
              id="recipients-err"
              role="alert"
              className="mt-1.5 block text-xs text-error"
            >
              {recipientsError}
            </span>
          )}
        </fieldset>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            <span className="block text-sm font-medium text-text">Active</span>
            <span className="text-xs text-text-muted">
              Run this digest on the cadence.
            </span>
          </div>
          <ToggleSwitch
            checked={isActive}
            onChange={() => {
              markDirty();
              setIsActive((v) => !v);
            }}
            label="Active"
          />
        </div>
      </div>
    </Drawer>
  );
}
