"use client";

import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { paginated } from "@/lib/api/schemas/pagination";

/**
 * Admin customers hooks + schemas (cust-fe). Read-only 360 + notes/tags/status.
 *
 * The backend follows docs/api-contracts/12-customers.md, which names the
 * identity fields `customer_id` / `full_name` (not `id` / `name`). We accept
 * the contract field names off the wire and normalise them to `id` / `name`
 * here so the views have one stable shape. `customer_id` is nullable for guest
 * rows in the contract, so it is coerced to "" rather than left null.
 */
export const customerRowSchema = z
  .object({
    customer_id: z.string().nullable().optional(),
    full_name: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    status: z.string().default("active"),
    tags: z.array(z.string()).default([]),
    order_count: z.number().optional(),
    total_spent: z.string().optional(),
    last_order_at: z.string().nullable().optional(),
    is_guest: z.boolean().optional(),
  })
  .transform(({ customer_id, full_name, ...rest }) => ({
    id: customer_id ?? "",
    name: full_name ?? null,
    ...rest,
  }));
export type CustomerRow = z.infer<typeof customerRowSchema>;
const customerListSchema = z.array(customerRowSchema);

/**
 * Customer 360 profile. The contract returns richer fields (aggregates,
 * recent_orders) than the list row; we read the ones the detail view uses and
 * normalise the identity fields the same way as the row.
 */
export const customerDetailSchema = z
  .object({
    customer_id: z.string().nullable().optional(),
    full_name: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    status: z.string().default("active"),
    tags: z.array(z.string()).default([]),
    // The contract nests order metrics under `aggregates` on the 360 profile
    // (unlike the flat list row). Flatten the three the view shows to the top.
    aggregates: z
      .object({
        order_count: z.number().optional(),
        total_spent: z.string().optional(),
        last_order_at: z.string().nullable().optional(),
      })
      .partial()
      .optional(),
    notes: z.array(z.object({ id: z.string().optional(), body: z.string(), created_at: z.string().optional() })).default([]),
    recent_orders: z.array(z.object({ order_no: z.string(), grand_total: z.string().optional(), status: z.string().optional(), placed_at: z.string().optional() })).default([]),
    // Bound by the 360 detail view — were previously dropped (missing from the schema → stripped by zod).
    addresses: z
      .array(
        z.object({
          id: z.string().optional(),
          address_line: z.string().optional(),
          district: z.string().nullable().optional(),
          is_default: z.boolean().optional(),
        }),
      )
      .default([]),
    leads: z
      .array(
        z.object({
          reference: z.string(),
          type: z.string().optional(),
          status: z.string().optional(),
        }),
      )
      .default([]),
    wishlist_count: z.number().optional(),
  })
  .transform(({ customer_id, full_name, aggregates, ...rest }) => ({
    id: customer_id ?? "",
    name: full_name ?? null,
    order_count: aggregates?.order_count,
    total_spent: aggregates?.total_spent,
    last_order_at: aggregates?.last_order_at ?? null,
    ...rest,
  }));
export type CustomerDetail = z.infer<typeof customerDetailSchema>;

export function useCustomers(params: Record<string, string | number | boolean | undefined>) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: ["admin-customers", qs] as const,
    queryFn: (): Promise<CustomerRow[]> => api.get("/admin/customers", { schema: customerListSchema, params }) as Promise<CustomerRow[]>,
    staleTime: 20_000,
  });
}

/** Paginated `{ data, meta }` variant for the directory list (drives the shared TablePagination footer). */
const customerPageSchema = paginated(customerListSchema);
export type CustomerPage = z.infer<typeof customerPageSchema>;

export function useCustomersPage(params: Record<string, string | number | boolean | undefined>) {
  const qs = JSON.stringify(params);
  return useQuery({
    queryKey: ["admin-customers", qs] as const,
    queryFn: (): Promise<CustomerPage> =>
      api.get("/admin/customers", { schema: customerPageSchema, params, rawEnvelope: true }) as Promise<CustomerPage>,
    staleTime: 20_000,
  });
}
export function useCustomer(id: string) {
  return useQuery({
    queryKey: ["admin-customer", id] as const,
    enabled: !!id,
    queryFn: (): Promise<CustomerDetail> => api.get(`/admin/customers/${id}`, { schema: customerDetailSchema }) as Promise<CustomerDetail>,
    staleTime: 30_000,
  });
}
export function useAddNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post(`/admin/customers/${id}/notes`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-customer", id] }),
  });
}
export function useCustomerStatus(id: string) {
  const qc = useQueryClient();
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["admin-customer", id] }); qc.invalidateQueries({ queryKey: ["admin-customers"] }); };
  return {
    suspend: useMutation({ mutationFn: () => api.post(`/admin/customers/${id}/suspend`), onSuccess: invalidate }),
    reactivate: useMutation({ mutationFn: () => api.post(`/admin/customers/${id}/reactivate`), onSuccess: invalidate }),
  };
}

// ── Tags (FR-CUST-031): catalog + assign/unassign (POST/DELETE /admin/customers/{id}/tags) ──
export const customerTagSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  color: z.string().nullable().optional(),
});
export type CustomerTag = z.infer<typeof customerTagSchema>;
const customerTagListSchema = z.array(customerTagSchema);

/** The customer tag catalog (GET /admin/customer-tags) — keyed by `customers.tag.manage`. */
export function useCustomerTags(enabled = true) {
  return useQuery({
    queryKey: ["admin-customer-tags"] as const,
    enabled,
    queryFn: (): Promise<CustomerTag[]> =>
      api.get("/admin/customer-tags", { schema: customerTagListSchema }) as Promise<CustomerTag[]>,
    staleTime: 5 * 60_000,
  });
}

/** Create a tag in the catalog (POST /admin/customer-tags) → returns the new TagDto (with its id). */
export function useCreateCustomerTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { key: string; label: string; color?: string }) =>
      api.post("/admin/customer-tags", body, { schema: customerTagSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-customer-tags"] }),
  });
}

/**
 * Assign a tag to one or more customers (idempotent per the contract). Customer rows/detail
 * carry tag **keys**, but assignment needs the tag **id**, so callers pass the resolved
 * `tag_id`. Invalidates the affected customer(s) + the directory so the chips refresh.
 */
export function useAssignCustomerTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, tagId }: { customerId: string; tagId: string }) =>
      api.post(`/admin/customers/${customerId}/tags`, { tag_id: tagId }),
    onSuccess: (_d, { customerId }) => {
      qc.invalidateQueries({ queryKey: ["admin-customer", customerId] });
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
  });
}

export function useUnassignCustomerTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, tagId }: { customerId: string; tagId: string }) =>
      api.delete(`/admin/customers/${customerId}/tags/${tagId}`),
    onSuccess: (_d, { customerId }) => {
      qc.invalidateQueries({ queryKey: ["admin-customer", customerId] });
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
  });
}

// ── Wishlist items (admin) — FE-ready; the admin endpoint does not exist yet (BE ask).
// GET /admin/customers/{id}/wishlist → items. Schema optional-accepts so it degrades to
// the count-only/empty panel until BE ships it; lights up automatically when present.
export const wishlistItemSchema = z.object({
  product_id: z.string().nullable().optional(),
  product_title: z.string().nullable().optional(),
  product_image: z.string().nullable().optional(),
  variant_options: z.record(z.string()).nullable().optional(),
  price: z.string().nullable().optional(),
  in_stock: z.boolean().nullable().optional(),
  added_at: z.string().nullable().optional(),
});
export type WishlistItem = z.infer<typeof wishlistItemSchema>;
const wishlistListSchema = z.array(wishlistItemSchema);

export function useCustomerWishlist(id: string, enabled = true) {
  return useQuery({
    queryKey: ["admin-customer-wishlist", id] as const,
    enabled: enabled && !!id,
    // The endpoint may not exist yet → treat any error as "no items" (panel degrades to count).
    queryFn: async (): Promise<WishlistItem[]> => {
      try {
        return (await api.get(`/admin/customers/${id}/wishlist`, {
          schema: wishlistListSchema,
        })) as WishlistItem[];
      } catch {
        return [];
      }
    },
    retry: false,
    staleTime: 30_000,
  });
}

// ── CSV export (async: POST /admin/customers/export → poll GET …/export/{id}) ──
const customerExportAcceptedSchema = z.object({ export_id: z.string(), status: z.string() });
const customerExportStatusSchema = z.object({
  status: z.string(),
  download_url: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
});
export type CustomerExportStatus = z.infer<typeof customerExportStatusSchema>;

export function useCreateCustomerExport() {
  return useMutation({
    mutationFn: (body: { filters: Record<string, unknown>; fields: string[] }) =>
      api.post("/admin/customers/export", body, { schema: customerExportAcceptedSchema }),
  });
}
export function useCustomerExportStatus(exportId: string | null) {
  return useQuery({
    queryKey: ["admin-customer-export", exportId ?? ""] as const,
    enabled: !!exportId,
    queryFn: (): Promise<CustomerExportStatus> =>
      api.get(`/admin/customers/export/${exportId}`, { schema: customerExportStatusSchema }) as Promise<CustomerExportStatus>,
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 2500 : false),
  });
}
