import { Card } from "@/components/ui";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";

/**
 * Route-level loading skeletons (design-system §8.10). Rendered by each route's
 * `loading.tsx` while the segment's server component / data resolves, then
 * automatically replaced by the real page. Purely presentational placeholders —
 * they change no behaviour and mirror the rough shape of each page family
 * (header + body) so the swap to real content doesn't jump.
 */

/** Standard page header: title line + subtitle, with an optional action chip. */
function HeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {action && <Skeleton className="h-9 w-32" />}
    </div>
  );
}

/** A row of KPI stat cards. */
function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="space-y-3 p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-24" />
        </Card>
      ))}
    </div>
  );
}

/** List / table page: header, a filter toolbar, then a table of rows. */
export function ListPageSkeleton({
  rows = 8,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-28" />
      </div>
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-40" />
        </div>
        <SkeletonRows rows={rows} cols={cols} />
      </Card>
    </div>
  );
}

/** Detail page: header, a stat strip, then a wide content card + a side card. */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <StatGridSkeleton count={3} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="space-y-4 p-5 lg:col-span-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </Card>
        <Card className="space-y-4 p-5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
      </div>
    </div>
  );
}

/** Form page (create / edit / settings): header, then stacked field groups. */
export function FormPageSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="space-y-5">
      <HeaderSkeleton action={false} />
      <Card className="space-y-6 p-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </Card>
    </div>
  );
}

/** Dashboard: header, a KPI grid, then two chart cards side by side. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <StatGridSkeleton count={4} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="space-y-4 p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Reports body (a single report viewer): header, controls row, KPI strip, then a
 * chart card. No tab bar — the reports `layout.tsx` already renders the tabs, so
 * this child skeleton must not duplicate them.
 */
export function ReportBodySkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <StatGridSkeleton count={4} />
      <Card className="space-y-4 p-5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </Card>
    </div>
  );
}

/**
 * Reports management body (Exports / Schedules): header + a table. No tab bar
 * (the reports layout renders it).
 */
export function ReportListSkeleton() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton action={false} />
      <Card className="overflow-hidden p-0">
        <SkeletonRows rows={6} cols={6} />
      </Card>
    </div>
  );
}
