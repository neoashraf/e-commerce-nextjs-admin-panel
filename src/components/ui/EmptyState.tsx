import { AlertCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

/**
 * Empty state (design-system §8.10) — centered lucide icon in a faint circle,
 * an h3 line, a muted explainer, and an optional action. Not an error.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-faint">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <h3 className="text-[15px] font-semibold text-text">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Error state (design-system §8.10) — inline (per widget), never a full-page
 * crash for one failed source. Icon + message + a Retry button.
 */
export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center px-6 py-10 text-center",
        className,
      )}
    >
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error-50 text-error">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="text-[15px] font-semibold text-text">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-text-muted">{description}</p>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
