"use client";

import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Checkbox (design-system §8.2) — an 18px rounded box used by table row/select-all
 * controls. Accent fill + white check when checked; a minus glyph for the
 * indeterminate (some-but-not-all) header state. A real focusable button with
 * role="checkbox" so it's keyboard- and screen-reader-operable.
 */
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  className,
  disabled = false,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const active = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-[1.5px] text-accent-fg transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1",
        active ? "border-accent-600 bg-accent-600" : "border-border-strong bg-surface hover:border-text-muted",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {checked ? (
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      ) : indeterminate ? (
        <Minus className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      ) : null}
    </button>
  );
}
