"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  categoryTreeSchema,
  categoryDetailSchema,
  createCategoryResultSchema,
  attributeListSchema,
  attributeDetailSchema,
  createAttributeResultSchema,
  familyListSchema,
  familyDetailSchema,
  createFamilyResultSchema,
  type CategoryNode,
  type CategoryDetail,
  type AttributeRow,
  type AttributeDetail,
  type AttributeOption,
  type FamilyRow,
  type FamilyDetail,
  type FamilyGroup,
} from "@/lib/api/schemas/catalog";

/**
 * Admin catalog hooks (catalog-categories-fe + attribute checklist). The admin
 * category tree reads GET /admin/categories (full tree incl. unpublished — the
 * public /categories/tree is published-only; flagged for BE). All via the api
 * client; mutations invalidate the tree.
 */
export const catalogKeys = {
  categoryTree: (includeDeleted: boolean) => ["admin-categories", includeDeleted] as const,
  category: (id: string) => ["admin-category", id] as const,
  attributes: (filterable: boolean) => ["admin-attributes", filterable] as const,
};

export function useCategoryTree(includeDeleted = false) {
  return useQuery({
    queryKey: catalogKeys.categoryTree(includeDeleted),
    queryFn: (): Promise<CategoryNode[]> =>
      api.get("/admin/categories", {
        schema: categoryTreeSchema,
        params: { include_deleted: includeDeleted || undefined },
      }) as Promise<CategoryNode[]>,
    staleTime: 30_000,
  });
}

export function useCategory(id: string) {
  return useQuery({
    queryKey: catalogKeys.category(id),
    enabled: !!id,
    queryFn: (): Promise<CategoryDetail> =>
      api.get(`/admin/categories/${id}`, { schema: categoryDetailSchema }) as Promise<CategoryDetail>,
    staleTime: 30_000,
  });
}

export function useFilterableAttributes() {
  return useQuery({
    queryKey: catalogKeys.attributes(true),
    queryFn: (): Promise<AttributeRow[]> =>
      api.get("/admin/attributes", { schema: attributeListSchema, params: { filterable: true, limit: 200 } }) as Promise<AttributeRow[]>,
    staleTime: 5 * 60_000,
  });
}

type CategoryBody = Partial<{
  name: string;
  parent_id: string | null;
  description: string;
  display_mode: string;
  show_in_menu: boolean;
  is_published: boolean;
  position: number;
  filterable_attribute_codes: string[];
  meta_title: string;
  meta_keywords: string;
  meta_description: string;
}>;

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CategoryBody) =>
      api.post("/admin/categories", body, { schema: createCategoryResultSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
}

export function useUpdateCategory(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CategoryBody) => api.patch(`/admin/categories/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: catalogKeys.category(id) });
    },
  });
}

/** Inline patch for publish / show-in-menu / position toggles in the tree. */
export function usePatchCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CategoryBody }) =>
      api.patch(`/admin/categories/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/admin/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
}

// ---- Attributes (catalog-attributes-fe) ----

export function useAttributes(params: Record<string, string | number | boolean | undefined>) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: ["admin-attributes", qs] as const,
    queryFn: (): Promise<AttributeRow[]> =>
      api.get("/admin/attributes", { schema: attributeListSchema, params }) as Promise<AttributeRow[]>,
    staleTime: 30_000,
  });
}

export function useAttribute(id: string) {
  return useQuery({
    queryKey: ["admin-attribute", id] as const,
    enabled: !!id,
    queryFn: (): Promise<AttributeDetail> =>
      api.get(`/admin/attributes/${id}`, { schema: attributeDetailSchema }) as Promise<AttributeDetail>,
    staleTime: 30_000,
  });
}

export interface AttributeBody {
  admin_label: string;
  code?: string;
  type?: string;
  is_required?: boolean;
  is_unique?: boolean;
  is_filterable?: boolean;
  is_configurable?: boolean;
  is_visible_on_front?: boolean;
  is_comparable?: boolean;
  validation?: string | null;
  options?: AttributeOption[];
}

export function useCreateAttribute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AttributeBody) =>
      api.post("/admin/attributes", body as unknown as Record<string, unknown>, { schema: createAttributeResultSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-attributes"] }),
  });
}

export function useUpdateAttribute(id: string) {
  const qc = useQueryClient();
  return useMutation({
    // code is immutable — never sent on edit (the caller omits it).
    mutationFn: (body: Omit<AttributeBody, "code" | "type">) => api.patch(`/admin/attributes/${id}`, body as unknown as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-attributes"] });
      qc.invalidateQueries({ queryKey: ["admin-attribute", id] });
    },
  });
}

export function useDeleteAttribute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/admin/attributes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-attributes"] }),
  });
}

// ---- Attribute families (catalog-attribute-families-fe) ----

export function useFamilies() {
  return useQuery({
    queryKey: ["admin-families"] as const,
    queryFn: (): Promise<FamilyRow[]> =>
      api.get("/admin/attribute-families", { schema: familyListSchema }) as Promise<FamilyRow[]>,
    staleTime: 60_000,
  });
}

export function useFamily(id: string) {
  return useQuery({
    queryKey: ["admin-family", id] as const,
    enabled: !!id,
    queryFn: (): Promise<FamilyDetail> =>
      api.get(`/admin/attribute-families/${id}`, { schema: familyDetailSchema }) as Promise<FamilyDetail>,
    staleTime: 30_000,
  });
}

interface FamilyBody {
  code?: string;
  name: string;
  groups: FamilyGroup[];
}

export function useCreateFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FamilyBody) =>
      api.post("/admin/attribute-families", body as unknown as Record<string, unknown>, { schema: createFamilyResultSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-families"] }),
  });
}

export function useUpdateFamily(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<FamilyBody, "code">) =>
      api.patch(`/admin/attribute-families/${id}`, body as unknown as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-families"] });
      qc.invalidateQueries({ queryKey: ["admin-family", id] });
    },
  });
}

export function useDeleteFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/admin/attribute-families/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-families"] }),
  });
}
