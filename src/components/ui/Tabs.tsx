import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Underline tabs / in-page section sub-nav (design-system §8.8). A full-width
 * horizontal bar: a primary group + an optional right-aligned, divider-separated
 * secondary group (e.g. Reports' ANALYZE tabs + a MANAGE group). Items can be
 * links (routing sub-nav) or buttons (`onSelect`). Never a second sidebar rail.
 */
export interface TabItem {
  key: string;
  label: string;
  href?: string;
  count?: number;
  /** Optional leading icon (e.g. report-type glyphs in the Reports sub-nav). */
  icon?: LucideIcon;
}

function TabLink({
  item,
  active,
  onSelect,
}: {
  item: TabItem;
  active: boolean;
  onSelect?: (key: string) => void;
}) {
  const Icon = item.icon;
  const inner = (
    <>
      {Icon && (
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            active ? "text-accent-600" : "text-text-faint",
          )}
          aria-hidden="true"
        />
      )}
      {item.label}
      {item.count !== undefined && (
        // Count badge: an accent-50/700 pill when active, a neutral subtle pill
        // otherwise (design ORD §C — active tab reads in the brand accent).
        <span
          className={cn(
            "ml-1 inline-flex h-[18px] min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
            active ? "bg-accent-50 text-accent-700" : "bg-surface-subtle text-text-muted",
          )}
        >
          {item.count}
        </span>
      )}
    </>
  );
  const className = cn(
    "relative -mb-px inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap border-b-2 px-1 pb-2.5 pt-1 text-sm font-semibold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
    active
      ? "border-accent-600 text-accent-700"
      : "border-transparent text-text-muted hover:text-text",
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={className}
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect?.(item.key)}
      className={className}
    >
      {inner}
    </button>
  );
}

export function Tabs({
  items,
  secondary,
  activeKey,
  onSelect,
  className,
}: {
  items: TabItem[];
  secondary?: TabItem[];
  activeKey: string;
  onSelect?: (key: string) => void;
  className?: string;
}) {
  return (
    // The right-edge fade hints "more tabs — swipe" when the track overflows on
    // narrow screens; it's masked away once everything fits (md+). The track
    // itself is the horizontal slider: scroll-snap + momentum scroll on touch.
    <div className={cn("relative border-b border-border", className)}>
      <div
        className={cn(
          "no-scrollbar -mb-px flex snap-x items-center gap-5 overflow-x-auto",
          // Edge padding so the first/last tab never sits flush against (and gets
          // visually clipped by) the viewport edge while scrolling.
          "px-0.5 sm:gap-6",
          // On md+ there's room for the full bar, so spread primary ↔ secondary.
          "md:justify-between md:overflow-visible",
        )}
        style={{ scrollbarWidth: "none" }}
      >
        <nav
          className="flex shrink-0 items-center gap-5 sm:gap-6"
          aria-label="Sections"
        >
          {items.map((item) => (
            <TabLink
              key={item.key}
              item={item}
              active={item.key === activeKey}
              onSelect={onSelect}
            />
          ))}
        </nav>
        {secondary && secondary.length > 0 && (
          <nav
            className="flex shrink-0 items-center gap-5 border-l border-border pl-5 sm:gap-6 sm:pl-6"
            aria-label="Manage"
          >
            {secondary.map((item) => (
              <TabLink
                key={item.key}
                item={item}
                active={item.key === activeKey}
                onSelect={onSelect}
              />
            ))}
          </nav>
        )}
      </div>
      {/* Fade affordance — only visible while the track can scroll (hidden md+). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-canvas to-transparent md:hidden"
      />
    </div>
  );
}
