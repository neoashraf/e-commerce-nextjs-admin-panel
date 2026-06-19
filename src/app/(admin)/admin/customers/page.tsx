import { Suspense } from "react";
import { Card, SkeletonRows } from "@/components/ui";
import { CustomersView } from "@/components/customers/CustomersView";

/** Customers list — /admin/customers (cust-fe). */
export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <Card className="p-0">
          <SkeletonRows rows={8} cols={6} />
        </Card>
      }
    >
      <CustomersView />
    </Suspense>
  );
}
