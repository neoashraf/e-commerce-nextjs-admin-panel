import { CustomerDetailView } from "@/components/customers/CustomerDetailView";

/** Customer 360 — /admin/customers/<id> (cust-fe). */
export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  return <CustomerDetailView id={params.id} />;
}
