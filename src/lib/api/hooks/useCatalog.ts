"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  categoryTreeSchema,
  categoryDetailSchema,
  createCategoryResultSchema,
  categoryImageUploadResultSchema,
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
  slug: string;
  parent_id: string | null;
  description: string;
  display_mode: string;
  show_in_menu: boolean;
  is_published: boolean;
  position: number;
  image_url: string;
  logo_url: string;
  banner_url: string;
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

/**
 * Upload one category image into a slot (thumbnail | logo | banner) →
 * POST /admin/categories/{id}/images (multipart: file + slot). The BE writes the
 * matching column (image_url / logo_url / banner_url) and returns `{ url, slot }`.
 * The running BE may not serve this endpoint yet (brief: cat-category-editor-be.md);
 * the editor catches the failure and keeps the URL-paste fallback working.
 */
export function useUploadCategoryImage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; slot: CategoryImageSlot }) => {
      const form = new FormData();
      form.append("file", input.file);
      form.append("slot", input.slot);
      return api.postForm(`/admin/categories/${id}/images`, form, {
        schema: categoryImageUploadResultSchema,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: catalogKeys.category(id) });
    },
  });
}

/**
 * Reorder one sibling group. The BE persists a RAW `position` per category and
 * does NOT renumber the rest of the group (update-category.use-case.ts), so
 * sending only the moved node's position collides with an existing one and the
 * tree (ordered by `position ASC`) doesn't actually move. We therefore renumber
 * the WHOLE group to a clean 1..N sequence and PATCH every sibling whose
 * position changed. Optimistically reorders the cached tree so the row moves
 * instantly; on any failure the cache is rolled back and the tree refetched.
 *
 * `orderedIds` is the parent's children in their desired new order.
 * `parentId` is null for top-level roots.
 */
export function useReorderCategory(includeDeleted = false) {
  const qc = useQueryClient();
  const queryKey = catalogKeys.categoryTree(includeDeleted);

  return useMutation({
    // Renumber the whole group to a clean 1..N so positions never collide. PATCH
    // every sibling (a group is small); the BE writes the raw position each gets.
    mutationFn: async ({ orderedIds }: { parentId: string | null; orderedIds: string[] }) => {
      await Promise.all(orderedIds.map((id, idx) => api.patch(`/admin/categories/${id}`, { position: idx + 1 })));
    },
    onMutate: async ({ parentId, orderedIds }) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<CategoryNode[]>(queryKey);
      if (previous) {
        qc.setQueryData<CategoryNode[]>(queryKey, reorderTreeGroup(previous, parentId, orderedIds));
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
}

/**
 * Return a copy of `tree` with the children of `parentId` reordered to match
 * `orderedIds` and their `position` renumbered 1..N (mirrors the BE write).
 */
function reorderTreeGroup(tree: CategoryNode[], parentId: string | null, orderedIds: string[]): CategoryNode[] {
  const apply = (siblings: CategoryNode[]): CategoryNode[] => {
    const byId = new Map(siblings.map((s) => [s.id, s]));
    // Keep any sibling missing from orderedIds (e.g. a filtered-out deleted node) in place.
    const ordered = orderedIds.map((id) => byId.get(id)).filter((s): s is CategoryNode => !!s);
    const extras = siblings.filter((s) => !orderedIds.includes(s.id));
    return [...ordered, ...extras].map((s, idx) => ({ ...s, position: idx + 1 }));
  };

  if (parentId === null) return apply(tree);

  const recurse = (nodes: CategoryNode[]): CategoryNode[] =>
    nodes.map((n) =>
      n.id === parentId
        ? { ...n, children: apply(n.children) }
        : { ...n, children: recurse(n.children) },
    );
  return recurse(tree);
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

/**
 * Bulk publish / archive the selected rows (PATCH /admin/products/bulk-status,
 * FR-CAT-015/016). Each item runs the same per-product validation as the single
 * transition, so the batch never aborts — the result's `results[]` carries each
 * id's ok/failure so the UI can show a per-item summary. Invalidates the list.
 */
export function useBulkProductStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: "published" | "archived" }) =>
      api.patch("/admin/products/bulk-status", { ids, status }, { schema: bulkStatusResultSchema }),
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

// ---- Product editor (catalog-product-editor-fe) ----
import {
  productDetailSchema as _pds,
  createProductResultSchema as _cprs,
  generateVariantsResultSchema as _gvrs,
  uploadImageResultSchema as _uirs,
  addVideoResultSchema as _avrs,
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
    mutationFn: (input: {
      file: File;
      alt_text: string;
      is_primary?: boolean;
      color_option_id?: string | null;
    }) => {
      const form = new FormData();
      form.append("file", input.file);
      form.append("alt_text", input.alt_text);
      if (input.is_primary) form.append("is_primary", "true");
      if (input.color_option_id) form.append("color_option_id", input.color_option_id);
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

/**
 * Edit an existing image's alt text and/or color tag (PATCH .../images/{imageId}).
 * Sends any subset; `color_option_id: null` clears the tag. Invalidates the product to refresh.
 */
export function useUpdateProductImage(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { imageId: string; alt_text?: string; color_option_id?: string | null }) => {
      const body: Record<string, unknown> = {};
      if (input.alt_text !== undefined) body.alt_text = input.alt_text;
      if (input.color_option_id !== undefined) body.color_option_id = input.color_option_id;
      return api.patch(`/admin/products/${productId}/images/${input.imageId}`, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product", productId] }),
  });
}

/**
 * Persist the gallery order (PATCH .../images/reorder) with the full set of image
 * ids in the desired order. Optimistically rewrites the cached product so the tiles
 * stay put while the request is in flight; rolls back on error. The storefront PDP
 * renders images in this display_order.
 */
export function useReorderProductImages(productId: string) {
  const qc = useQueryClient();
  const key = ["admin-product", productId];
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      api.patch(`/admin/products/${productId}/images/reorder`, { ordered_ids: orderedIds }),
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<_PD>(key);
      if (previous) {
        const byId = new Map(previous.images.map((i) => [i.id, i]));
        const images = orderedIds
          .map((id, idx) => { const im = byId.get(id); return im ? { ...im, display_order: idx } : null; })
          .filter((i): i is _PD["images"][number] => i !== null);
        qc.setQueryData<_PD>(key, { ...previous, images });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(key, ctx.previous); },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
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

// ---- Product links (FR-CAT-019; PUT /admin/products/{id}/links) ----

/** Save the full set of typed product links (related / up_sell / cross_sell). */
export function useSetProductLinks(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { related: string[]; up_sell: string[]; cross_sell: string[] }) =>
      api.put(`/admin/products/${productId}/links`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product", productId] }),
  });
}

// ---- Product videos (FR-CAT-034; POST/DELETE /admin/products/{id}/videos) ----

/** Add a product video by URL (or upload). Invalidates the product so videos[] refresh. */
export function useAddProductVideo(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { source: "url" | "upload"; url: string; display_order?: number }) =>
      api.post(`/admin/products/${productId}/videos`, input, { schema: _avrs }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product", productId] }),
  });
}

/** Delete a product video. Invalidates the product so videos[] refresh. */
export function useDeleteProductVideo(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (videoId: string) =>
      api.delete<void>(`/admin/products/${productId}/videos/${videoId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product", productId] }),
  });
}
