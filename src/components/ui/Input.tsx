import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Text input (design-system §8.2). 36px, surface bg, border-strong, accent
 * focus ring. Optional leading icon, helper, and inline error text.
 */
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: React.ReactNode;
  error?: string;
  helper?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leadingIcon, error, helper, className, id, ...props },
  ref,
) {
  return (
    <div className="w-full">
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          className={cn(
            "h-9 w-full rounded-md border bg-surface text-sm text-text placeholder:text-text-faint",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-text-faint",
            leadingIcon ? "pl-9 pr-3" : "px-3",
            error ? "border-error" : "border-border-strong",
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <p className="mt-1 text-xs text-error">{error}</p>
      ) : helper ? (
        <p className="mt-1 text-xs text-text-muted">{helper}</p>
      ) : null}
    </div>
  );
});
