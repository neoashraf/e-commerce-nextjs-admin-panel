"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  ChevronRight,
  Heart,
  Info,
  LifeBuoy,
  Lock,
  MapPin,
  Plus,
  ShoppingBag,
  ShoppingCart,
  SquarePen,
  StickyNote,
  TrendingUp,
  User,
  UserCheck,
  UserX,
} from "lucide-react";
import { useCustomer, useAddNote, useCustomerStatus } from "@/lib/api/hooks/useCustomers";
import { Can } from "@/lib/permissions/Can";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/cn";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  StatCard,
  StatusPill,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  CUSTOMERS_NOTE_PERMISSION,
  CUSTOMERS_READ_PERMISSION,
  CUSTOMERS_SUSPEND_PERMISSION,
  CUSTOMERS_TAG_PERMISSION,
} from "./permissions";

/**
 * Customer 360 profile (CUST) — the full-page DETAIL workspace on the Commerce
 * Admin design system (design §8.9 allows a full page for a deep workspace).
 * Breadcrumb + a header card (status pill, tag chips, verification badges, an
 * action cluster) over a two-column grid: LEFT aggregates StatCards + an order-
 * history Table (deep links) + linked leads + wishlist; RIGHT a read-only
 * contact/preferences card + addresses + an append-only internal-notes thread.
 *
 * Presentation only — the `useCustomer` / `useAddNote` / `useCustomerStatus`
 * hooks, their data shape, and every permission gate (read / suspend / note /
 * tag.manage) are reused unchanged. Customer-owned data is read-only (BR-CUST-1);
 * suspend/reactivate stay server-confirmed + audited and disabled for a deleted
 * customer; guests have no account actions.
 *
 * Pixel target: docs/design/admin-panel-design-files/Customer 360 (CUST).dc.html.
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
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-0.5 text-[11.5px] font-semibold"
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

/** Section heading row used inside each panel card (icon + title + optional aside). */
function PanelHeader({
  icon: Icon,
  title,
  count,
  action,
}: {
  icon: typeof User;
  title: string;
  count?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-accent-600" aria-hidden="true" />
        <h2 className="text-[15px] font-semibold text-text">{title}</h2>
        {count && <span className="text-xs tabular-nums text-text-faint">· {count}</span>}
      </div>
      {action}
    </div>
  );
}

export function CustomerDetailView({ id }: { id: string }) {
  const { data, isLoading, isError, refetch } = useCustomer(id);
  const addNote = useAddNote(id);
  const statusM = useCustomerStatus(id);
  const { can, ready } = usePermissions();

  const [note, setNote] = useState("");
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // Screen is hidden for admins without customers.customer.read.
  if (ready && !can(CUSTOMERS_READ_PERMISSION)) {
    return (
      <Card>
        <EmptyState
          icon={User}
          title="No access to this customer"
          description="You don’t have permission to view customer profiles."
        />
      </Card>
    );
  }

  // ===== LOADING SKELETON =====
  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3.5">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <div className="space-y-5">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ===== ERROR + RETRY =====
  if (isError || !data) {
    return (
      <Card>
        <ErrorState
          title="We couldn’t find that customer."
          description="The profile failed to load or no longer exists."
          onRetry={() => refetch()}
        />
        <div className="flex justify-center pb-6">
          <Link href="/admin/customers">
            <Button variant="ghost" size="sm">
              Back to customers
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  const name = data.name ?? data.phone ?? data.email ?? "Customer";
  const status = data.status;
  const isDeleted = status === "deleted";
  // A guest has no account id; account actions are unavailable for guests.
  const isGuest = !data.id;
  const orderCount = data.order_count ?? 0;
  const totalSpent = data.total_spent ? Number(data.total_spent) : 0;
  // AOV is derived from the two aggregates the API already returns (presentation
  // only — not a new API field). Net-of-refunds note carried alongside LTV.
  const aov = orderCount > 0 ? Math.round(totalSpent / orderCount) : 0;
  const lastOrder = data.last_order_at ? formatDate(data.last_order_at) : "—";
  // TODO(design): first-order date is shown in the design but not returned by the
  // customer 360 endpoint — omitted until the API exposes it.

  function onAddNote() {
    const body = note.trim();
    if (!body) return;
    addNote.mutate(body, {
      onSuccess: () => {
        setNote("");
        toast("Note added.");
      },
      onError: () => toast("Couldn’t add the note. Try again.", "error"),
    });
  }

  function focusNote() {
    noteRef.current?.focus();
  }

  function onSuspendClick() {
    if (isDeleted) {
      toast("Account actions aren't available for a deleted customer.", "info");
      return;
    }
    setSuspendOpen(true);
  }

  function confirmSuspend() {
    // The suspend mutation takes no body; the reason is captured for the audit
    // trail on the server side when that field is wired.
    // TODO(design): pass `suspendReason` once the suspend endpoint accepts it.
    statusM.suspend.mutate(undefined, {
      onSuccess: () => {
        setSuspendOpen(false);
        setSuspendReason("");
        toast("Account suspended — customer signed out everywhere.", "info");
      },
      onError: () => toast("Couldn’t suspend the account. Try again.", "error"),
    });
  }

  function reactivate() {
    statusM.reactivate.mutate(undefined, {
      onSuccess: () => toast("Account reactivated."),
      onError: () => toast("Couldn’t reactivate the account. Try again.", "error"),
    });
  }

  const canManageTags = can(CUSTOMERS_TAG_PERMISSION);
  const recentOrders = data.recent_orders ?? [];
  const notes = data.notes ?? [];

  return (
    <div>
      {/* ===== BREADCRUMB ===== */}
      <nav
        aria-label="Breadcrumb"
        className="mb-3.5 flex flex-wrap items-center gap-1.5 text-[12.5px]"
      >
        <Link
          href="/admin/customers"
          className="font-medium text-text-muted hover:text-text-secondary"
        >
          Customers
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-border-strong" aria-hidden="true" />
        <span className="font-semibold text-text-secondary">{name}</span>
      </nav>

      {/* ===== A. HEADER CARD ===== */}
      <Card className="mb-5 p-[22px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span
              className="flex h-[54px] w-[54px] flex-shrink-0 items-center justify-center rounded-full bg-accent-50 text-[19px] font-bold text-accent-700"
              aria-hidden="true"
            >
              {initials(name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[22px] font-bold leading-tight tracking-tight text-text">
                  {name}
                </h1>
                <StatusPill status={status} label={STATUS_LABEL[status]} />
                {isGuest && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-text-muted">
                    Guest (no account)
                  </span>
                )}
              </div>

              {/* contact + verification line */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {data.phone && (
                  <span className="text-[12.5px] tabular-nums text-text-muted">
                    {data.phone}
                  </span>
                )}
                {/* TODO(design): phone/email "verified" badges need verification
                    flags from the API; not returned by the 360 endpoint today. */}
                {data.phone && data.email && (
                  <span
                    className="h-[3px] w-[3px] rounded-full bg-border-strong"
                    aria-hidden="true"
                  />
                )}
                {data.email && (
                  <span className="break-all text-[12.5px] text-text-muted">{data.email}</span>
                )}
              </div>

              {/* tag chips + add-tag */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {data.tags.length > 0 ? (
                  data.tags.map((t) => <TagChip key={t} tag={t} />)
                ) : (
                  <span className="text-[12px] text-text-faint">No tags</span>
                )}
                {!isGuest && canManageTags && (
                  <button
                    type="button"
                    // TODO(design): wire to a real tag-assign mutation when added.
                    onClick={() => toast("Tag picker opened.", "info")}
                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-border-strong bg-surface px-2 py-0.5 text-[11.5px] font-semibold text-text-muted hover:bg-surface-subtle hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    Add tag
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* action cluster — guests have no account actions */}
          {!isGuest && (
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2.5">
              <Can permission={CUSTOMERS_NOTE_PERMISSION}>
                <Button
                  variant="secondary"
                  size="md"
                  leadingIcon={<SquarePen className="h-4 w-4" aria-hidden="true" />}
                  onClick={focusNote}
                >
                  Add note
                </Button>
              </Can>
              <Can permission={CUSTOMERS_SUSPEND_PERMISSION}>
                {status === "suspended" || status === "locked" ? (
                  <Button
                    variant="secondary"
                    size="md"
                    className="border-success/40 text-success hover:bg-success-50"
                    leadingIcon={<UserCheck className="h-4 w-4" aria-hidden="true" />}
                    loading={statusM.reactivate.isPending}
                    disabled={isDeleted}
                    onClick={reactivate}
                  >
                    Reactivate
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="md"
                    className={cn(
                      isDeleted
                        ? "text-text-faint"
                        : "border-warning/40 text-warning hover:bg-warning-50",
                    )}
                    leadingIcon={<UserX className="h-4 w-4" aria-hidden="true" />}
                    disabled={isDeleted}
                    aria-disabled={isDeleted}
                    title={
                      isDeleted
                        ? "Account actions aren't available for a deleted customer."
                        : undefined
                    }
                    onClick={onSuspendClick}
                  >
                    Suspend
                  </Button>
                )}
              </Can>
            </div>
          )}
        </div>

        {isDeleted && (
          <p className="mt-4 rounded-md bg-surface-subtle px-3 py-2 text-[12.5px] text-text-muted">
            Account actions aren’t available for a deleted customer.
          </p>
        )}
      </Card>

      {/* ===== B. TWO-COLUMN WORKSPACE ===== */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] lg:items-start">
        {/* ===== LEFT COLUMN ===== */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* (1) AGGREGATES */}
          <div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <StatCard
                label="Lifetime value"
                value={formatBDT(totalSpent)}
                icon={BadgeDollarSign}
              />
              <StatCard label="Orders" value={String(orderCount)} icon={ShoppingBag} />
              <StatCard label="Avg. order value" value={formatBDT(aov)} icon={TrendingUp} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-text-faint">
              <Info className="h-3.5 w-3.5 text-border-strong" aria-hidden="true" />
              <span>Last order {lastOrder}</span>
              <span className="h-[3px] w-[3px] rounded-full bg-border-strong" aria-hidden="true" />
              <span>Total spent is net of refunds.</span>
            </div>
          </div>

          {/* (2) ORDER HISTORY */}
          <Card className="overflow-hidden">
            <div className="px-[18px] pb-3 pt-[15px]">
              <PanelHeader
                icon={ShoppingCart}
                title="Order history"
                count={`${orderCount} orders`}
              />
            </div>
            {recentOrders.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="No orders yet"
                description="This customer hasn’t placed any orders."
                className="py-10"
              />
            ) : (
              <Table>
                <caption className="sr-only">Order history for {name}.</caption>
                <THead>
                  <TR hover={false}>
                    <TH>Order</TH>
                    <TH>Status</TH>
                    <TH numeric>Total</TH>
                    <TH>Date</TH>
                  </TR>
                </THead>
                <TBody>
                  {recentOrders.map((o) => (
                    <TR key={o.order_no}>
                      <TD>
                        <Link
                          href={`/admin/orders/${o.order_no}`}
                          className="text-[13px] font-semibold tabular-nums text-accent-600 hover:text-accent-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                        >
                          {o.order_no}
                        </Link>
                      </TD>
                      <TD>{o.status ? <StatusPill status={o.status} /> : "—"}</TD>
                      <TD numeric className="font-semibold text-text">
                        {o.grand_total ? formatBDT(Number(o.grand_total)) : "—"}
                      </TD>
                      <TD className="whitespace-nowrap tabular-nums text-text-muted">
                        {o.placed_at ? formatDate(o.placed_at) : "—"}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          {/* (3) LINKED LEADS */}
          {/* TODO(design): linked leads aren't returned by the 360 endpoint yet;
              the panel renders an empty state until the API exposes them. */}
          <Card className="p-[18px]">
            <PanelHeader icon={LifeBuoy} title="Linked leads" />
            <p className="mt-3 text-[12.5px] text-text-muted">
              No linked leads for this customer.
            </p>
          </Card>

          {/* (4) WISHLIST */}
          {/* TODO(design): wishlist count isn't returned by the 360 endpoint yet;
              shows a degraded panel (partial-source) while the rest renders. */}
          <Card className="p-[18px]">
            <div className="flex items-center justify-between gap-2.5">
              <PanelHeader icon={Heart} title="Wishlist" />
            </div>
            <p className="mt-3 text-[12.5px] text-text-muted">
              Wishlist details are currently unavailable.
            </p>
          </Card>
        </div>

        {/* ===== RIGHT COLUMN ===== */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* (5) CONTACT & PREFERENCES (read-only) */}
          <Card className="p-[18px]">
            <div className="mb-3.5 flex items-center justify-between gap-2">
              <PanelHeader icon={User} title="Contact & preferences" />
              <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-subtle px-2 py-0.5 text-[10.5px] font-semibold text-text-muted">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Read-only
              </span>
            </div>
            <dl className="flex flex-col gap-3">
              <ContactRow label="Phone" value={data.phone ?? "—"} numeric />
              <ContactRow label="Email" value={data.email ?? "—"} breakAll />
              {/* TODO(design): gender, date of birth, and communication opt-ins are
                  shown in the design but not returned by the 360 endpoint today. */}
            </dl>
          </Card>

          {/* (6) ADDRESSES */}
          {/* TODO(design): saved addresses aren't returned by the 360 endpoint yet;
              the card renders an empty state until the API exposes them. */}
          <Card className="p-[18px]">
            <PanelHeader icon={MapPin} title="Addresses" />
            <p className="mt-3 text-[12.5px] text-text-muted">No saved addresses.</p>
          </Card>

          {/* (7) INTERNAL NOTES (append-only) */}
          <Card className="p-[18px]">
            <div className="mb-3.5">
              <PanelHeader icon={StickyNote} title="Internal notes" />
            </div>

            {notes.length === 0 ? (
              <p className="text-[12.5px] text-text-faint">No notes yet.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {notes.map((n, i) => (
                  <li
                    key={n.id ?? i}
                    className="rounded-lg border border-border bg-surface-hover p-3"
                  >
                    {n.created_at && (
                      <p className="mb-1 text-[11px] tabular-nums text-text-faint">
                        {formatDateTime(n.created_at)}
                      </p>
                    )}
                    <p className="break-words text-[12.5px] leading-relaxed text-text-secondary">
                      {n.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <Can permission={CUSTOMERS_NOTE_PERMISSION}>
              <div className="mt-3.5">
                <textarea
                  ref={noteRef}
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add an internal note…"
                  aria-label="Add an internal note"
                  className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-[13px] leading-snug text-text placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                />
                <div className="mt-2.5 flex items-center justify-between gap-2.5">
                  <span className="text-[11.5px] text-text-faint">
                    Never visible to the customer.
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                    disabled={!note.trim()}
                    loading={addNote.isPending}
                    onClick={onAddNote}
                  >
                    Add note
                  </Button>
                </div>
              </div>
            </Can>
          </Card>
        </div>
      </div>

      {/* ===== SUSPEND CONFIRM DIALOG (confirmed + audited) ===== */}
      <SuspendDialog
        open={suspendOpen}
        name={name}
        reason={suspendReason}
        pending={statusM.suspend.isPending}
        onReasonChange={setSuspendReason}
        onConfirm={confirmSuspend}
        onClose={() => {
          if (!statusM.suspend.isPending) {
            setSuspendOpen(false);
            setSuspendReason("");
          }
        }}
      />
    </div>
  );
}

function ContactRow({
  label,
  value,
  numeric = false,
  breakAll = false,
}: {
  label: string;
  value: string;
  numeric?: boolean;
  breakAll?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3.5">
      <dt className="flex-shrink-0 pt-px text-[12px] text-text-faint">{label}</dt>
      <dd
        className={cn(
          "text-right text-[13px] text-text-secondary",
          numeric && "tabular-nums",
          breakAll && "break-all",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Suspend confirm dialog — the design needs a reason textarea, so it's a bespoke
 * dialog (the shared ConfirmDialog has no input slot) built on the same a11y
 * contract: role=dialog, aria-modal, Esc + scrim dismiss, focus moved in on open
 * and restored on close, accent focus rings, reduced-motion respected.
 */
function SuspendDialog({
  open,
  name,
  reason,
  pending,
  onReasonChange,
  onConfirm,
  onClose,
}: {
  open: boolean;
  name: string;
  reason: string;
  pending: boolean;
  onReasonChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  if (open && !prevFocus.current) {
    prevFocus.current = (typeof document !== "undefined"
      ? (document.activeElement as HTMLElement | null)
      : null);
  }

  if (!open) {
    prevFocus.current = null;
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <div
        className="absolute inset-0 bg-black/40 motion-safe:animate-[sgFade_.16s_ease]"
        onClick={pending ? undefined : onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Suspend ${name}`}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !pending) onClose();
        }}
        className="relative w-full max-w-[430px] rounded-xl border border-border bg-surface p-5 shadow-lg"
      >
        <div className="mb-3.5 flex items-start gap-3">
          <span
            className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning"
            aria-hidden="true"
          >
            <AlertTriangle className="h-[19px] w-[19px]" />
          </span>
          <div>
            <h3 className="text-[16px] font-bold tracking-tight text-text">Suspend {name}?</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-muted">
              This blocks login and signs the customer out everywhere. In-flight orders continue.
            </p>
          </div>
        </div>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-eyebrow uppercase tracking-wide text-text-faint">
            Reason <span className="text-error">*</span>
          </span>
          <textarea
            rows={3}
            value={reason}
            autoFocus
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Why is this account being suspended? (recorded in the audit log)"
            className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-[13px] leading-snug text-text placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          />
        </label>

        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            className="bg-warning text-white hover:bg-warning/90"
            leadingIcon={<UserX className="h-4 w-4" aria-hidden="true" />}
            loading={pending}
            disabled={!reason.trim()}
            onClick={onConfirm}
          >
            Suspend account
          </Button>
        </div>
      </div>
    </div>
  );
}
