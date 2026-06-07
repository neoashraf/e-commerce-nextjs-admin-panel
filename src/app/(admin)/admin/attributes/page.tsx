import { Suspense } from "react";
import { AttributesView } from "@/components/catalog/AttributesView";

/** Attributes list — /admin/attributes (catalog-attributes-fe). */
export default function AttributesPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
      <AttributesView />
    </Suspense>
  );
}
