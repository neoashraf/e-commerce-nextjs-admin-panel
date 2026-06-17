import { cn } from "@/lib/cn";

/**
 * Card / Panel (design-system §8.4). The standard widget container:
 * surface bg + 1px border + radius-lg + shadow-sm. Compose with CardHeader /
 * CardBody for the title row + padded body, or pass children directly.
 */
export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface shadow-sm",
        interactive &&
          "transition-shadow hover:border-border-strong hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

/** Card header row: h2 title left, optional action node right, hairline divider. */
export function CardHeader({
  title,
  action,
  divider = false,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  divider?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-5 py-4",
        divider && "border-b border-border",
        className,
      )}
    >
      <h2 className="text-[18px] font-semibold leading-6 text-text">{title}</h2>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

/** Padded card body. */
export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

/** Card footer ("as of {time}"). */
export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-t border-border px-5 py-3 text-xs text-text-muted",
        className,
      )}
      {...props}
    />
  );
}
