"use client";

import { rangeError, todayIso } from "../../reports/_components/dates";
import type { DashboardPeriod } from "@/lib/api/hooks/dashboard";

/**
 * Dashboard period selector — today / 7d / 30d / custom (FR-DASH-003). The
 * custom range reveals from/to inputs, validated client-side (from ≤ to, ≤ max
 * span) mirroring the BE before the query runs.
 */
const PRESETS = [
  { value: "today", label: "Today" },
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];

const inp =
  "h-10 rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

export function PeriodSelector({
  value,
  onChange,
}: {
  value: DashboardPeriod;
  onChange: (p: DashboardPeriod) => void;
}) {
  const dateErr =
    value.period === "custom" && value.from && value.to
      ? rangeError(value.from, value.to)
      : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <select
          aria-label="Period"
          className={inp}
          value={value.period}
          onChange={(e) => onChange({ ...value, period: e.target.value })}
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {value.period === "custom" && (
          <>
            <label className="text-sm text-gray-600">
              From
              <input
                type="date"
                className={inp + " ml-1"}
                value={value.from ?? ""}
                max={value.to ?? todayIso()}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
              />
            </label>
            <label className="text-sm text-gray-600">
              To
              <input
                type="date"
                className={inp + " ml-1"}
                value={value.to ?? ""}
                min={value.from}
                max={todayIso()}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
              />
            </label>
          </>
        )}
      </div>
      {dateErr && (
        <p role="alert" className="text-sm text-red-600">
          {dateErr}
        </p>
      )}
    </div>
  );
}
