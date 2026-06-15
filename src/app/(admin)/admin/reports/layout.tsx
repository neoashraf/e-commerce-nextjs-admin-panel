import { ReportNav } from "./_components/ReportNav";

/**
 * Reports layout — the permission-filtered nav rail beside the active report
 * viewer (desktop-first: rail left, viewer right; stacked on narrow widths).
 * Server enforcement is authoritative; the rail just hides unpermitted reports.
 */
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <ReportNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
