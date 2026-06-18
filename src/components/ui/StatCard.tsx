import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "./Card";
import { DeltaChip } from "./Badge";
import { Sparkline } from "./Sparkline";

/**
 * StatCard (design-system §8.3) — the hero KPI component. Replaces the bare
 * bordered boxes: eyebrow micro-label + optional icon tile, a display-size
 * value, a delta chip, and an optional sparkline.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  iconTone = "accent",
  delta,
  deltaSuffix,
  spark,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  iconTone?: "accent" | "success" | "warning" | "error" | "info";
  /** Percentage delta vs the prior period; null = "no prior data". */
  delta?: number | null;
  deltaSuffix?: string;
  spark?: number[];
  className?: string;
}) {
  const TONE: Record<string, string> = {
    accent: "bg-accent-50 text-accent-600",
    success: "bg-success-50 text-success",
    warning: "bg-warning-50 text-warning",
    error: "bg-error-50 text-error",
    info: "bg-info-50 text-info",
  };
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-eyebrow uppercase tracking-wide text-text-muted">{label}</p>
        {Icon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
              TONE[iconTone],
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-2 text-display tabular-nums text-text">{value}</p>
      {(delta !== undefined || spark) && (
        <div className="mt-3 flex items-end justify-between gap-2">
          {delta !== undefined && <DeltaChip value={delta} suffix={deltaSuffix} />}
          {spark && spark.length > 1 && <Sparkline data={spark} className="ml-auto" />}
        </div>
      )}
    </Card>
  );
}

/**
 * Alert-counter variant (dashboard alerts strip): compact card, whole card is a
 * deep-link to a pre-filtered list. Zero state shows `0` calmly, not red.
 */
export function AlertCounter({
  label,
  count,
  icon: Icon,
  tone = "warning",
  href,
}: {
  label: string;
  count: number;
  icon?: LucideIcon;
  tone?: "warning" | "error" | "info" | "success";
  href: string;
}) {
  const calm = count === 0;
  const DOT: Record<string, string> = {
    warning: "text-warning",
    error: "text-error",
    info: "text-info",
    success: "text-success",
  };
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm transition-shadow",
        "hover:border-border-strong hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2",
      )}
    >
      {Icon && (
        <Icon
          className={cn("h-5 w-5 shrink-0", calm ? "text-text-faint" : DOT[tone])}
          aria-hidden="true"
        />
      )}
      <div className="min-w-0">
        <p className="text-xl font-bold tabular-nums text-text">{count}</p>
        <p className="truncate text-xs text-text-muted">{label}</p>
      </div>
    </Link>
  );
}
