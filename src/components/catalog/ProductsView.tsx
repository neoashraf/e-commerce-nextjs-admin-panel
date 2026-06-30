"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowUpCircle,
  Box,
  Download,
  Info,
  Layers,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  useProducts,
  useProductStatus,
  useBulkProductStatus,
  useDeleteProduct,
  useFamilies,
  useCategoryTree,
} from "@/lib/api/hooks/useCatalog";
import type {
  ProductRow,
  CategoryNode,
  QtyStatus,
} from "@/lib/api/schemas/catalog";
import { productListSchema } from "@/lib/api/schemas/catalog";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { formatBDT } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/media";
import { toast } from "@/lib/stores/toast";
import { usePageParams } from "@/lib/usePageParams";
import { useDebouncedCallback } from "@/lib/useDebouncedCallback";
import { buildCsv, downloadCsv, fetchAllRows, todayStamp } from "@/lib/exportCsv";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { CreateProductDialog } from "@/components/catalog/CreateProductDialog";
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
  type SortDir,
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

/** Live INV qty-status → label + cell color (design QHINT). */
const QTY_HINT: Record<QtyStatus, { label: string; tone: string }> = {
  in_stock: { label: "In stock", tone: "text-success" },
  low_stock: { label: "Low", tone: "text-warning" },
  out_of_stock: { label: "Out", tone: "text-error" },
};

/** Client-side sort key (the list API has no sort param yet — we sort the
 * current page). `null` = server order. */
type SortKey = "name" | "price" | "status";

/** Row "⋯" menu item (matches OrderRowMenu / the §8.6 actions cell). */
const menuItemCls =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-subtle";

/** Effective (sortable) price of a row — sale price when active, else base. */
function effectivePrice(p: ProductRow): number {
  const raw = p.sale_active && p.sale_price ? p.sale_price : p.base_price;
  return raw ? Number(raw) : 0;
}

const STATUS_RANK: Record<ProductRow["status"], number> = {
  draft: 0,
  published: 1,
  archived: 2,
};

/**
 * Products list (products-list.md, Products (CAT) design). AD6 data table:
 * Card-wrapped table, eyebrow headers, StatusPill, right-aligned numerics,
 * paginated footer. URL-reflected search + status/family/category/type filters
 * + page. Features: row checkboxes + bulk publish/archive bar (per-item result
 * summary), live qty + In/Low/Out stock status, struck base + sale price,
 * type-icon pills, client-side column sort (Name/Price/Status over the current
 * page), debounced search with a clear button, a Create-Product modal, and the
 * row ••• menu (Edit · Publish[draft/archived] · Archive[published] · Delete)
 * with NOT_PUBLISHABLE (422) + PRODUCT_IN_ORDER (409) guards.
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
  const bulkM = useBulkProductStatus();
  const del = useDeleteProduct();
  const [confirm, setConfirm] = useState<{ kind: "archive" | "delete"; product: ProductRow } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const rows = useMemo(() => data?.data ?? [], [data]);
  const total = data?.meta.total ?? 0;
  const categoryOptions = flattenCategories(categoryTree ?? []);
  const [exporting, setExporting] = useState(false);

  // Sort the current page client-side (the list endpoint has no sort param yet;
  // BE gap noted in the PR). `null` key keeps the server order.
  const sortedRows = useMemo(() => {
    if (!sortKey || !sortDir) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "price") { av = effectivePrice(a); bv = effectivePrice(b); }
      else if (sortKey === "status") { av = STATUS_RANK[a.status]; bv = STATUS_RANK[b.status]; }
      else { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, sortKey, sortDir]);

  /** Toggle a column's sort: first click asc (price → desc), then flip, all
   * client-side. Clicking a new column resets direction. */
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "price" ? "desc" : "asc");
    }
  }
  const sortOf = (key: SortKey): SortDir => (sortKey === key ? sortDir : null);

  // ---- selection (bulk) ----
  const selectableIds = sortedRows.map((r) => r.id);
  const allChecked = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someChecked = selectableIds.some((id) => selected.has(id));
  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      const all = selectableIds.every((id) => next.has(id));
      if (all) selectableIds.forEach((id) => next.delete(id));
      else selectableIds.forEach((id) => next.add(id));
      return next;
    });
  }
  function clearSelection() { setSelected(new Set()); }

  /**
   * Bulk publish/archive the selected rows → PATCH /admin/products/bulk-status.
   * The batch never aborts; show a per-item summary (n published / m couldn't,
   * with the blocked names) from `results[]`. On success the list invalidates.
   */
  async function runBulk(targetStatus: "published" | "archived") {
    const ids = selectableIds.filter((id) => selected.has(id));
    if (ids.length === 0) return;
    try {
      const res = await bulkM.mutateAsync({ ids, status: targetStatus });
      const verb = targetStatus === "published" ? "published" : "archived";
      if (res.failed === 0) {
        toast(`${res.succeeded} ${res.succeeded === 1 ? "product" : "products"} ${verb}.`);
      } else {
        const blocked = res.results
          .filter((r) => !r.ok)
          .map((r) => rows.find((p) => p.id === r.id)?.name ?? r.id);
        const sample = blocked.slice(0, 3).join(", ");
        const more = blocked.length > 3 ? ` +${blocked.length - 3} more` : "";
        toast(
          `${res.succeeded} ${verb}, ${res.failed} couldn’t be — ${sample}${more}. Check required fields.`,
          "error",
        );
      }
      clearSelection();
    } catch {
      toast("Couldn’t apply the bulk action. Try again.", "error");
    }
  }

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
        ["SKU", "Name", "Type", "Family", "Category", "Base price", "Sale price", "Status", "Qty"],
        all.map((p) => [
          p.sku ?? "",
          p.name,
          p.type ?? "simple",
          p.family ?? "",
          p.primary_category ?? "",
          p.base_price ?? "",
          p.sale_active && p.sale_price ? p.sale_price : "",
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

  // Search is debounced (~300ms) so each keystroke doesn't refetch; the clear
  // button (X) resets it immediately. Both write `q` into the URL.
  const debouncedSearch = useDebouncedCallback((value: string) => setParam("q", value), 300);

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
  async function unarchive(p: ProductRow) {
    try {
      // Bring an archived product back as a draft — admin reviews + re-publishes from there.
      await statusM.mutateAsync({ id: p.id, status: "draft" });
      toast("Product unarchived — it's now a draft.");
    } catch {
      toast("Couldn't unarchive. Try again.", "error");
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
      setSelected((prev) => { const next = new Set(prev); next.delete(confirm.product.id); return next; });
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

  const selectedCount = selectableIds.filter((id) => selected.has(id)).length;

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
            <Button onClick={() => setCreateOpen(true)}>Create product</Button>
          </Can>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <Input
            leadingIcon={<Search className="h-4 w-4" />}
            placeholder="Search by name or SKU…"
            aria-label="Search products"
            defaultValue={q}
            onChange={(e) => debouncedSearch(e.target.value)}
            trailing={
              q ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setParam("q", "")}
                  className="flex h-5 w-5 items-center justify-center rounded text-text-faint hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : undefined
            }
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
        {/* Bulk action bar — appears once a row is selected (FR-CAT-015/016). */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-3 border-b border-accent-100 bg-accent-50 px-4 py-2.5">
            <span className="text-sm font-semibold tabular-nums text-accent-700">
              {selectedCount} selected
            </span>
            <span className="h-4 w-px bg-accent-100" aria-hidden="true" />
            <Can permission="catalog.product.update">
              <button
                type="button"
                onClick={() => runBulk("published")}
                disabled={bulkM.isPending}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-accent-600 bg-surface px-3 text-[13px] font-semibold text-accent-700 hover:bg-accent-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
              >
                <ArrowUpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Publish
              </button>
              <button
                type="button"
                onClick={() => runBulk("archived")}
                disabled={bulkM.isPending}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-[13px] font-semibold text-text-secondary hover:bg-surface-subtle disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
              >
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                Archive
              </button>
            </Can>
            <button
              type="button"
              onClick={clearSelection}
              className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-text-muted hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          </div>
        )}

        {isLoading ? (
          <SkeletonRows rows={10} cols={8} />
        ) : isError ? (
          <ErrorState description="Couldn't load products." onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No products match these filters." description="Try a different status or clear the filters above." />
        ) : (
          <>
            <Table>
              <THead>
                <TR hover={false}>
                  <TH className="w-12">
                    <Checkbox
                      checked={allChecked}
                      indeterminate={!allChecked && someChecked}
                      onChange={toggleAll}
                      aria-label="Select all products"
                    />
                  </TH>
                  <TH sort={sortOf("name")} onSort={() => toggleSort("name")}>Product</TH>
                  <TH numeric sort={sortOf("price")} onSort={() => toggleSort("price")}>Price</TH>
                  <TH numeric>Qty</TH>
                  <TH sort={sortOf("status")} onSort={() => toggleSort("status")}>Status</TH>
                  <TH>Category</TH>
                  <TH>Type</TH>
                  <TH className="text-right"><span className="sr-only">Actions</span></TH>
                </TR>
              </THead>
              <TBody>
                {sortedRows.map((p) => {
                  const onSale = !!(p.sale_active && p.sale_price);
                  const hint = p.qty_status ? QTY_HINT[p.qty_status] : null;
                  return (
                  <TR key={p.id} className={selected.has(p.id) ? "bg-accent-50" : undefined}>
                    <TD onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(p.id)}
                        onChange={() => toggleRow(p.id)}
                        aria-label={`Select ${p.name}`}
                      />
                    </TD>
                    <TD>
                      <div className="flex items-center gap-3">
                        <span className="h-10 w-10 shrink-0 overflow-hidden rounded bg-surface-subtle">
                          {p.primary_image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={resolveMediaUrl(p.primary_image)} alt="" className="h-full w-full object-cover" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <Link href={`/admin/products/${p.id}`} className="block truncate font-medium text-text hover:text-accent-600 hover:underline">{p.name}</Link>
                          <span className="block truncate text-xs text-text-muted">{p.sku ?? "—"}{p.family ? ` · ${p.family}` : ""}</span>
                        </span>
                      </div>
                    </TD>
                    <TD numeric className="text-text">
                      <div className="flex flex-col items-end leading-tight">
                        {onSale && (
                          <span className="text-xs text-text-muted line-through">{formatBDT(Number(p.base_price))}</span>
                        )}
                        <span className="font-semibold">
                          {onSale ? formatBDT(Number(p.sale_price)) : p.base_price ? formatBDT(Number(p.base_price)) : "—"}
                        </span>
                      </div>
                    </TD>
                    <TD numeric>
                      {p.qty == null ? (
                        <span title="Stock unavailable — couldn't reach Inventory." className="inline-flex cursor-help items-center justify-end gap-1.5 text-text-faint">
                          <span>—</span>
                          <Info className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      ) : (
                        <span className="flex flex-col items-end leading-tight">
                          <span className={`font-semibold ${hint?.tone ?? "text-text"}`}>{p.qty}</span>
                          {hint && <span className={`text-[10.5px] font-semibold ${hint.tone}`}>{hint.label}</span>}
                        </span>
                      )}
                    </TD>
                    <TD><StatusPill status={p.status} /></TD>
                    <TD>{p.primary_category ?? "—"}</TD>
                    <TD>
                      <Badge tone="neutral" className="capitalize">
                        <span className="inline-flex items-center gap-1.5">
                          {p.type === "configurable"
                            ? <Layers className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
                            : <Box className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />}
                          {p.type ?? "simple"}
                        </span>
                      </Badge>
                    </TD>
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
                                {(p.status === "draft" || p.status === "archived") && (
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
                                {p.status === "archived" && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => { close(); unarchive(p); }}
                                    className={menuItemCls}
                                  >
                                    <ArchiveRestore className="h-4 w-4 text-text-muted" aria-hidden="true" />
                                    Unarchive
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
                  );
                })}
              </TBody>
            </Table>
            <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        )}
      </Card>

      <CreateProductDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === "archive" ? "Archive product?" : "Delete product?"}
        message={confirm?.kind === "archive" ? `"${confirm?.product.name}" will be hidden from the storefront but kept for order history.` : `"${confirm?.product.name}" will be deleted. This can't be undone.`}
        confirmLabel={confirm?.kind === "archive" ? "Archive" : "Delete"}
        danger
        pending={statusM.isPending || del.isPending}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
