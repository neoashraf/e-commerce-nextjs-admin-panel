import { z } from "zod";
import { paginated } from "@/lib/api/schemas/pagination";

/**
 * Zod schemas for the admin catalog — categories + attributes (for the
 * filterable checklist) (docs/api-contracts/02-catalog.md).
 */

export const categoryNodeSchema: z.ZodType<CategoryNode, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string().optional(),
    parent_id: z.string().nullable().optional(),
    level: z.number().catch(1),
    position: z.number().catch(0),
    is_published: z.boolean().catch(false),
    show_in_menu: z.boolean().catch(true),
    is_deleted: z.boolean().optional(),
    children: z.array(categoryNodeSchema).catch([]),
  }),
);
export interface CategoryNode {
  id: string;
  name: string;
  slug?: string;
  parent_id?: string | null;
  level: number;
  position: number;
  is_published: boolean;
  show_in_menu: boolean;
  is_deleted?: boolean;
  children: CategoryNode[];
}
export const categoryTreeSchema = z.array(categoryNodeSchema);

/** Full category detail for the editor. */
export const categoryDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional(),
  parent_id: z.string().nullable().optional(),
  level: z.number().optional(),
  description: z.string().nullable().optional(),
  display_mode: z.string().optional(),
  show_in_menu: z.boolean().default(true),
  is_published: z.boolean().default(false),
  position: z.number().optional(),
  image_url: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  banner_url: z.string().nullable().optional(),
  filterable_attribute_codes: z.array(z.string()).default([]),
  meta_title: z.string().nullable().optional(),
  meta_keywords: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
});
export type CategoryDetail = z.infer<typeof categoryDetailSchema>;

export const createCategoryResultSchema = z.object({
  id: z.string(),
  slug: z.string().optional(),
  level: z.number().optional(),
  is_published: z.boolean().optional(),
});

/** The three image slots a category carries (one image per slot, no gallery). */
export const CATEGORY_IMAGE_SLOTS = ["thumbnail", "logo", "banner"] as const;
export type CategoryImageSlot = (typeof CATEGORY_IMAGE_SLOTS)[number];

/**
 * `{ url, slot }` returned by POST /admin/categories/{id}/images (multipart:
 * file + slot). `slot` selects the column written — thumbnail→image_url,
 * logo→logo_url, banner→banner_url. The running BE may not serve this endpoint
 * yet (brief: cat-category-editor-be.md); the editor falls back to URL-paste,
 * which writes the same columns via the normal create/update body.
 */
export const categoryImageUploadResultSchema = z.object({
  url: z.string(),
  slot: z.enum(CATEGORY_IMAGE_SLOTS).optional(),
});

export const ATTRIBUTE_TYPES = [
  "text", "textarea", "select", "multiselect", "boolean", "number",
  "decimal", "date", "datetime", "price", "image", "file", "url",
] as const;

export const attributeRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  admin_label: z.string(),
  type: z.string().optional(),
  is_filterable: z.boolean().optional(),
  is_configurable: z.boolean().optional(),
  is_required: z.boolean().optional(),
  is_unique: z.boolean().optional(),
  is_visible_on_front: z.boolean().optional(),
  is_comparable: z.boolean().optional(),
  is_user_defined: z.boolean().optional(),
  created_at: z.string().optional(),
});
export type AttributeRow = z.infer<typeof attributeRowSchema>;
export const attributeListSchema = z.array(attributeRowSchema);
/** Paginated envelope for GET /admin/attributes (rawEnvelope: { data, meta }). */
export const attributePageSchema = paginated(attributeListSchema);
export type AttributePage = z.infer<typeof attributePageSchema>;

export const attributeOptionSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  value: z.string(),
  swatch: z.string().nullable().optional(),
  position: z.number().optional(),
});
export type AttributeOption = z.infer<typeof attributeOptionSchema>;

export const attributeDetailSchema = attributeRowSchema.extend({
  validation: z.string().nullable().optional(),
  options: z.array(attributeOptionSchema).default([]),
});
export type AttributeDetail = z.infer<typeof attributeDetailSchema>;

export const createAttributeResultSchema = z.object({ id: z.string(), code: z.string().optional() });

// ---- Attribute families ----

export const familyRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  is_default: z.boolean().optional(),
});
export type FamilyRow = z.infer<typeof familyRowSchema>;
export const familyListSchema = z.array(familyRowSchema);

/** Outbound shape we SEND on create/update — groups carry a flat list of codes. */
export const familyGroupSchema = z.object({
  name: z.string(),
  column: z.number().default(1),
  position: z.number().default(1),
  attribute_codes: z.array(z.string()).default([]),
});
export type FamilyGroup = z.infer<typeof familyGroupSchema>;

/**
 * Inbound group shape the BE RETURNS on family-detail: each group carries an
 * `attributes` array of objects ({ code, admin_label, … }), NOT a flat
 * `attribute_codes` string list. We map it down to `attribute_codes` so the
 * editor's group canvas keeps working off codes. (Tolerates either shape.)
 */
const familyGroupDetailSchema = z
  .object({
    name: z.string(),
    column: z.number().catch(1),
    position: z.number().catch(1),
    attributes: z
      .array(z.object({ code: z.string() }))
      .optional(),
    attribute_codes: z.array(z.string()).optional(),
  })
  .transform((g) => ({
    name: g.name,
    column: g.column,
    position: g.position,
    attribute_codes:
      g.attribute_codes ?? (g.attributes ?? []).map((a) => a.code),
  }));

export const familyDetailSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  is_default: z.boolean().optional(),
  groups: z.array(familyGroupDetailSchema).default([]),
});
export type FamilyDetail = z.infer<typeof familyDetailSchema>;

export const createFamilyResultSchema = z.object({ id: z.string(), code: z.string().optional() });

/** The six mandatory system attributes that can never leave a family. */
export const MANDATORY_ATTRIBUTE_CODES = ["sku", "name", "url_key", "price", "status", "description"];

// ---- Products (admin list) ----

export const productStatusSchema = z.enum(["draft", "published", "archived"]);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const productRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional(),
  sku: z.string().optional(),
  type: z.enum(["simple", "configurable"]).optional(),
  family: z.string().nullable().optional(),
  primary_image: z.string().nullable().optional(),
  base_price: z.string().optional(),
  status: productStatusSchema.default("draft"),
  primary_category: z.string().nullable().optional(),
  qty: z.number().nullable().optional(),
  // Live stock status from INV (joined on the admin list) — shown next to qty, like the inventory page.
  qty_status: z.enum(["in_stock", "low_stock", "out_of_stock"]).nullable().optional(),
});
export type ProductRow = z.infer<typeof productRowSchema>;
export const productListSchema = z.array(productRowSchema);
/** Paginated envelope for GET /admin/products (rawEnvelope: { data, meta }). */
export const productPageSchema = paginated(productListSchema);
export type ProductPage = z.infer<typeof productPageSchema>;

export const productVariantSchema = z.object({
  id: z.string(),
  sku_code: z.string(),
  options: z.record(z.string()).default({}),
  price: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  is_enabled: z.boolean().default(true),
  // Live INV stock for the editor matrix (admin detail joins it per variant).
  on_hand: z.number().default(0),
  // Reserved units (held by open orders) — the matrix shows Avail = on_hand − reserved.
  // BE may not join it yet → default 0 so the readout degrades to "Resvd 0".
  reserved: z.number().default(0),
  low_stock_threshold: z.number().default(0),
});
export type ProductVariant = z.infer<typeof productVariantSchema>;

/** One image in the admin editor gallery (GET /admin/products/{id} → images[]). */
export const adminProductImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  renditions: z.record(z.string()).default({}),
  alt_text: z.string(),
  is_primary: z.boolean().default(false),
  display_order: z.number().default(0),
  // The `color` attribute option this image represents (FR-CAT-032). null/absent = untagged.
  color_option_id: z.string().nullable().optional(),
});
export type AdminProductImage = z.infer<typeof adminProductImageSchema>;

/**
 * One configurable-attribute group on the admin product detail
 * (GET /admin/products/{id} → configurable_attributes[]). The editor uses the
 * `color` group's options to populate the per-image color-tag select (and its
 * swatch). BE may not return it yet → the editor degrades (hides the select).
 */
export const configurableAttributeSchema = z.object({
  code: z.string(),
  label: z.string().optional(),
  options: z
    .array(
      z.object({
        id: z.string(),
        value: z.string(),
        swatch_type: z.string().nullable().optional(),
        swatch_value: z.string().nullable().optional(),
      }),
    )
    .default([]),
});
export type ConfigurableAttribute = z.infer<typeof configurableAttributeSchema>;

/** One product video (GET /admin/products/{id} → videos[], ordered after images). */
export const adminProductVideoSchema = z.object({
  id: z.string(),
  source: z.enum(["url", "upload"]).default("url"),
  url: z.string(),
  display_order: z.number().default(0),
});
export type AdminProductVideo = z.infer<typeof adminProductVideoSchema>;

/** `{ id }` returned by POST /admin/products/{id}/videos. */
export const addVideoResultSchema = z.object({
  id: z.string(),
  // Backend now returns the stored video link (Cloudinary URL for an upload) + source/order.
  source: z.string().optional(),
  url: z.string().optional(),
  display_order: z.number().optional(),
});

/** One linked product item (GET /admin/products/{id} → links.{related,up_sell,cross_sell}[]). */
export const productLinkItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().nullable().optional(),
  primary_image: z.string().nullable().optional(),
});
export type ProductLinkItem = z.infer<typeof productLinkItemSchema>;

/** Typed product links on the detail. BE may not return it yet → all default []. */
export const productLinksSchema = z.object({
  related: z.array(productLinkItemSchema).default([]),
  up_sell: z.array(productLinkItemSchema).default([]),
  cross_sell: z.array(productLinkItemSchema).default([]),
});
export type ProductLinks = z.infer<typeof productLinksSchema>;

export const productDetailSchema = z.object({
  id: z.string(),
  type: z.enum(["simple", "configurable"]).default("simple"),
  family: z.string().nullable().optional(),
  family_id: z.string().nullable().optional(),
  name: z.string(),
  slug: z.string().optional(),
  sku: z.string().optional(),
  brand: z.string().nullable().optional(),
  short_description: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  base_price: z.string().optional(),
  sale_price: z.string().nullable().optional(),
  sale_starts_at: z.string().nullable().optional(),
  sale_ends_at: z.string().nullable().optional(),
  is_featured: z.boolean().default(false),
  is_new: z.boolean().default(false),
  status: productStatusSchema.default("draft"),
  primary_category_id: z.string().nullable().optional(),
  // Additional browsing categories (BR-CAT-2). Contract accepts `category_ids` on
  // create/update; the BE may not return it yet → default [] so the UI degrades.
  category_ids: z.array(z.string()).default([]),
  primary_image_id: z.string().nullable().optional(),
  images: z.array(adminProductImageSchema).default([]),
  // Configurable-attribute groups (e.g. `color`) — source for the per-image
  // color-tag select. BE may not return it yet → default [] so the UI degrades.
  configurable_attributes: z.array(configurableAttributeSchema).default([]),
  // Product videos (ordered after images). BE may not return it yet → default [].
  videos: z.array(adminProductVideoSchema).default([]),
  // Typed product links. BE may not return it yet → groups default to [].
  links: productLinksSchema.default({ related: [], up_sell: [], cross_sell: [] }),
  // Shipping weight (kg). Contract create body carries `weight`; nullable here so
  // it round-trips once the BE returns it on the detail.
  weight: z.string().nullable().optional(),
  meta_title: z.string().nullable().optional(),
  meta_keywords: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
  // EAV attribute values keyed by attribute code (text/number = string, boolean,
  // multiselect = string[]). The editor's family-driven inputs read/write this.
  attributes: z.record(z.unknown()).default({}),
  variants: z.array(productVariantSchema).default([]),
  updated_at: z.string().optional(),
});
export type ProductDetail = z.infer<typeof productDetailSchema>;

/** `{ id, renditions }` returned by POST /admin/products/{id}/images. */
export const uploadImageResultSchema = z.object({
  id: z.string(),
  renditions: z.record(z.string()).default({}),
});

// ---- Family detail for the product editor (attribute inputs) ----

/** One attribute within a family group, as the editor needs to render its input. */
export const familyAttributeSchema = z.object({
  code: z.string(),
  admin_label: z.string(),
  type: z.string(),
});
export type FamilyAttribute = z.infer<typeof familyAttributeSchema>;

const editorFamilyGroupSchema = z.object({
  name: z.string(),
  attributes: z.array(familyAttributeSchema).default([]),
});

/** Family detail reshaped for the editor: groups → their attribute lists. */
export const editorFamilyDetailSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  groups: z.array(editorFamilyGroupSchema).default([]),
});
export type EditorFamilyDetail = z.infer<typeof editorFamilyDetailSchema>;

export const createProductResultSchema = z.object({ id: z.string(), slug: z.string().optional(), type: z.string().optional(), status: z.string().optional() });
export const generateVariantsResultSchema = z.object({ variants_created: z.number().optional(), variants: z.array(productVariantSchema).default([]) });
