import { z } from "zod";

/**
 * Zod schemas for the admin CMS — pages, menus, banners, home sections
 * (docs/api-contracts/13-content.md, Admin sections).
 */

// ---- Pages ----
export const pageRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  is_published: z.boolean().default(false),
  is_system: z.boolean().optional(),
  updated_at: z.string().optional(),
});
export type PageRow = z.infer<typeof pageRowSchema>;
export const pageListSchema = z.array(pageRowSchema);

export const pageDetailSchema = pageRowSchema.extend({
  body: z.string().default(""),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
});
export type PageDetail = z.infer<typeof pageDetailSchema>;

export const createPageResultSchema = z.object({ id: z.string(), slug: z.string().optional(), is_published: z.boolean().optional() });

// ---- Menus ----
export const menuItemSchema: z.ZodType<MenuItem, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    label: z.string(),
    link_type: z.enum(["category", "product", "page", "url"]).catch("url"),
    link_ref: z.string().catch(""),
    display_order: z.number().catch(1),
    children: z.array(menuItemSchema).catch([]),
  }),
);
export interface MenuItem {
  label: string;
  link_type: "category" | "product" | "page" | "url";
  link_ref: string;
  display_order: number;
  children: MenuItem[];
}
export const menuSchema = z.object({ items: z.array(menuItemSchema).catch([]) });

// ---- Banners ----
export const bannerSchema = z.object({
  id: z.string(),
  placement: z.string(),
  image_url: z.string(),
  alt_text: z.string().optional(),
  link_type: z.string().optional(),
  link_ref: z.string().nullable().optional(),
  priority: z.number().optional(),
  is_active: z.boolean().default(true),
});
export type Banner = z.infer<typeof bannerSchema>;
export const bannerListSchema = z.array(bannerSchema);

// ---- Home sections ----
export const homeSectionSchema = z.object({
  id: z.string(),
  type: z.enum(["featured_products", "featured_categories"]),
  title: z.string(),
  item_refs: z.array(z.string()).default([]),
  display_order: z.number().default(1),
  is_published: z.boolean().default(true),
});
export type HomeSection = z.infer<typeof homeSectionSchema>;
export const homeSectionListSchema = z.array(homeSectionSchema);
