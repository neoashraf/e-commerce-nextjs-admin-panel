import { ReportTabs } from "./_components/ReportTabs";

/**
 * Reports layout — a full-width in-page tab sub-nav above the active report
 * viewer (design-system §8.8). Replaces the old second left rail, which
 * compressed the data body. Server enforcement is authoritative; the tabs just
 * hide unpermitted reports.
 *
 * The tab bar is **sticky** to the top of the scrolling <main> with a solid
 * white surface (design: the tab bar is a fixed band under the topbar, white
 * `#FFFFFF`). The negative margins bleed the band across <main>'s p-4/md:p-6
 * padding so it spans edge-to-edge and nothing shows through above or beside it
 * while the body scrolls underneath.
 */
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="sticky -top-4 z-20 -mx-4 -mt-4 bg-surface px-4 pt-2 md:-top-6 md:-mx-6 md:-mt-6 md:px-6 md:pt-3">
        <ReportTabs />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
