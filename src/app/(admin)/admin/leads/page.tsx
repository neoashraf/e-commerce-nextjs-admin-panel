import { Suspense } from "react";
import { LeadInboxView } from "@/components/leads/LeadInboxView";

/** Leads inbox — /admin/leads (lead-inbox-fe). */
export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
      <LeadInboxView />
    </Suspense>
  );
}
