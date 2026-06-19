import { z } from "zod";

/**
 * Platform list pagination meta — `{ page, limit, total }` (SRS §7). Returned in
 * the `meta` of a paginated list envelope; `total` drives `TablePagination`.
 * Unknown extra meta keys are ignored (zod strips them), so endpoints that add
 * fields (e.g. the notification feed's `unread`) still validate here.
 */
export const paginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/**
 * Wrap a list (array) schema into the raw `{ data, meta }` envelope so a list
 * hook can expose the server's `total` for `TablePagination`. Pair with the api
 * client's `rawEnvelope: true` (it returns the whole envelope instead of `data`).
 */
export function paginated<T extends z.ZodTypeAny>(listSchema: T) {
  return z.object({ data: listSchema, meta: paginationMetaSchema });
}
