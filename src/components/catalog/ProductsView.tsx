"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, ArrowUpCircle, Download, Pencil, Search, Trash2 } from "lucide-react";
import {
  useProducts,
  useProductStatus,
  useDeleteProduct,
  useFamilies,
  useCategoryTree,
} from "@/lib/api/hooks/useCatalog";
import type { ProductRow, CategoryNode } from "@/lib/api/schemas/catalog";
import { productListSchema } from "@/lib/api/schemas/catalog";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { formatBDT } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/media";
import { toast } from "@/lib/stores/toast";
import { usePageParams } from "@/lib/usePageParams";
import { buildCsv, downloadCsv, fetchAllRows, todayStamp } from "@/lib/exportCsv";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  RowActions,
  SegmentedControl,
  Select,
  SkeletonRows,
  StatusPill,
  Table,
  TablePagination,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";

/** Flatten the category tree into indented options for the filter select
 * (mirrors the design's "All categories" tree dropdown). Each level is
 * indented with non-breaking spaces; the API filters on slug or id. */
function flattenCategories(
  nodes: CategoryNode[],
  depth = 0,
): { value: string; label: string }[] {
  return nodes.flatMap((n) => [
    {
      value: n.slug ?? n.id,
      label: `${"   ".repeat(depth)}${n.name}`,
    },
    ...flattenCategories(n.children ?? [], depth + 1),
  ]);
}

const TYPE_SEGMENTS = [
  { value: "", label: "All" },
  { value: "simple", label: "Simple" },
  { value: "configurable", label: "Configurable" },
] as const;

/** Row "⋯" menu item (matches OrderRowMenu / the §8.6 actions cell). */
const menuItemCls =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-subtle";

/**
 * Products list (products-list.md, catalog-products-list-fe) on the AD6 Data Table
 * primitive (design-system §8.6): Card-wrapped table, eyebrow headers, StatusPill,
 * right-aligned numerics, and a 15/page paginated footer backed by the API
 * `meta.total`. URL-reflected search + status/family/type filters + `page`; row
 * actions (publish/archive/delete) with NOT_PUBLISHABLE (422) + PRODUCT_IN_ORDER
 * (409) guards. Behaviour unchanged — presentation + pagination only.
 */
export function ProductsView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "";
  const family = sp.get("family") ?? "";
  const type = sp.get("type") ?? "";
  const category = sp.get("category") ?? "";
  const q = sp.get("q") ?? "";
  const { page, pageSize, setPage, setPageSize } = usePageParams();

  const { data, isLoading, isError, refetch } = useProducts({
    q: q || undefined, status: status || undefined, family: family || undefined, type: type || undefined, category: category || undefined, page, limit: pageSize,
  });
  const { data: families } = useFamilies();
  const { data: categoryTree } = useCategoryTree();
  const statusM = useProductStatus();
  const del = useDeleteProduct();
  const [confirm, setConfirm] = useState<{ kind: "archive" | "delete"; product: ProductRow } | null>(null);

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const categoryOptions = flattenCategories(categoryTree ?? []);
  const [exporting, setExporting] = useState(false);

  /**
   * Export the current filtered result set as CSV (products-list design + API
   * contract GET /admin/products/export). Built client-side — fetch every page
   * of the filtered list, then serialize + download — so it carries the admin's
   * auth and matches the on-screen filters exactly.
   */
  async function exportCsv() {
    if (exporting) return;
    setExporting(true);
    try {
      const all = await fetchAllRows(
        "/admin/products",
        { q, status, family, type, category },
        productListSchema,
      );
      const csv = buildCsv(
        ["SKU", "Name", "Type", "Family", "Category", "Base price", "Status", "Qty"],
        all.map((p) => [
          p.sku ?? "",
          p.name,
          p.type ?? "simple",
          p.family ?? "",
          p.primary_category ?? "",
          p.base_price ?? "",
          p.status,
          p.qty ?? "",
        ]),
      );
      downloadCsv(`products-${todayStamp()}.csv`, csv);
    } catch {
      toast("Couldn't export products. Try again.", "error");
    } finally {
      setExporting(false);
    }
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page"); // filter/search change → back to page 1
    router.push(`${pathname}?${next.toString()}`);
  }

  async function publish(p: ProductRow) {
    try {
      await statusM.mutateAsync({ id: p.id, status: "published" });
      toast("Product published.");
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_PUBLISHABLE") {
        toast("Can't publish yet — add an image, an enabled variant, and required attributes first.", "error");
      } else {
        toast("Couldn't publish. Try again.", "error");
      }
    }
  }
  async function runConfirm() {
    if (!confirm) return;
    try {
      if (confirm.kind === "archive") {
        await statusM.mutateAsync({ id: confirm.product.id, status: "archived" });
        toast("Product archived.");
      } else {
        await del.mutateAsync(confirm.product.id);
        toast("Product deleted.");
      }
      setConfirm(null);
    } catch (err) {
      setConfirm(null);
      if (err instanceof ApiError && err.code === "PRODUCT_IN_ORDER") {
        toast("This product is in an order and can't be deleted. Archive it instead.", "error");
      } else {
        toast("Something went wrong. Try again.", "error");
      }
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-7 text-text">Products</h1>
          <p className="mt-0.5 text-sm tabular-nums text-text-muted">
            {total} {total === 1 ? "product" : "products"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Can permission="catalog.product.read">
            <Button
              variant="secondary"
              onClick={exportCsv}
              loading={exporting}
              leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
            >
              {exporting ? "Exporting…" : "Export"}
            </Button>
          </Can>
          <Can permission="catalog.product.create">
            <Link
              href="/admin/products/new"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent-600 px-4 text-sm font-medium text-accent-fg shadow-xs transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
            >
              Create product
            </Link>
          </Can>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <Input
            leadingIcon={<Search className="h-4 w-4" />}
            placeholder="Search name or SKU…"
            aria-label="Search products"
            defaultValue={q}
            onKeyDown={(e) => e.key === "Enter" && setParam("q", (e.target as HTMLInputElement).value)}
          />
        </div>
        <div className="w-40">
          <Select aria-label="Status" value={status} onChange={(e) => setParam("status", e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        <div className="w-44">
          <Select aria-label="Family" value={family} onChange={(e) => setParam("family", e.target.value)}>
            <option value="">All families</option>
            {families?.map((f) => <option key={f.id} value={f.code}>{f.name}</option>)}
          </Select>
        </div>
        <div className="w-44">
          <Select aria-label="Category" value={category} onChange={(e) => setParam("category", e.target.value)}>
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
        <SegmentedControl
          ariaLabel="Filter by product type"
          options={TYPE_SEGMENTS.map((s) => ({ value: s.value, label: s.label }))}
          value={type}
          onChange={(v) => setParam("type", v)}
        />
        <span className="ml-auto whitespace-nowrap text-sm tabular-nums text-text-muted">
          {total} {total === 1 ? "product" : "products"}
        </span>
      </div>

      <Card>
        {isLoading ? (
          <SkeletonRows rows={10} cols={7} />
        ) : isError ? (
          <ErrorState description="Couldn't load products." onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No products match your filters." description="Try clearing search or widening the filters." />
        ) : (
          <>
            <Table>
              <THead>
                <TR hover={false}>
                  <TH>Product</TH>
                  <TH numeric>Price</TH>
                  <TH numeric>Qty</TH>
                  <TH>Status</TH>
                  <TH>Category</TH>
                  <TH>Type</TH>
                  <TH className="text-right"><span className="sr-only">Actions</span></TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <span className="h-10 w-10 shrink-0 overflow-hidden rounded bg-surface-subtle">
                          {p.primary_image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={resolveMediaUrl(p.primary_image)} alt="" className="h-full w-full object-cover" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <Link href={`/admin/products/${p.id}`} className="block truncate font-medium text-text hover:text-accent-700">{p.name}</Link>
                          <span className="block truncate text-xs text-text-muted">{p.sku ?? "—"}{p.family ? ` · ${p.family}` : ""}</span>
                        </span>
                      </div>
                    </TD>
                    <TD numeric className="text-text">{p.base_price ? formatBDT(Number(p.base_price)) : "—"}</TD>
                    <TD numeric>{p.qty == null ? <span title="Stock unavailable" className="text-text-faint">—</span> : p.qty}</TD>
                    <TD><StatusPill status={p.status} /></TD>
                    <TD>{p.primary_category ?? "—"}</TD>
                    <TD><Badge tone="neutral" className="capitalize">{p.type ?? "simple"}</Badge></TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end">
                        <RowActions label={`Actions for ${p.name}`} width="w-44">
                          {(close) => (
                            <>
                              <Can permission="catalog.product.update">
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => { close(); router.push(`/admin/products/${p.id}`); }}
                                  className={menuItemCls}
                                >
                                  <Pencil className="h-4 w-4 text-text-muted" aria-hidden="true" />
                                  Edit
                                </button>
                                {p.status === "draft" && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => { close(); publish(p); }}
                                    className={menuItemCls}
                                  >
                                    <ArrowUpCircle className="h-4 w-4 text-text-muted" aria-hidden="true" />
                                    Publish
                                  </button>
                                )}
                                {p.status === "published" && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => { close(); setConfirm({ kind: "archive", product: p }); }}
                                    className={menuItemCls}
                                  >
                                    <Archive className="h-4 w-4 text-text-muted" aria-hidden="true" />
                                    Archive
                                  </button>
                                )}
                              </Can>
                              <Can permission="catalog.product.delete">
                                <div className="my-1 h-px bg-border" role="separator" />
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => { close(); setConfirm({ kind: "delete", product: p }); }}
                                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-error hover:bg-error/10"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  Delete
                                </button>
                              </Can>
                            </>
                          )}
                        </RowActions>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === "archive" ? "Archive product?" : "Delete product?"}
        message={confirm?.kind === "archive" ? `"${confirm?.product.name}" will be hidden from the storefront but kept for order history.` : `"${confirm?.product.name}" will be deleted.`}
        confirmLabel={confirm?.kind === "archive" ? "Archive" : "Delete"}
        danger
        pending={statusM.isPending || del.isPending}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
