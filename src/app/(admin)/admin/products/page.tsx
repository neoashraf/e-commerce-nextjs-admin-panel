import { Suspense } from "react";
import { ProductsView } from "@/components/catalog/ProductsView";

/** Products list — /admin/products (catalog-products-list-fe). Gated by the
 * shell (catalog.product.read). Create/Edit link to the editor (AFW3). */
export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
      <ProductsView />
    </Suspense>
  );
}
