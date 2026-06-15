"use client";

import { useState } from "react";
import { usePermissions } from "@/lib/permissions/usePermissions";
import {
  useDeleteSchedule,
  useSchedules,
  useUpdateSchedule,
} from "@/lib/api/hooks/reports";
import type { Schedule } from "@/lib/api/schemas/reports";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/stores/toast";
import { getReportMeta, REPORTS_SCHEDULE_PERMISSION } from "./catalog";
import { ScheduleForm } from "./ScheduleForm";

/**
 * Scheduled digests manager (FR-RPT-071) — list with cadence/recipients/active/
 * last-run, create/edit (drawer), activate/deactivate toggle, and delete.
 * Recipients skipped on the last run (suspended) are flagged. Gated on
 * `reports.report.schedule`.
 */
export function SchedulesManager() {
  const { can, ready } = usePermissions();
  const enabled = ready && can(REPORTS_SCHEDULE_PERMISSION);
  const { data, isLoading, isError } = useSchedules(enabled);
  const update = useUpdateSchedule();
  const del = useDeleteSchedule();

  const [editing, setEditing] = useState<Schedule | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Schedule | null>(null);

  if (ready && !can(REPORTS_SCHEDULE_PERMISSION)) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-600">
          You don&apos;t have permission to manage report schedules.
        </p>
      </div>
    );
  }

  const rows = data ?? [];

  async function toggleActive(s: Schedule) {
    try {
      await update.mutateAsync({ id: s.id, body: { is_active: !s.is_active } });
      toast(s.is_active ? "Schedule deactivated." : "Schedule activated.");
    } catch {
      toast("Couldn't update the schedule.", "error");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast("Schedule deleted.");
      setToDelete(null);
    } catch {
      toast("Couldn't delete the schedule.", "error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Report schedules</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Recurring email digests, delivered via notifications on the cadence.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="h-10 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          New schedule
        </button>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">Couldn&apos;t load the schedules.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-sm text-gray-500">No scheduled digests yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th scope="col" className="px-3 py-2 font-medium">Report</th>
                <th scope="col" className="px-3 py-2 font-medium">Cadence</th>
                <th scope="col" className="px-3 py-2 font-medium">Recipients</th>
                <th scope="col" className="px-3 py-2 font-medium">Active</th>
                <th scope="col" className="px-3 py-2 font-medium">Last run</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const skipped = s.last_run_skipped_admin_ids?.length ?? 0;
                return (
                  <tr key={s.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2 text-gray-900">
                      {getReportMeta(s.report_key)?.label ?? s.report_key}
                    </td>
                    <td className="px-3 py-2 capitalize text-gray-700">{s.cadence}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {s.recipients_admin_ids.length}
                      {skipped > 0 && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                          {skipped} skipped
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-xs font-medium " +
                          (s.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600")
                        }
                      >
                        {s.is_active ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {s.last_run_at ? formatDateTime(s.last_run_at) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => toggleActive(s)}
                          disabled={update.isPending}
                          className="text-xs font-medium text-gray-600 hover:underline disabled:opacity-50"
                        >
                          {s.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(s)}
                          className="text-xs font-medium text-brand-700 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setToDelete(s)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && <ScheduleForm onClose={() => setCreating(false)} />}
      {editing && <ScheduleForm existing={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!toDelete}
        title="Delete schedule"
        message="This stops the recurring digest. This can't be undone."
        confirmLabel="Delete"
        danger
        pending={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
