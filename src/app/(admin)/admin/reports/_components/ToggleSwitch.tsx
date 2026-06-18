"use client";

import { cn } from "@/lib/cn";

/**
 * A small on/off switch (role="switch") — accent track when on, white knob.
 * Used by the Schedules row "Active" toggle and the schedule drawer. Respects
 * prefers-reduced-motion (no knob transition).
 */
export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 disabled:opacity-50",
        checked ? "bg-accent-600" : "bg-border-strong",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
