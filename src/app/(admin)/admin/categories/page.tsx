import { CategoriesView } from "@/components/catalog/CategoriesView";

/** Categories tree — /admin/categories (catalog-categories-fe). Gated by the
 * shell (catalog.category.read). */
export default function CategoriesPage() {
  return <CategoriesView />;
}
