"use client";

import Link from "next/link";
import { useFamily } from "@/lib/api/hooks/useCatalog";
import { FamilyEditor } from "@/components/catalog/FamilyEditor";

/** Loads a family's detail then renders the editor (catalog-attribute-families-fe). */
export function EditFamilyView({ id }: { id: string }) {
  const { data, isLoading, isError } = useFamily(id);
  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
  if (isError || !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-600">We couldn&apos;t find that family.</p>
        <Link href="/admin/attribute-families" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">Back to families</Link>
      </div>
    );
  }
  return <FamilyEditor mode="edit" family={data} />;
}
