"use client";

import Link from "next/link";
import { useProduct } from "@/lib/api/hooks/useCatalog";
import { ProductEditor } from "@/components/catalog/ProductEditor";

export function EditProductView({ id }: { id: string }) {
  const { data, isLoading, isError } = useProduct(id);
  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
  if (isError || !data) {
    return <div className="py-12 text-center"><p className="text-sm text-gray-600">We couldn&apos;t find that product.</p><Link href="/admin/products" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">Back to products</Link></div>;
  }
  return <ProductEditor mode="edit" product={data} />;
}
