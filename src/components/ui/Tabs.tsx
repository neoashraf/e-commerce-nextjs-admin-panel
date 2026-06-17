import Link from "next/link";
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
  const inner = (
    <>
      {item.label}
      {item.count !== undefined && (
        <span className="ml-1.5 tabular-nums text-text-faint">{item.count}</span>
      )}
    </>
  );
  const className = cn(
    "relative -mb-px inline-flex items-center whitespace-nowrap border-b-2 px-1 pb-2.5 pt-1 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
    active
      ? "border-accent-600 text-text"
      : "border-transparent text-text-muted hover:text-text-secondary",
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
    <div className={cn("border-b border-border", className)}>
      <div className="flex items-center justify-between gap-6 overflow-x-auto no-scrollbar">
        <nav className="flex items-center gap-6" aria-label="Sections">
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
            className="flex items-center gap-6 border-l border-border pl-6"
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
    </div>
  );
}
