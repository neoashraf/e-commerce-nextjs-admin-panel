"use client";

import Link from "next/link";
import { useCategory } from "@/lib/api/hooks/useCatalog";
import { CategoryEditor } from "@/components/catalog/CategoryEditor";

/** Loads a category's detail then renders the editor (catalog-categories-fe). */
export function EditCategoryView({ id }: { id: string }) {
  const { data, isLoading, isError } = useCategory(id);

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
  if (isError || !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-600">We couldn&apos;t find that category.</p>
        <Link href="/admin/categories" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">Back to categories</Link>
      </div>
    );
  }
  return <CategoryEditor mode="edit" category={data} />;
}
