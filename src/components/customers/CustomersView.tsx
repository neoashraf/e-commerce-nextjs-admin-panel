"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname, useSearchParams } from "next/navigation";
import { Calendar, Check, Download, Search, UserRound, Users } from "lucide-react";
import {
  useCustomersPage,
  useCustomerTags,
  useAssignCustomerTag,
  useCreateCustomerTag,
} from "@/lib/api/hooks/useCustomers";
import { useAsyncExport } from "@/lib/api/hooks/reports";
import { usePageParams } from "@/lib/usePageParams";
import { Can } from "@/lib/permissions/Can";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { formatBDT, formatDate } from "@/lib/format";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/cn";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
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
import { CustomerExportModal } from "./CustomerExportModal";
import { CustomerBulkTagBar } from "./CustomerBulkTagBar";
import { CustomerRowMenu } from "./CustomerRowMenu";
import { TagChips, CUSTOMER_TAG_OPTIONS } from "./TagChips";
import {
  CUSTOMERS_EXPORT_PERMISSION,
  CUSTOMERS_READ_PERMISSION,
  CUSTOMERS_TAG_PERMISSION,
} from "./permissions";

/**
 * Customers directory (CUST) — LIST archetype on the Commerce Admin design system.
 * Tag feature is intentionally omitted (per product). Filters are mapped to the backend
 * query contract (has_orders / last_order_from-to / registration_from-to / include_guests)
 * and URL-reflected. Export is a client-side CSV of the current filtered view.
 */

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  locked: "Locked",
  suspended: "Suspended",
  deleted: "Deleted",
};

/** DD/MM/YYYY (toolbar input) → ISO YYYY-MM-DD for the API; undefined if blank/invalid (so no 400). */
function ddmmyyyyToIso(v: string): string | undefined {
  const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Map the activity dropdown to the backend's order-activity params (fixes the 400). */
function activityParams(a: string): Record<string, string> {
  switch (a) {
    case "has_orders":
      return { has_orders: "true" };
    case "no_orders":
      return { has_orders: "false" };
    case "last_30d":
      return { last_order_from: isoDaysAgo(30) };
    case "last_90d":
      return { last_order_from: isoDaysAgo(90) };
    case "last_1y":
      return { last_order_to: isoDaysAgo(365) };
    default:
      return {};
  }
}

/** Modal field label → backend customer-directory column key (the `customers_list` export). */
const EXPORT_FIELD_KEY: Record<string, string> = {
  Name: "full_name",
  Phone: "phone",
  Email: "email",
  Status: "status",
  Orders: "order_count",
  "Total spent": "total_spent",
  "Last order": "last_order_at",
  "Customer ID": "customer_id",
};

function initials(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  if (/[ঀ-৿]/.test(t)) return t[0];
  return t
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function CustomersView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { can, ready } = usePermissions();

  const status = sp.get("status") ?? "";
  const q = sp.get("q") ?? "";
  const activity = sp.get("activity") ?? "";
  const registeredFrom = sp.get("registered_from") ?? "";
  const registeredTo = sp.get("registered_to") ?? "";
  const includeGuests = sp.get("include_guests") === "1";
  const tag = sp.get("tag") ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const { pageSize, setPageSize } = usePageParams();

  const { data, isLoading, isError, refetch } = useCustomersPage({
    q: q || undefined,
    status: status || undefined,
    tag: tag || undefined,
    ...activityParams(activity),
    registration_from: ddmmyyyyToIso(registeredFrom),
    registration_to: ddmmyyyyToIso(registeredTo),
    include_guests: includeGuests ? "true" : undefined,
    page,
    limit: pageSize,
  });

  const [exportOpen, setExportOpen] = useState(false);
  const rows = useMemo(() => data?.data ?? [], [data]);
  const total = data?.meta.total ?? 0;

  // ── Row selection + bulk tag action (FR-CUST-031). Guests aren't selectable
  //    (no account). Tag assignment is gated on `customers.tag.manage`. ──
  const canTag = can(CUSTOMERS_TAG_PERMISSION);
  const tagsQuery = useCustomerTags(canTag);
  const assignTag = useAssignCustomerTag();
  const createTag = useCreateCustomerTag();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagBusy, setTagBusy] = useState(false);

  const selectableIds = useMemo(
    () => rows.filter((c) => c.id && !c.is_guest).map((c) => c.id),
    [rows],
  );
  const allChecked =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someChecked = selectableIds.some((id) => selected.has(id));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (selectableIds.every((id) => prev.has(id))) {
        const next = new Set(prev);
        selectableIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...selectableIds]);
    });
  }

  /** Assign a catalog tag (by id) to every selected customer (idempotent server-side). */
  async function applyTagToSelected(tagId: string) {
    const ids = [...selected];
    if (ids.length === 0) return;
    setTagBusy(true);
    try {
      await Promise.all(ids.map((customerId) => assignTag.mutateAsync({ customerId, tagId })));
      toast(`Tagged ${ids.length} customer${ids.length === 1 ? "" : "s"}.`);
      setSelected(new Set());
    } catch {
      toast("Couldn't apply the tag to every customer. Try again.", "error");
    } finally {
      setTagBusy(false);
    }
  }

  /** Create a new catalog tag, then assign it to the selection. */
  async function createAndApply(key: string, label: string) {
    setTagBusy(true);
    try {
      const created = await createTag.mutateAsync({ key, label });
      await applyTagToSelected(created.id);
    } catch {
      toast("Couldn't create that tag. Try again.", "error");
      setTagBusy(false);
    }
  }

  /** Filter changes reset to page 1 so we never land on an out-of-range page. */
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(sp.toString());
    if (p > 1) next.set("page", String(p));
    else next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  const { start: startExport, busy: exporting } = useAsyncExport();

  /**
   * Customer-directory CSV via the async reports-export pipeline (POST /admin/reports/export, report
   * `customers_list`), so the file is tracked in the Exports manager (MANAGE › Exports) and auto-downloads
   * when ready. Honours the modal's field selection (sent as `fields`) and the current list filters
   * (q / status / last-order range).
   */
  function confirmExport(fields: string[]) {
    setExportOpen(false);
    const cols = fields.map((f) => EXPORT_FIELD_KEY[f]).filter(Boolean);
    if (cols.length === 0) {
      toast("Select at least one field to export.", "info");
      return;
    }
    const params: Record<string, unknown> = { fields: cols, ...activityParams(activity) };
    if (q) params.q = q;
    if (status) params.status = status;
    const regFrom = ddmmyyyyToIso(registeredFrom);
    const regTo = ddmmyyyyToIso(registeredTo);
    if (regFrom) params.registration_from = regFrom;
    if (regTo) params.registration_to = regTo;
    startExport({ report_key: "customers_list", params, format: "csv" });
    toast("Preparing your CSV — it’ll download and appear in Exports.");
  }

  const resultCount = total;
  const hasFilters = !!(q || status || activity || registeredFrom || registeredTo);

  if (ready && !can(CUSTOMERS_READ_PERMISSION)) {
    return (
      <Card className="p-0">
        <EmptyState
          icon={Users}
          title="No access to customers"
          description="You don’t have permission to view the customer directory."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ===== A. PAGE HEADER ===== */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-[22px] font-bold leading-7 tracking-tight text-text">Customers</h1>
          <p className="mt-0.5 text-[13px] text-text-muted">
            Search, filter and segment the people who shop on the platform.
          </p>
        </div>
        <Can permission={CUSTOMERS_EXPORT_PERMISSION}>
          <Button
            variant="secondary"
            size="md"
            leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setExportOpen(true)}
            disabled={exporting}
          >
            {exporting ? "Exporting…" : "Export"}
          </Button>
        </Can>
      </div>

      {/* ===== B. FILTER / SEARCH TOOLBAR (URL-reflected) ===== */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="min-w-[240px] max-w-[320px] flex-1">
          <Input
            type="search"
            aria-label="Search customers"
            placeholder="Search name, phone, or email…"
            defaultValue={q}
            leadingIcon={<Search className="h-4 w-4" aria-hidden="true" />}
            onKeyDown={(e) =>
              e.key === "Enter" && setParam("q", (e.target as HTMLInputElement).value)
            }
          />
        </div>

        <div className="w-36">
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setParam("status", e.target.value)}
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="locked">Locked</option>
            <option value="suspended">Suspended</option>
            <option value="deleted">Deleted</option>
          </Select>
        </div>

        <div className="w-36">
          <Select
            aria-label="Filter by tag"
            value={tag}
            onChange={(e) => setParam("tag", e.target.value)}
          >
            <option value="">All tags</option>
            {CUSTOMER_TAG_OPTIONS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Registration date-range (DD/MM/YYYY) */}
        <div className="flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2.5">
          <Calendar className="h-[15px] w-[15px] flex-shrink-0 text-text-faint" aria-hidden="true" />
          <input
            type="text"
            inputMode="numeric"
            aria-label="Registered from"
            placeholder="DD/MM/YYYY"
            defaultValue={registeredFrom}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              setParam("registered_from", (e.target as HTMLInputElement).value)
            }
            className="w-[88px] bg-transparent text-[13px] tabular-nums text-text placeholder:text-text-faint focus:outline-none"
          />
          <span className="text-[13px] text-text-faint">–</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label="Registered to"
            placeholder="DD/MM/YYYY"
            defaultValue={registeredTo}
            onKeyDown={(e) =>
              e.key === "Enter" && setParam("registered_to", (e.target as HTMLInputElement).value)
            }
            className="w-[88px] bg-transparent text-[13px] tabular-nums text-text placeholder:text-text-faint focus:outline-none"
          />
        </div>

        <div className="w-44">
          <Select
            aria-label="Filter by order activity"
            value={activity}
            onChange={(e) => setParam("activity", e.target.value)}
          >
            <option value="">Any activity</option>
            <option value="has_orders">Has orders</option>
            <option value="no_orders">No orders</option>
            <option value="last_30d">Last order: 30d</option>
            <option value="last_90d">Last order: 90d</option>
            <option value="last_1y">Last order: 1y+</option>
          </Select>
        </div>

        {/* Include-guests toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={includeGuests}
          aria-label="Include guest contacts"
          onClick={() => setParam("include_guests", includeGuests ? "" : "1")}
          className={cn(
            "inline-flex h-9 items-center gap-2.5 rounded-md border px-3 text-[13px] font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
            includeGuests
              ? "border-accent-600 bg-accent-50 text-accent-700"
              : "border-border-strong bg-surface text-text-secondary hover:bg-surface-subtle",
          )}
        >
          <span
            className={cn(
              "relative h-[18px] w-[30px] flex-shrink-0 rounded-full transition-colors",
              includeGuests ? "bg-accent-600" : "bg-border-strong",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-[14px] w-[14px] rounded-full bg-surface shadow-xs transition-all",
                includeGuests ? "left-[14px]" : "left-0.5",
              )}
            />
          </span>
          Include guests
        </button>

        <span
          aria-live="polite"
          className="ml-auto whitespace-nowrap text-[13px] tabular-nums text-text-muted"
        >
          {resultCount} customers
        </span>
      </div>

      {/* ===== TABLE CARD ===== */}
      <Card className="overflow-hidden p-0">
        {/* Bulk-tag bar — appears when (non-guest) rows are selected; gated on tag.manage. */}
        {canTag && someChecked && (
          <CustomerBulkTagBar
            selectedCount={selected.size}
            tags={tagsQuery.data ?? []}
            busy={tagBusy}
            onApplyTag={applyTagToSelected}
            onCreateTag={createAndApply}
            onClear={() => setSelected(new Set())}
          />
        )}
        {isLoading ? (
          <SkeletonRows rows={8} cols={9} />
        ) : isError ? (
          <ErrorState description="Couldn’t load customers." onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers match these filters."
            description={
              hasFilters ? "Try a different search or clear the filters above." : undefined
            }
          />
        ) : (
          <>
          <div className="overflow-x-auto">
            <Table className="min-w-[920px]">
              <caption className="sr-only">Customers. {resultCount} shown.</caption>
              <THead>
                <TR hover={false}>
                  {canTag && (
                    <TH className="w-11 pr-0">
                      <CustomerCheckBox
                        checked={allChecked}
                        indeterminate={someChecked && !allChecked}
                        onClick={toggleAll}
                        label="Select all customers on this page"
                      />
                    </TH>
                  )}
                  <TH>Name</TH>
                  <TH>Phone</TH>
                  <TH>Email</TH>
                  <TH>Status</TH>
                  <TH>Tags</TH>
                  <TH numeric>Orders</TH>
                  <TH numeric>Total spent</TH>
                  <TH>Last order</TH>
                  <TH className="w-14">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((c, i) => {
                  const name = c.name ?? c.phone ?? c.email ?? "Guest";
                  const isGuest = !!c.is_guest;
                  const orders = c.order_count ?? 0;
                  return (
                    <TR
                      key={c.id || `${c.phone ?? ""}-${c.email ?? ""}-${i}`}
                      className={cn(
                        c.id && "cursor-pointer",
                        c.id && selected.has(c.id) && "bg-accent-50/60",
                      )}
                      onClick={() => c.id && router.push(`/admin/customers/${c.id}`)}
                    >
                      {canTag && (
                        <TD className="pr-0" onClick={(e) => e.stopPropagation()}>
                          {c.id && !isGuest ? (
                            <CustomerCheckBox
                              checked={selected.has(c.id)}
                              onClick={() => toggleRow(c.id)}
                              label={`Select ${name}`}
                            />
                          ) : null}
                        </TD>
                      )}
                      <TD className="max-w-[230px]">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                              isGuest
                                ? "bg-surface-subtle text-text-faint"
                                : "bg-accent-50 text-accent-700",
                            )}
                            aria-hidden="true"
                          >
                            {initials(name)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-text">{name}</div>
                            {isGuest && (
                              <span className="mt-0.5 inline-flex items-center gap-1 rounded-sm bg-surface-subtle px-1.5 py-px text-[10.5px] font-semibold text-text-muted">
                                <UserRound className="h-2.5 w-2.5" aria-hidden="true" />
                                Guest (no account)
                              </span>
                            )}
                          </div>
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap tabular-nums text-[12.5px]">
                        {c.phone ?? "—"}
                      </TD>
                      <TD className="max-w-[200px]">
                        <span className="block truncate text-[12.5px] text-text-muted">
                          {c.email ?? "—"}
                        </span>
                      </TD>
                      <TD>
                        <StatusPill status={c.status} label={STATUS_LABEL[c.status] ?? undefined} />
                      </TD>
                      <TD>
                        <TagChips tags={c.tags} max={2} />
                      </TD>
                      <TD numeric className="text-[13px] text-text-secondary">
                        {orders}
                      </TD>
                      <TD numeric className="whitespace-nowrap text-[13px] font-semibold text-text">
                        {c.total_spent ? formatBDT(Number(c.total_spent)) : "—"}
                      </TD>
                      <TD
                        className={cn(
                          "whitespace-nowrap tabular-nums text-[12.5px]",
                          orders === 0 ? "text-text-faint" : "text-text-muted",
                        )}
                      >
                        {c.last_order_at ? formatDate(c.last_order_at) : "—"}
                      </TD>
                      <TD className="text-right" onClick={(e) => e.stopPropagation()}>
                        {c.id && (
                          <CustomerRowMenu
                            id={c.id}
                            name={name}
                            isGuest={isGuest}
                            onAddTag={() => {
                              setSelected(new Set([c.id]));
                              toast("Customer selected — choose a tag in the bar above.", "info");
                            }}
                          />
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={goPage}
            onPageSizeChange={setPageSize}
          />
          </>
        )}
      </Card>

      <CustomerExportModal
        open={exportOpen}
        resultCount={resultCount}
        onClose={() => setExportOpen(false)}
        onConfirm={confirmExport}
      />
    </div>
  );
}

/** 18px rounded selection checkbox (design's row/select-all box); `indeterminate` shows a dash. */
function CustomerCheckBox({
  checked,
  indeterminate = false,
  onClick,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onClick: () => void;
  label: string;
}) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1",
        on ? "border-accent-600 bg-accent-600 text-accent-fg" : "border-border-strong bg-surface",
      )}
    >
      {indeterminate ? (
        <span className="h-0.5 w-2.5 rounded-full bg-accent-fg" />
      ) : checked ? (
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      ) : null}
    </button>
  );
}
