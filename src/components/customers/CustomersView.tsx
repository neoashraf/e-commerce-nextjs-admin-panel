"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname, useSearchParams } from "next/navigation";
import { Calendar, Check, Download, Search, UserRound, Users } from "lucide-react";
import { useCustomers, type CustomerRow } from "@/lib/api/hooks/useCustomers";
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
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { CustomerBulkTagBar } from "./CustomerBulkTagBar";
import { CustomerExportModal } from "./CustomerExportModal";
import { CustomerRowMenu } from "./CustomerRowMenu";
import {
  CUSTOMERS_EXPORT_PERMISSION,
  CUSTOMERS_READ_PERMISSION,
  CUSTOMERS_TAG_PERMISSION,
} from "./permissions";

/**
 * Customers directory (CUST) — the LIST archetype on the Commerce Admin design
 * system: page header + Export, a URL-reflected filter toolbar, the AD0 `Table`
 * with select-all + guest markers + semantic status pills + tag chips + tabular
 * ৳ aggregates, a bulk-tag bar on selection (gated on `customers.tag.manage`),
 * and the four async states. Presentation only — the `useCustomers` hook, its
 * data shape, and every permission gate are reused unchanged.
 *
 * Pixel target: docs/design/admin-panel-design-files/Customers (CUST).dc.html.
 */

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  locked: "Locked",
  suspended: "Suspended",
  deleted: "Deleted",
};

/** Quiet, neutral/accent tag chips — color carries no extra meaning (design §8.7). */
const TAG_STYLE: Record<string, { bg: string; fg: string; dot: string }> = {
  VIP: { bg: "#FEF3C7", fg: "#92400E", dot: "#D97706" },
  Wholesale: { bg: "var(--accent-50)", fg: "var(--accent-700)", dot: "var(--accent-600)" },
  Repeat: { bg: "#F0FDF4", fg: "#15803D", dot: "#16A34A" },
  Newsletter: { bg: "#F1F5F9", fg: "#475569", dot: "#94A3B8" },
  Football: { bg: "#ECFEFF", fg: "#0E7490", dot: "#06B6D4" },
  Cricket: { bg: "#F5F3FF", fg: "#6D28D9", dot: "#8B5CF6" },
};
const TAG_FALLBACK = { bg: "#F1F5F9", fg: "#475569", dot: "#94A3B8" };

function rowKey(c: CustomerRow, i: number): string {
  return c.id || `${c.phone ?? ""}-${c.email ?? ""}-${i}`;
}

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

function TagChip({ tag }: { tag: string }) {
  const s = TAG_STYLE[tag] ?? TAG_FALLBACK;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      <span
        className="h-[5px] w-[5px] flex-shrink-0 rounded-full"
        style={{ backgroundColor: s.dot }}
        aria-hidden="true"
      />
      {tag}
    </span>
  );
}

/** Square checkbox matching the design (accent fill + check when on). */
function CheckBox({
  checked,
  indeterminate = false,
  label,
  onToggle,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onToggle: () => void;
}) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "flex h-[18px] w-[18px] items-center justify-center rounded-sm border-[1.5px] text-accent-fg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1",
        on ? "border-accent-600 bg-accent-600" : "border-border-strong bg-surface",
      )}
    >
      {checked && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
      {!checked && indeterminate && <span className="h-0.5 w-2.5 rounded-full bg-accent-fg" />}
    </button>
  );
}

export function CustomersView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { can, ready } = usePermissions();

  // URL-reflected filters (same params the hook already consumed, kept verbatim).
  const status = sp.get("status") ?? "";
  const q = sp.get("q") ?? "";
  const tag = sp.get("tag") ?? "";
  const activity = sp.get("activity") ?? "";
  const registeredFrom = sp.get("registered_from") ?? "";
  const registeredTo = sp.get("registered_to") ?? "";
  const includeGuests = sp.get("include_guests") === "1";

  // Data layer untouched — same hook, same shape. Extra filter params are passed
  // through transparently (the hook forwards an arbitrary param record).
  const { data, isLoading, isError, refetch } = useCustomers({
    q: q || undefined,
    status: status || undefined,
    tag: tag || undefined,
    activity: activity || undefined,
    registered_from: registeredFrom || undefined,
    registered_to: registeredTo || undefined,
    include_guests: includeGuests || undefined,
    page: 1,
    limit: 50,
  });

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [exportOpen, setExportOpen] = useState(false);

  const rows = useMemo(() => data ?? [], [data]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  // Selection — only non-guest rows are selectable (guests are read-only).
  const selectableIds = useMemo(
    () => rows.filter((c) => !c.is_guest && c.id).map((c) => c.id),
    [rows],
  );
  const selectedCount = selectableIds.filter((id) => selected[id]).length;
  const allChecked = selectableIds.length > 0 && selectedCount === selectableIds.length;
  const someChecked = selectedCount > 0 && !allChecked;

  function toggleAll() {
    setSelected((s) => {
      if (selectableIds.every((id) => s[id])) {
        const next = { ...s };
        selectableIds.forEach((id) => delete next[id]);
        return next;
      }
      const next = { ...s };
      selectableIds.forEach((id) => (next[id] = true));
      return next;
    });
  }
  function toggleOne(id: string) {
    setSelected((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }

  // Bulk-tag apply — presentation only (no tag-assign mutation hook exists yet).
  // TODO(design): wire to a real assign-tag mutation when the hook is added.
  function applyTag(t: string, count = selectedCount) {
    toast(`Tagged ${count} customer${count === 1 ? "" : "s"} with "${t}".`);
  }

  // Export — presentation only (no customers export mutation hook exists yet).
  // TODO(design): wire to a real export mutation when the hook is added.
  function confirmExport() {
    setExportOpen(false);
    toast("Export is processing — we'll notify you.", "info");
  }

  const canTag = can(CUSTOMERS_TAG_PERMISSION);
  const resultCount = rows.length;
  const hasFilters = !!(q || status || tag || activity || registeredFrom || registeredTo);

  // Screen is hidden for admins without customers.customer.read.
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
          >
            Export
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
            <option value="VIP">VIP</option>
            <option value="Wholesale">Wholesale</option>
            <option value="Repeat">Repeat</option>
            <option value="Newsletter">Newsletter</option>
            <option value="Football">Football</option>
            <option value="Cricket">Cricket</option>
          </Select>
        </div>

        {/* Registration date-range */}
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

      {/* ===== C/D/E. TABLE CARD (bulk bar + table + pagination) ===== */}
      <Card className="overflow-hidden p-0">
        {/* D. Bulk-tag bar — gated on customers.tag.manage */}
        {canTag && selectedCount > 0 && (
          <CustomerBulkTagBar
            selectedCount={selectedCount}
            onApplyTag={(t) => applyTag(t)}
            onClear={() => setSelected({})}
          />
        )}

        {isLoading ? (
          <SkeletonRows rows={8} cols={6} />
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
            <Table className="min-w-[1040px]">
              <caption className="sr-only">Customers. {resultCount} customers total.</caption>
              <THead>
                <TR hover={false}>
                  <TH className="w-12">
                    {canTag ? (
                      <CheckBox
                        checked={allChecked}
                        indeterminate={someChecked}
                        label="Select all customers"
                        onToggle={toggleAll}
                      />
                    ) : (
                      <span className="sr-only">Select</span>
                    )}
                  </TH>
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
                  const key = rowKey(c, i);
                  const name = c.name ?? c.phone ?? c.email ?? "Guest";
                  const isGuest = !!c.is_guest;
                  const checked = !!(c.id && selected[c.id]);
                  const shownTags = c.tags.slice(0, 2);
                  const overflow = c.tags.length - shownTags.length;
                  const orders = c.order_count ?? 0;
                  return (
                    <TR
                      key={key}
                      className={cn("cursor-pointer", checked && "bg-accent-50")}
                      onClick={() => c.id && router.push(`/admin/customers/${c.id}`)}
                    >
                      {/* select */}
                      <TD onClick={(e) => e.stopPropagation()}>
                        {canTag && !isGuest && c.id ? (
                          <CheckBox
                            checked={checked}
                            label={`Select ${name}`}
                            onToggle={() => toggleOne(c.id)}
                          />
                        ) : null}
                      </TD>

                      {/* NAME (+ guest marker) */}
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
                            <div className="truncate text-[13px] font-semibold text-text">
                              {name}
                            </div>
                            {isGuest && (
                              <span className="mt-0.5 inline-flex items-center gap-1 rounded-sm bg-surface-subtle px-1.5 py-px text-[10.5px] font-semibold text-text-muted">
                                <UserRound className="h-2.5 w-2.5" aria-hidden="true" />
                                Guest (no account)
                              </span>
                            )}
                          </div>
                        </div>
                      </TD>

                      {/* PHONE */}
                      <TD className="whitespace-nowrap tabular-nums text-[12.5px]">
                        {c.phone ?? "—"}
                      </TD>

                      {/* EMAIL */}
                      <TD className="max-w-[200px]">
                        <span className="block truncate text-[12.5px] text-text-muted">
                          {c.email ?? "—"}
                        </span>
                      </TD>

                      {/* STATUS */}
                      <TD>
                        <StatusPill
                          status={c.status}
                          label={STATUS_LABEL[c.status] ?? undefined}
                        />
                      </TD>

                      {/* TAGS */}
                      <TD className="max-w-[180px]">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          {shownTags.length === 0 ? (
                            <span className="text-text-faint">—</span>
                          ) : (
                            shownTags.map((t) => <TagChip key={t} tag={t} />)
                          )}
                          {overflow > 0 && (
                            <span className="inline-flex items-center whitespace-nowrap rounded-sm bg-surface-subtle px-1.5 py-0.5 text-[11px] font-semibold text-text-muted">
                              +{overflow}
                            </span>
                          )}
                        </div>
                      </TD>

                      {/* ORDERS */}
                      <TD numeric className="text-[13px] text-text-secondary">
                        {orders}
                      </TD>

                      {/* TOTAL SPENT */}
                      <TD numeric className="whitespace-nowrap text-[13px] font-semibold text-text">
                        {c.total_spent ? formatBDT(Number(c.total_spent)) : "—"}
                      </TD>

                      {/* LAST ORDER */}
                      <TD
                        className={cn(
                          "whitespace-nowrap tabular-nums text-[12.5px]",
                          orders === 0 ? "text-text-faint" : "text-text-muted",
                        )}
                      >
                        {c.last_order_at ? formatDate(c.last_order_at) : "—"}
                      </TD>

                      {/* ROW MENU */}
                      <TD className="text-right" onClick={(e) => e.stopPropagation()}>
                        <CustomerRowMenu
                          id={c.id}
                          name={name}
                          isGuest={isGuest}
                          onAddTag={() => applyTag("VIP", 1)}
                        />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>

            {/* E. Pagination footer */}
            <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3 text-[12.5px] text-text-muted">
              <span className="tabular-nums">
                Showing 1–{resultCount} of {resultCount}
              </span>
            </div>
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
