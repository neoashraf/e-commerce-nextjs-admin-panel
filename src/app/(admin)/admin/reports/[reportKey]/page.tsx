import { notFound } from "next/navigation";
import { isReportKey } from "@/lib/api/schemas/reports";
import { getReportMeta } from "../_components/catalog";
import { ReportViewerGate } from "../_components/ReportViewerGate";

/** Per-report viewer — /admin/reports/[reportKey] (rpt-fe-shell-reports). */
export function generateMetadata({ params }: { params: { reportKey: string } }) {
  const meta = getReportMeta(params.reportKey);
  return { title: meta ? `${meta.label} report` : "Report" };
}

export default function ReportPage({ params }: { params: { reportKey: string } }) {
  if (!isReportKey(params.reportKey)) notFound();
  return <ReportViewerGate reportKey={params.reportKey} />;
}
