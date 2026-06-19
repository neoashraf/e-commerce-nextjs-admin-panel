import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Badges, status pills, and delta chips (design-system §8.7). Meaning is always
 * carried by text + a dot/arrow, never color alone.
 */

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "error" | "info";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-surface-subtle text-text-secondary",
  accent: "bg-accent-50 text-accent-700",
  success: "bg-success-50 text-success",
  warning: "bg-warning-50 text-warning",
  error: "bg-error-50 text-error",
  info: "bg-info-50 text-info",
};

/** Count / info badge. */
export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium tabular-nums",
        BADGE_TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Canonical status → tone + dot color map (design-system §3.4). The same status
 * reads identically in the pill, the donut, and the legend.
 */
const STATUS_MAP: Record<string, { tone: BadgeTone; dot: string }> = {
  pending: { tone: "warning", dot: "#D97706" },
  processing: { tone: "warning", dot: "#D97706" },
  confirmed: { tone: "accent", dot: "#4F46E5" },
  shipped: { tone: "info", dot: "#06B6D4" },
  delivered: { tone: "success", dot: "#16A34A" },
  completed: { tone: "success", dot: "#16A34A" },
  paid: { tone: "success", dot: "#16A34A" },
  active: { tone: "success", dot: "#16A34A" },
  "in-stock": { tone: "success", dot: "#16A34A" },
  cancelled: { tone: "neutral", dot: "#64748B" },
  // Catalog product lifecycle (CAT).
  draft: { tone: "neutral", dot: "#64748B" },
  published: { tone: "success", dot: "#16A34A" },
  archived: { tone: "warning", dot: "#D97706" },
  refunded: { tone: "neutral", dot: "#8B5CF6" },
  failed: { tone: "error", dot: "#DC2626" },
  "out-of-stock": { tone: "error", dot: "#DC2626" },
  "low-stock": { tone: "warning", dot: "#D97706" },
  // Lead inbox statuses (LEAD).
  new: { tone: "info", dot: "#06B6D4" },
  open: { tone: "success", dot: "#16A34A" },
  "awaiting-customer": { tone: "warning", dot: "#D97706" },
  resolved: { tone: "neutral", dot: "#64748B" },
  closed: { tone: "neutral", dot: "#64748B" },
  // Admin-user lifecycle (RBAC).
  suspended: { tone: "warning", dot: "#D97706" },
  deleted: { tone: "neutral", dot: "#64748B" },
};

function humanize(status: string): string {
  return status
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Status pill: semantic-50 bg + 600 text + a leading dot. `status` is matched
 * case-insensitively against the canonical map; unknown statuses fall back to
 * neutral. Pass `label` to override the displayed text.
 */
export function StatusPill({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const key = status.toLowerCase().replace(/[_\s]+/g, "-");
  const entry = STATUS_MAP[key] ?? STATUS_MAP[status.toLowerCase()] ?? {
    tone: "neutral" as BadgeTone,
    dot: "#64748B",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        BADGE_TONE[entry.tone],
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: entry.dot }}
        aria-hidden="true"
      />
      {label ?? humanize(status)}
    </span>
  );
}

/**
 * Delta chip: pairs an arrow + signed % + color (design-system §8.3). `value` is
 * a percentage; `null`/`undefined` renders the flat "no prior data" state.
 */
export function DeltaChip({
  value,
  suffix = "vs last period",
  className,
}: {
  value: number | null | undefined;
  suffix?: string;
  className?: string;
}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs", className)}>
        <span className="inline-flex items-center rounded-full bg-surface-subtle px-2 py-0.5 font-medium text-text-muted">
          —
        </span>
        <span className="text-text-muted">No prior data</span>
      </span>
    );
  }
  const up = value >= 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium tabular-nums",
          up ? "bg-success-50 text-success" : "bg-error-50 text-error",
        )}
      >
        <Arrow className="h-3 w-3" aria-hidden="true" />
        {up ? "+" : ""}
        {value.toFixed(1)}%
      </span>
      <span className="text-text-muted">{suffix}</span>
    </span>
  );
}
