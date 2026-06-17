"use client";

import { rangeError, todayIso } from "../../reports/_components/dates";
import type { DashboardPeriod } from "@/lib/api/hooks/dashboard";
import { Input, SegmentedControl, type SegmentOption } from "@/components/ui";

/**
 * Dashboard period selector — today / 7d / 30d / custom (FR-DASH-003), on the
 * AD0 SegmentedControl. The custom range reveals from/to inputs, validated
 * client-side (from ≤ to, ≤ max span) mirroring the BE before the query runs.
 */
const PRESETS: SegmentOption<string>[] = [
  { value: "today", label: "Today" },
  { value: "last_7d", label: "7d" },
  { value: "last_30d", label: "30d" },
  { value: "custom", label: "Custom" },
];

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
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          ariaLabel="Period"
          options={PRESETS}
          value={value.period}
          onChange={(period) => onChange({ ...value, period })}
        />

        {value.period === "custom" && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-text-muted">
              From
              <Input
                type="date"
                className="w-auto"
                aria-label="From date"
                value={value.from ?? ""}
                max={value.to ?? todayIso()}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-text-muted">
              To
              <Input
                type="date"
                className="w-auto"
                aria-label="To date"
                value={value.to ?? ""}
                min={value.from}
                max={todayIso()}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
              />
            </label>
          </div>
        )}
      </div>
      {dateErr && (
        <p role="alert" className="text-sm text-error">
          {dateErr}
        </p>
      )}
    </div>
  );
}
