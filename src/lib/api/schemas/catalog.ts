import { z } from "zod";

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

export const attributeRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  admin_label: z.string(),
  type: z.string().optional(),
  is_filterable: z.boolean().optional(),
  is_configurable: z.boolean().optional(),
  is_required: z.boolean().optional(),
});
export type AttributeRow = z.infer<typeof attributeRowSchema>;
export const attributeListSchema = z.array(attributeRowSchema);
