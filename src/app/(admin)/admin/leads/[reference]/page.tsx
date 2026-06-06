import { LeadThreadView } from "@/components/leads/LeadThreadView";

/** Lead thread — /admin/leads/<reference> (lead-inbox-fe). */
export default function LeadThreadPage({ params }: { params: { reference: string } }) {
  return <LeadThreadView reference={params.reference} />;
}
