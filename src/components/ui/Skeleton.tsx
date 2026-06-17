import { cn } from "@/lib/cn";

/**
 * Skeleton (design-system §8.10). surface-subtle block with a slow shimmer,
 * sized to the real content. Respects prefers-reduced-motion (shimmer disabled).
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-surface-subtle motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

/** Convenience: N skeleton table rows sized to a column count. */
export function SkeletonRows({
  rows = 6,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn("h-4 flex-1", c === 0 && "max-w-[40%]")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
