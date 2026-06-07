"use client";

import Link from "next/link";
import { usePage } from "@/lib/api/hooks/useContent";
import { PageEditor } from "@/components/content/PageEditor";

export function EditPageView({ id }: { id: string }) {
  const { data, isLoading, isError } = usePage(id);
  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
  if (isError || !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-600">We couldn&apos;t find that page.</p>
        <Link href="/admin/content/pages" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">Back to pages</Link>
      </div>
    );
  }
  return <PageEditor mode="edit" page={data} />;
}
