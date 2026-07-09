"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { Input, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { ReportMeta } from "./catalog";
import { isoDaysAgo, rangeError, todayIso } from "./dates";
import { useReportAsOf } from "./ReportAsOfContext";

/** Uppercase eyebrow label for a control group (design C2 controls row). */
function ControlLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-eyebrow uppercase tracking-wide text-text-muted">
      {children}
    </span>
  );
}

/** Thin vertical divider between control groups (design C2). */
function Divider() {
  return <span className="h-6 w-px shrink-0 bg-border" aria-hidden="true" />;
}

/**
 * Compact date control matching the design's bordered date "button" (C2): a
 * 36px field sized to its content (not full-width) with a trailing calendar
 * glyph, so From/To sit inline on one row instead of stacking. The shared
 * `Input` always wraps itself in a `w-full` div, which forced the date fields to
 * span the row and wrap; this renders a self-contained, content-width control.
 */
function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative inline-flex items-center">
      <input
        type="date"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 rounded-md border border-border-strong bg-surface pl-3 pr-9 text-sm tabular-nums text-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1",
          // Hide the native calendar picker indicator; we render our own glyph
          // so every browser reads identically to the design.
          "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-9 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0",
        )}
      />
      <Calendar
        className="pointer-events-none absolute right-2.5 h-4 w-4 text-text-faint"
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Report controls — period (from/to), bucket, breakdown, view, metric, top_n.
 * Which controls render is driven by the report's catalog meta. State is
 * URL-reflected (shareable + back-button friendly) per the FE state rules;
 * defaults are applied in `useReportParams` so the URL stays clean until changed.
 * Re-skinned to the design-system inputs/segmented control (presentation only).
 */

/** Reads the effective report params from the URL, applying per-report defaults. */
export function useReportParams(meta: ReportMeta) {
  const sp = useSearchParams();

  const from = sp.get("from") ?? isoDaysAgo(30);
  const to = sp.get("to") ?? todayIso();
  const bucket = sp.get("bucket") ?? "day";
  const breakdown = sp.get("breakdown") ?? meta.breakdowns?.[0]?.value ?? "none";
  const view = sp.get("view") ?? meta.views?.[0]?.value ?? "";
  const metric = sp.get("metric") ?? meta.metrics?.[0]?.value ?? "";
  const topN = sp.get("top_n") ?? "10";

  /** Build the API params object for the hooks (only what this report uses). */
  const apiParams: Record<string, string> = {};
  if (meta.hasPeriod) {
    apiParams.from = from;
    apiParams.to = to;
  }
  if (meta.hasBucket) apiParams.bucket = bucket;
  if (meta.breakdowns) apiParams.breakdown = breakdown;
  if (meta.views) apiParams.view = view;
  if (meta.metrics) apiParams.metric = metric;
  if (meta.hasTopN) apiParams.top_n = topN;
  // Inventory `movement` view also needs a range.
  if (!meta.hasPeriod && view === "movement") {
    apiParams.from = from;
    apiParams.to = to;
  }

  return { from, to, bucket, breakdown, view, metric, topN, apiParams };
}

export function ReportControls({ meta }: { meta: ReportMeta }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { from, to, bucket, breakdown, view, metric, topN } =
    useReportParams(meta);
  const asOf = useReportAsOf();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(sp.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, sp],
  );

  // Period applies to period reports, or to inventory's movement view.
  const showRange = meta.hasPeriod || view === "movement";
  const dateErr = showRange ? rangeError(from, to) : null;

  // Whether a divider is needed between the date group and the selectors that
  // follow it (bucket / breakdown / view / metric / top-N) — design C2.
  const hasSelectors =
    meta.hasBucket ||
    !!meta.breakdowns ||
    !!meta.views ||
    !!meta.metrics ||
    !!meta.hasTopN;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {showRange && (
          <div className="flex items-center gap-2.5">
            <ControlLabel>From</ControlLabel>
            <DateField
              label="From date"
              value={from}
              max={to}
              onChange={(v) => setParam("from", v)}
            />
            <span className="text-sm text-text-muted">–</span>
            <ControlLabel>To</ControlLabel>
            <DateField
              label="To date"
              value={to}
              min={from}
              max={todayIso()}
              onChange={(v) => setParam("to", v)}
            />
          </div>
        )}

        {showRange && hasSelectors && <Divider />}

        {meta.hasBucket && (
          <div className="flex items-center gap-2.5">
            <ControlLabel>Bucket</ControlLabel>
            <div className="w-32">
              <Select
                aria-label="Bucket"
                value={bucket}
                onChange={(e) => setParam("bucket", e.target.value)}
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </Select>
            </div>
          </div>
        )}

        {meta.breakdowns && (
          <div className="flex items-center gap-2.5">
            <ControlLabel>Breakdown</ControlLabel>
            <div className="w-44">
              <Select
                aria-label="Breakdown"
                value={breakdown}
                onChange={(e) => setParam("breakdown", e.target.value)}
              >
                {meta.breakdowns.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {meta.views && (
          <div className="flex items-center gap-2.5">
            <ControlLabel>View</ControlLabel>
            <div className="w-44">
              <Select
                aria-label="View"
                value={view}
                onChange={(e) => setParam("view", e.target.value)}
              >
                {meta.views.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {meta.metrics && (
          <div className="flex items-center gap-2.5">
            <ControlLabel>Metric</ControlLabel>
            <div className="w-36">
              <Select
                aria-label="Metric"
                value={metric}
                onChange={(e) => setParam("metric", e.target.value)}
              >
                {meta.metrics.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {meta.hasTopN && (
          <div className="flex items-center gap-2.5">
            <ControlLabel>Top</ControlLabel>
            <Input
              type="number"
              min={1}
              max={100}
              className="w-20"
              aria-label="Top N"
              value={topN}
              onChange={(e) => setParam("top_n", e.target.value)}
            />
          </div>
        )}

        {asOf && (
          <span
            aria-live="polite"
            className="ml-auto whitespace-nowrap text-xs tabular-nums text-text-muted"
          >
            as of {formatDateTime(asOf)}
          </span>
        )}
      </div>

      {meta.controlsHelper && (
        <p className="text-xs text-text-muted">{meta.controlsHelper}</p>
      )}

      {dateErr && (
        <p role="alert" className="text-sm text-error">
          {dateErr}
        </p>
      )}
    </div>
  );
}
