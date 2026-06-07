"use client";

import Link from "next/link";
import { useAttribute } from "@/lib/api/hooks/useCatalog";
import { AttributeEditor } from "@/components/catalog/AttributeEditor";

/** Loads an attribute's detail then renders the editor (catalog-attributes-fe). */
export function EditAttributeView({ id }: { id: string }) {
  const { data, isLoading, isError } = useAttribute(id);
  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
  if (isError || !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-600">We couldn&apos;t find that attribute.</p>
        <Link href="/admin/attributes" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">Back to attributes</Link>
      </div>
    );
  }
  return <AttributeEditor mode="edit" attribute={data} />;
}
