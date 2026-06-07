import { Suspense } from "react";
import { NewCategoryView } from "./NewCategoryView";

/** New category — /admin/categories/new (catalog-categories-fe). */
export default function NewCategoryPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
      <NewCategoryView />
    </Suspense>
  );
}
