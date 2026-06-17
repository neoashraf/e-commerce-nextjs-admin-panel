import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Reports" };

/**
 * Reports landing — /admin/reports defaults to the Sales report (design-system
 * §8.8: the tab bar conveys context, Sales is the default tab). The per-report
 * viewer enforces permission; the BE remains authoritative.
 */
export default function ReportsPage() {
  redirect("/admin/reports/sales");
}
