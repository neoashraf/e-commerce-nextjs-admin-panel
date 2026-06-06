import { Suspense } from "react";
import { CustomersView } from "@/components/customers/CustomersView";

/** Customers list — /admin/customers (cust-fe). */
export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
      <CustomersView />
    </Suspense>
  );
}
