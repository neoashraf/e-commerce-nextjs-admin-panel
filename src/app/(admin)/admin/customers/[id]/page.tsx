import { Suspense } from "react";
import { CustomerDetailView } from "@/components/customers/CustomerDetailView";
import { DetailPageSkeleton } from "@/components/shell/PageSkeletons";

/** Customer 360 — /admin/customers/<id> (cust-fe). */
export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  // Suspense boundary required: CustomerDetailView reads `useSearchParams()` (the `?order=`
  // in-context order drawer), which Next 14 needs wrapped for prerendering.
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <CustomerDetailView id={params.id} />
    </Suspense>
  );
}
