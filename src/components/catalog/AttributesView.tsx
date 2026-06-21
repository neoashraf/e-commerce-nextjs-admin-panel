"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useAttributes, useDeleteAttribute } from "@/lib/api/hooks/useCatalog";
import type { AttributeRow } from "@/lib/api/schemas/catalog";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { usePageParams } from "@/lib/usePageParams";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  SkeletonRows,
  Table,
  TablePagination,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";

/**
 * Attributes list (catalog-attributes-fe) on the AD6 Data Table primitive
 * (design-system §8.6): Card-wrapped table, eyebrow headers, centered ✓/— flags,
 * and a 15/page paginated footer backed by the API `meta.total`. Search + type
 * filter + `page` URL-reflected; delete with ATTRIBUTE_IN_USE / SYSTEM_ATTRIBUTE
 * guard toasts. Behaviour unchanged — presentation + pagination only.
 */
function Flag({ on }: { on?: boolean }) {
  return <span className={on ? "text-success" : "text-text-faint"} aria-label={on ? "yes" : "no"}>{on ? "✓" : "—"}</span>;
}

export function AttributesView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const type = sp.get("type") ?? "";
  const q = sp.get("q") ?? "";
  const { page, pageSize, setPage, setPageSize } = usePageParams();

  const { data, isLoading, isError, refetch } = useAttributes({
    type: type || undefined,
    q: q || undefined,
    page,
    limit: pageSize,
  });
  const del = useDeleteAttribute();
  const [target, setTarget] = useState<AttributeRow | null>(null);
  const [guard, setGuard] = useState<string | null>(null);

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page"); // filter/search change → back to page 1
    router.push(`${pathname}?${next.toString()}`);
  }

  async function onDelete() {
    if (!target) return;
    try {
      await del.mutateAsync(target.id);
      setTarget(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === "ATTRIBUTE_IN_USE") setGuard("This attribute is in use by products. Disable it instead of deleting.");
      else if (err instanceof ApiError && err.code === "SYSTEM_ATTRIBUTE") setGuard("System attributes can't be deleted.");
      else setGuard("Couldn't delete this attribute. Try again.");
      setTarget(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold leading-7 text-text">Attributes</h1>
        <Can permission="catalog.attribute.create">
          <Link
            href="/admin/attributes/new"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent-600 px-4 text-sm font-medium text-accent-fg shadow-xs transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
          >
            New attribute
          </Link>
        </Can>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <Input
            leadingIcon={<Search className="h-4 w-4" />}
            placeholder="Search code or label…"
            aria-label="Search attributes"
            defaultValue={q}
            onKeyDown={(e) => e.key === "Enter" && setParam("q", (e.target as HTMLInputElement).value)}
          />
        </div>
        <div className="w-40">
          <Select aria-label="Type" value={type} onChange={(e) => setParam("type", e.target.value)}>
            <option value="">All types</option>
            {["text", "select", "multiselect", "boolean", "number", "price", "date"].map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
      </div>

      {guard && <p role="alert" className="rounded-md bg-warning-50 px-3 py-2 text-sm text-warning">{guard}</p>}

      <Card>
        {isLoading ? (
          <SkeletonRows rows={10} cols={8} />
        ) : isError ? (
          <ErrorState description="Couldn't load attributes." onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No attributes match your filters." description="Try clearing search or the type filter." />
        ) : (
          <>
            <Table>
              <THead>
                <TR hover={false}>
                  <TH>Code</TH>
                  <TH>Label</TH>
                  <TH>Type</TH>
                  <TH className="text-center">Req</TH>
                  <TH className="text-center">Filter</TH>
                  <TH className="text-center">Config</TH>
                  <TH>Created</TH>
                  <TH className="text-right"><span className="sr-only">Actions</span></TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-mono text-xs text-text-secondary">{a.code}</TD>
                    <TD className="font-medium text-text">
                      {a.admin_label}
                      {a.is_user_defined === false && <Badge tone="neutral" className="ml-2">System</Badge>}
                    </TD>
                    <TD><Badge tone="neutral">{a.type}</Badge></TD>
                    <TD className="text-center"><Flag on={a.is_required} /></TD>
                    <TD className="text-center"><Flag on={a.is_filterable} /></TD>
                    <TD className="text-center">{a.type === "select" ? <Flag on={a.is_configurable} /> : <span className="text-text-faint">—</span>}</TD>
                    <TD className="text-text-muted">{a.created_at ? formatDate(a.created_at) : "—"}</TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Can permission="catalog.attribute.update">
                          <Link href={`/admin/attributes/${a.id}`} className="text-sm font-medium text-accent-700 hover:underline">Edit</Link>
                        </Can>
                        {a.is_user_defined !== false && (
                          <Can permission="catalog.attribute.delete">
                            <button type="button" onClick={() => setTarget(a)} className="text-sm font-medium text-error hover:underline">Delete</button>
                          </Can>
                        )}
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
        open={!!target}
        title="Delete attribute?"
        message={`"${target?.admin_label}" will be deleted.`}
        confirmLabel="Delete"
        danger
        pending={del.isPending}
        onConfirm={onDelete}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}
