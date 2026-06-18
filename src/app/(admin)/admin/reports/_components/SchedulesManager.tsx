"use client";

import { useState } from "react";
import { CalendarClock, Pencil, Plus, Trash2, User } from "lucide-react";
import { usePermissions } from "@/lib/permissions/usePermissions";
import {
  useDeleteSchedule,
  useSchedules,
  useUpdateSchedule,
} from "@/lib/api/hooks/reports";
import type { Schedule } from "@/lib/api/schemas/reports";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  SkeletonRows,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/stores/toast";
import { getReportMeta, REPORTS_SCHEDULE_PERMISSION } from "./catalog";
import { ScheduleForm } from "./ScheduleForm";
import { ToggleSwitch } from "./ToggleSwitch";

/**
 * Scheduled digests manager (FR-RPT-071) — the MANAGE › Schedules view: report
 * email digests with cadence, recipients, an active toggle, and last-run, plus a
 * create/edit drawer. Re-skinned onto the AD0 `Table` to match prompt #10 + the
 * Exports table chrome (no `.dc.html` was exported for Schedules). Gated on
 * `reports.report.schedule`; data layer untouched (AD4 / admin-redesign README §2).
 */

/** Overlapping recipient avatars + "+N" overflow. */
function RecipientAvatars({ count }: { count: number }) {
  if (count === 0) return <span className="text-text-faint">—</span>;
  const shown = Math.min(count, 3);
  return (
    <span className="inline-flex items-center">
      <span className="flex -space-x-2">
        {Array.from({ length: shown }).map((_, i) => (
          <span
            key={i}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-accent-100 text-accent-700"
            aria-hidden="true"
          >
            <User className="h-3 w-3" />
          </span>
        ))}
      </span>
      {count > shown && (
        <span className="ml-1.5 text-xs font-medium tabular-nums text-text-muted">
          +{count - shown}
        </span>
      )}
      <span className="sr-only">
        {count} recipient{count === 1 ? "" : "s"}
      </span>
    </span>
  );
}

export function SchedulesManager() {
  const { can, ready } = usePermissions();
  const enabled = ready && can(REPORTS_SCHEDULE_PERMISSION);
  const { data, isLoading, isError, refetch } = useSchedules(enabled);
  const update = useUpdateSchedule();
  const del = useDeleteSchedule();

  const [editing, setEditing] = useState<Schedule | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Schedule | null>(null);

  if (ready && !can(REPORTS_SCHEDULE_PERMISSION)) {
    return (
      <Card className="p-0">
        <EmptyState
          icon={CalendarClock}
          title="No access to schedules"
          description="You don’t have permission to manage report schedules."
        />
      </Card>
    );
  }

  const rows = data ?? [];

  async function toggleActive(s: Schedule) {
    try {
      await update.mutateAsync({ id: s.id, body: { is_active: !s.is_active } });
      toast(s.is_active ? "Schedule deactivated." : "Schedule activated.");
    } catch {
      toast("Couldn’t update the schedule.", "error");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast("Schedule deleted.");
      setToDelete(null);
    } catch {
      toast("Couldn’t delete the schedule.", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold leading-7 tracking-tight text-text">
            Report schedules
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-text-muted">
            Digests are emailed to the selected admins on the cadence. Suspended
            admins are skipped.
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          New schedule
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-0">
          <SkeletonRows rows={4} cols={6} />
        </Card>
      ) : isError ? (
        <Card className="p-0">
          <ErrorState
            description="Couldn’t load the schedules."
            onRetry={() => refetch()}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={CalendarClock}
            title="No scheduled digests yet."
            description="Create a schedule to email a report digest on a recurring cadence."
            action={
              <Button
                onClick={() => setCreating(true)}
                leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              >
                New schedule
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table className="min-w-[860px]">
            <caption className="sr-only">Scheduled report digests</caption>
            <THead>
              <TR hover={false}>
                <TH>Report</TH>
                <TH>Params</TH>
                <TH>Cadence</TH>
                <TH>Recipients</TH>
                <TH>Active</TH>
                <TH>Last run</TH>
                <TH className="text-right" />
              </TR>
            </THead>
            <TBody>
              {rows.map((s) => {
                const skipped = s.last_run_skipped_admin_ids?.length ?? 0;
                return (
                  <TR key={s.id}>
                    <TD className="whitespace-nowrap font-semibold text-text">
                      {getReportMeta(s.report_key)?.label ?? s.report_key}
                    </TD>
                    <TD className="whitespace-nowrap tabular-nums text-text-faint">
                      {formatScheduleParams(s.params)}
                    </TD>
                    <TD>
                      <Badge tone="neutral" className="capitalize">
                        {s.cadence}
                      </Badge>
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-2">
                        <RecipientAvatars count={s.recipients_admin_ids.length} />
                        {skipped > 0 && (
                          <Badge tone="warning" className="tabular-nums">
                            {skipped} skipped
                          </Badge>
                        )}
                      </span>
                    </TD>
                    <TD>
                      <ToggleSwitch
                        checked={s.is_active}
                        disabled={update.isPending}
                        onChange={() => toggleActive(s)}
                        label={
                          s.is_active
                            ? "Deactivate schedule"
                            : "Activate schedule"
                        }
                      />
                    </TD>
                    <TD className="whitespace-nowrap tabular-nums text-text-muted">
                      {s.last_run_at ? formatDateTime(s.last_run_at) : "—"}
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="icon"
                          size="sm"
                          aria-label="Edit schedule"
                          onClick={() => setEditing(s)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="icon"
                          size="sm"
                          aria-label="Delete schedule"
                          className="text-error hover:bg-error-50"
                          onClick={() => setToDelete(s)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <div className="border-t border-border px-5 py-3 text-xs tabular-nums text-text-muted">
            {rows.length} schedule{rows.length === 1 ? "" : "s"}
          </div>
        </Card>
      )}

      {creating && <ScheduleForm onClose={() => setCreating(false)} />}
      {editing && (
        <ScheduleForm existing={editing} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={!!toDelete}
        title="Delete schedule"
        message="This stops the recurring digest. This can’t be undone."
        confirmLabel="Delete"
        danger
        pending={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

/** Compact, defensive summary of a schedule's params (range · bucket). */
function formatScheduleParams(params?: Record<string, unknown>): string {
  if (!params) return "—";
  const humanize = (v: unknown) =>
    typeof v === "string"
      ? v.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : null;
  const parts = [
    humanize(params.range ?? params.period),
    humanize(params.bucket ?? params.view),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}
