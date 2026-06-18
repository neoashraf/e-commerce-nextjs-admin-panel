import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Native select styled to the system (design-system §8.2). 36px, surface bg,
 * border-strong, accent focus ring, custom chevron.
 */
export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, error, children, ...props },
  ref,
) {
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={cn(
          "h-9 w-full appearance-none rounded-md border bg-surface pl-3 pr-9 text-sm text-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-text-faint",
          error ? "border-error" : "border-border-strong",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
        aria-hidden="true"
      />
    </div>
  );
});
