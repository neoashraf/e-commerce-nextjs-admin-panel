import { ReportTabs } from "./_components/ReportTabs";

/**
 * Reports layout — a full-width in-page tab sub-nav above the active report
 * viewer (design-system §8.8). Replaces the old second left rail, which
 * compressed the data body. Server enforcement is authoritative; the tabs just
 * hide unpermitted reports.
 */
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <ReportTabs />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
