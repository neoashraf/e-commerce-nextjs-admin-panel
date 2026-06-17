"use client";

import { cn } from "@/lib/cn";

/**
 * Segmented control (design-system §8.2) — the preferred period switcher.
 * A surface-subtle track; the selected pill is white + shadow-xs + accent text.
 */
export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-surface-subtle p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-[6px] px-3 py-1 text-[13px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
              selected
                ? "bg-surface text-accent-700 shadow-xs"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
