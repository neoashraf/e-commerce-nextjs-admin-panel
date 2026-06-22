"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  categoryTreeSchema,
  categoryDetailSchema,
  createCategoryResultSchema,
  uploadCategoryImageResultSchema,
  type CategoryImageSlot,
  attributeListSchema,
  attributePageSchema,
  type AttributePage,
  attributeDetailSchema,
  createAttributeResultSchema,
  familyListSchema,
  familyDetailSchema,
  createFamilyResultSchema,
  productPageSchema,
  bulkStatusResultSchema,
  type ProductPage,
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
  image_url: string | null;
  logo_url: string | null;
  banner_url: string | null;
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

/**
 * Reorder categories among their siblings (FR-CAT-004). The BE `PATCH { position }`
 * is a **raw set** (it does not reindex siblings, and positions are 0-based), so a
 * reorder must renumber every sibling whose slot changed — we send one PATCH per
 * changed sibling with its **absolute** new 0-based `position` (never a relative ±1).
 * The tree view holds the optimistic order locally and reconciles/rolls back on
 * settle, so this only persists + refetches.
 */
export function useReorderCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: Array<{ id: string; position: number }>) =>
      Promise.all(
        updates.map((u) => api.patch(`/admin/categories/${u.id}`, { position: u.position })),
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
}

/** Upload a category image to a slot (thumbnail/logo/banner); BE stores it on the matching column. */
export function useUploadCategoryImage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, slot }: { file: File; slot: CategoryImageSlot }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("slot", slot);
      return api.postForm(`/admin/categories/${id}/images`, form, {
        schema: uploadCategoryImageResultSchema,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: catalogKeys.category(id) });
    },
  });
}

// ---- Attributes (catalog-attributes-fe) ----

export function useAttributes(params: Record<string, string | number | boolean | undefined>) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: ["admin-attributes", qs] as const,
    // rawEnvelope so the list view can read meta.total for pagination. Bulk
    // consumers (family pickers) read `.data` off the same envelope.
    queryFn: (): Promise<AttributePage> =>
      api.get("/admin/attributes", { schema: attributePageSchema, params, rawEnvelope: true }) as Promise<AttributePage>,
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

// ---- Products (catalog-products-list-fe) ----

export function useProducts(params: Record<string, string | number | boolean | undefined>) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: ["admin-products", qs] as const,
    // rawEnvelope so the list view can read meta.total for pagination.
    queryFn: (): Promise<ProductPage> =>
      api.get("/admin/products", { schema: productPageSchema, params, rawEnvelope: true }) as Promise<ProductPage>,
    staleTime: 20_000,
  });
}

export function useProductStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "published" | "archived" | "draft" }) =>
      api.patch(`/admin/products/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/admin/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });
}

/**
 * Bulk publish / archive the selected products (PATCH /admin/products/bulk-status). Returns the
 * per-item `results[]` so the view can surface which succeeded/failed without aborting the batch
 * (FR-CAT-015/016). Invalidates the list so the flipped statuses + qty refresh.
 */
export function useBulkProductStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: "published" | "archived" }) =>
      api.patch("/admin/products/bulk-status", { ids, status }, { schema: bulkStatusResultSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });
}

/**
 * Download the current filtered product set as CSV (GET /admin/products/export). The backend returns
 * a raw `text/csv` body (not the JSON envelope), so this goes through `api.download` and triggers a
 * browser save using the server's `Content-Disposition` filename.
 */
export function useExportProducts() {
  return useMutation({
    mutationFn: async (params: Record<string, string | undefined>) => {
      const { blob, filename } = await api.download("/admin/products/export", { params });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? "products.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });
}

// ---- Product editor (catalog-product-editor-fe) ----
import {
  productDetailSchema as _pds,
  createProductResultSchema as _cprs,
  generateVariantsResultSchema as _gvrs,
  uploadImageResultSchema as _uirs,
  editorFamilyDetailSchema as _efds,
  type ProductDetail as _PD,
  type EditorFamilyDetail as _EFD,
} from "@/lib/api/schemas/catalog";

export function useProduct(id: string) {
  return useQuery({
    queryKey: ["admin-product", id] as const,
    enabled: !!id,
    queryFn: (): Promise<_PD> => api.get(`/admin/products/${id}`, { schema: _pds }) as Promise<_PD>,
    staleTime: 15_000,
  });
}
export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/admin/products", body, { schema: _cprs }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });
}
export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/admin/products/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); qc.invalidateQueries({ queryKey: ["admin-product", id] }); },
  });
}
export function useGenerateVariants(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { configurable_attributes: Array<{ code: string; option_ids: string[] }> }) =>
      api.post(`/admin/products/${id}/variants`, body, { schema: _gvrs }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product", id] }),
  });
}
export function useUpdateVariant(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, body }: { variantId: string; body: Record<string, unknown> }) => api.patch(`/admin/variants/${variantId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product", productId] }),
  });
}

/**
 * The product editor's family detail — the chosen family's groups with each
 * attribute's code/label/type, used to render the family-driven attribute
 * inputs. Reuses GET /admin/attribute-families/{id} (the BE returns
 * groups[].attributes[]); we only enable it once a family is known.
 */
export function useEditorFamily(familyId: string) {
  return useQuery({
    queryKey: ["editor-family", familyId] as const,
    enabled: !!familyId,
    queryFn: (): Promise<_EFD> =>
      api.get(`/admin/attribute-families/${familyId}`, { schema: _efds }) as Promise<_EFD>,
    staleTime: 5 * 60_000,
  });
}

/**
 * Upload a product image (multipart). `is_primary` clears the no_primary_image
 * publish blocker. Invalidates the product so primary_image_id + images[] refresh,
 * which re-renders the editor gallery. NOTE: reorder is still flagged for BE; upload + view +
 * set-primary + delete are wired.
 */
export function useUploadProductImage(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; alt_text: string; is_primary?: boolean }) => {
      const form = new FormData();
      form.append("file", input.file);
      form.append("alt_text", input.alt_text);
      if (input.is_primary) form.append("is_primary", "true");
      return api.postForm(`/admin/products/${productId}/images`, form, { schema: _uirs });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product", productId] }),
  });
}

/**
 * Promote an already-uploaded image to primary (PATCH .../images/{imageId}/primary). Invalidates the
 * product so the gallery + primary_image_id refresh; the storefront PDP reflects it on its next fetch.
 */
export function useSetProductImagePrimary(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) =>
      api.patch(`/admin/products/${productId}/images/${imageId}/primary`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product", productId] }),
  });
}

/** Edit an existing image's alt text (PATCH .../images/{imageId}). Invalidates the product to refresh. */
export function useUpdateProductImageAlt(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { imageId: string; alt_text: string }) =>
      api.patch(`/admin/products/${productId}/images/${input.imageId}`, {
        alt_text: input.alt_text,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product", productId] }),
  });
}

/**
 * Delete an image (DELETE .../images/{imageId}). If the deleted image was primary, the BE reassigns
 * primary to the next image (or clears it when none remain). Invalidates the product so the gallery +
 * primary_image_id refresh.
 */
export function useDeleteProductImage(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) =>
      api.delete<void>(`/admin/products/${productId}/images/${imageId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product", productId] }),
  });
}
