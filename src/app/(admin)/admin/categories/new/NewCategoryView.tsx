"use client";

import { useSearchParams } from "next/navigation";
import { CategoryEditor } from "@/components/catalog/CategoryEditor";

/** Reads ?parent= and renders the editor in create mode (catalog-categories-fe). */
export function NewCategoryView() {
  const parent = useSearchParams().get("parent") ?? undefined;
  return <CategoryEditor mode="create" defaultParentId={parent} />;
}
