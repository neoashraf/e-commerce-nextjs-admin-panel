"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input, SegmentedControl, Select } from "@/components/ui";
import type { ReportMeta } from "./catalog";
import { isoDaysAgo, rangeError, todayIso } from "./dates";

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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {showRange && (
          <>
            <label className="flex items-center gap-1.5 text-sm text-text-muted">
              From
              <Input
                type="date"
                className="w-auto"
                aria-label="From date"
                value={from}
                max={to}
                onChange={(e) => setParam("from", e.target.value)}
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-text-muted">
              To
              <Input
                type="date"
                className="w-auto"
                aria-label="To date"
                value={to}
                min={from}
                max={todayIso()}
                onChange={(e) => setParam("to", e.target.value)}
              />
            </label>
          </>
        )}

        {meta.hasBucket && (
          <SegmentedControl
            ariaLabel="Bucket"
            value={bucket}
            onChange={(v) => setParam("bucket", v)}
            options={[
              { value: "day", label: "Daily" },
              { value: "week", label: "Weekly" },
              { value: "month", label: "Monthly" },
            ]}
          />
        )}

        {meta.breakdowns && (
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
        )}

        {meta.views && (
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
        )}

        {meta.metrics && (
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
        )}

        {meta.hasTopN && (
          <label className="flex items-center gap-1.5 text-sm text-text-muted">
            Top
            <Input
              type="number"
              min={1}
              max={100}
              className="w-20"
              aria-label="Top N"
              value={topN}
              onChange={(e) => setParam("top_n", e.target.value)}
            />
          </label>
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
