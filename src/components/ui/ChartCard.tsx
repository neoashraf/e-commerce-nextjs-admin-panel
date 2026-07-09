"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardHeader } from "./Card";
import { Skeleton } from "./Skeleton";
import { ErrorState, EmptyState } from "./EmptyState";

/**
 * Chart card (design-system §8.5) — a Card wrapping a Recharts chart, a legend
 * row (text chips + color dots), and a "Show data" affordance that reveals the
 * accessible data table (the table IS the chart's a11y equivalent, §10).
 * Handles the four async states.
 */
export interface LegendItem {
  label: string;
  color: string;
  value?: string;
}

export type ChartState = "loaded" | "loading" | "empty" | "error";

export function ChartCard({
  title,
  subtitle,
  action,
  legend,
  state = "loaded",
  height = 280,
  onRetry,
  emptyMessage = "No data for this period.",
  dataTable,
  children,
  className,
}: {
  title: React.ReactNode;
  /** Optional caption under the title (design-system §8.5 — e.g. "Net revenue (৳) and orders · weekly"). */
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  legend?: LegendItem[];
  state?: ChartState;
  height?: number;
  onRetry?: () => void;
  emptyMessage?: string;
  /** The accessible data-table equivalent, revealed by "Show data". */
  dataTable?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const [showData, setShowData] = useState(false);
  const panelId = useId();

  // When a subtitle is given, render the title + caption as a stacked block so
  // the CardHeader's flex row keeps the title-left / action-right layout.
  const heading = subtitle ? (
    <span className="flex flex-col gap-0.5">
      <span>{title}</span>
      <span className="text-xs font-normal text-text-muted">{subtitle}</span>
    </span>
  ) : (
    title
  );

  return (
    <Card className={className}>
      <CardHeader title={heading} action={action} />
      <div className="px-5 pb-5">
        {state === "loading" && (
          <Skeleton className="w-full" style={{ height }} />
        )}
        {state === "error" && (
          <ErrorState description="Couldn't load this chart." onRetry={onRetry} />
        )}
        {state === "empty" && (
          <div
            className="flex items-center justify-center"
            style={{ height }}
          >
            <EmptyState title={emptyMessage} />
          </div>
        )}
        {state === "loaded" && (
          <>
            {children}
            {legend && legend.length > 0 && (
              <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
                {legend.map((item) => (
                  <li
                    key={item.label}
                    className="inline-flex items-center gap-1.5 text-xs text-text-secondary"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    />
                    {item.label}
                    {item.value && (
                      <span className="font-medium tabular-nums text-text">
                        {item.value}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {dataTable && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowData((v) => !v)}
                  aria-expanded={showData}
                  aria-controls={panelId}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent-700 hover:text-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 rounded-sm"
                >
                  {showData ? "Hide data" : "Show data"}
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      showData && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
                {showData && (
                  <div id={panelId} className="mt-3 overflow-x-auto">
                    {dataTable}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
