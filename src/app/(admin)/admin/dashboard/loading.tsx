/** Skeleton mirroring the dashboard layout (fe-page-scaffold). */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-64 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-gray-200 bg-gray-100"
          />
        ))}
      </div>
    </div>
  );
}
