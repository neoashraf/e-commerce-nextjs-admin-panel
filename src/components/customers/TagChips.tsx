import { cn } from "@/lib/cn";

/**
 * Customer tag chips (design §8.7) — renders a customer's tags (tag keys) as small
 * dot+label chips, with "+N" overflow past `max`. Display-only; tag assignment is a
 * separate gated action. Known keys get a stable colour/label; unknown keys fall back
 * to a humanised label + neutral dot. Used in the directory Tags column and the 360 header.
 */
const TAG_META: Record<string, { label: string; dot: string }> = {
  vip: { label: "VIP", dot: "#D97706" },
  wholesale: { label: "Wholesale", dot: "#4F46E5" },
  repeat: { label: "Repeat", dot: "#16A34A" },
  newsletter: { label: "Newsletter", dot: "#94A3B8" },
  football: { label: "Football", dot: "#06B6D4" },
  cricket: { label: "Cricket", dot: "#8B5CF6" },
  at_risk: { label: "At risk", dot: "#DC2626" },
};

/** Options for the directory tag filter (key → label), in catalog order. */
export const CUSTOMER_TAG_OPTIONS: { key: string; label: string }[] = Object.entries(TAG_META).map(
  ([key, m]) => ({ key, label: m.label }),
);

function tagLabel(key: string): string {
  return TAG_META[key]?.label ?? key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TagChips({
  tags,
  max = 3,
  className,
}: {
  tags: string[];
  max?: number;
  className?: string;
}) {
  if (!tags || tags.length === 0) {
    return <span className="text-text-faint">—</span>;
  }
  const shown = tags.slice(0, max);
  const extra = tags.length - shown.length;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {shown.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-text-secondary"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: TAG_META[t]?.dot ?? "#94A3B8" }}
            aria-hidden="true"
          />
          {tagLabel(t)}
        </span>
      ))}
      {extra > 0 && <span className="text-[11px] font-medium text-text-faint">+{extra}</span>}
    </span>
  );
}
