"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useAdminUsers, useAdminUserActions } from "@/lib/api/hooks/useAdminUsers";
import type { AdminUserRow } from "@/lib/api/schemas/admin-users";
import { useAuthStore } from "@/lib/stores/auth";
import { Can } from "@/lib/permissions/Can";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/errors";
import { usePageParams } from "@/lib/usePageParams";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
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

/**
 * Admin users list (admin-users-list.md, rbac-admin-users-fe) on the AD6 Data
 * Table primitive (design-system §8.6): Card-wrapped table on desktop, cards on
 * mobile, StatusPill, and a 15/page paginated footer backed by the API
 * `meta.total`. Search + status filter + `page` URL-reflected; row actions
 * (suspend/reactivate/delete/resend-invite) behind confirm dialogs and `<Can>`;
 * own-row destructive actions hidden. Presentation + pagination only.
 */
type Pending = { kind: "suspend" | "reactivate" | "delete"; user: AdminUserRow } | null;

export function UsersView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const meId = useAuthStore((s) => s.admin?.id);

  const status = sp.get("status") ?? "";
  const q = sp.get("q") ?? "";
  const includeDeleted = sp.get("include_deleted") === "1";
  const { page, pageSize, setPage, setPageSize } = usePageParams();

  const { data, isLoading, isError, refetch } = useAdminUsers({
    status: status || undefined,
    q: q || undefined,
    include_deleted: includeDeleted || undefined,
    page,
    limit: pageSize,
  });
  const actions = useAdminUserActions();
  const [pending, setPending] = useState<Pending>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page"); // filter/search change → back to page 1
    router.push(`${pathname}?${next.toString()}`);
  }

  async function runAction() {
    if (!pending) return;
    setActionError(null);
    const m = pending.kind === "suspend" ? actions.suspend : pending.kind === "reactivate" ? actions.reactivate : actions.remove;
    try {
      await m.mutateAsync(pending.user.id);
      setPending(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === "SUPER_ADMIN_FLOOR") {
        setActionError("At least one active Super Admin must remain.");
      } else if (err instanceof ApiError && err.status === 403) {
        setActionError("You can't perform this action on your own account.");
      } else {
        setActionError("Something went wrong. Please try again.");
      }
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold leading-7 text-text">Admin users</h1>
        <Can permission="rbac.admin_user.create">
          <Link
            href="/admin/users/new"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent-600 px-4 text-sm font-medium text-accent-fg shadow-xs transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
          >
            Invite admin
          </Link>
        </Can>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <Input
            leadingIcon={<Search className="h-4 w-4" />}
            placeholder="Search name or email…"
            aria-label="Search admin users"
            defaultValue={q}
            onKeyDown={(e) => e.key === "Enter" && setParam("q", (e.target as HTMLInputElement).value)}
          />
        </div>
        <div className="w-40">
          <Select aria-label="Status" value={status} onChange={(e) => setParam("status", e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input type="checkbox" checked={includeDeleted} onChange={(e) => setParam("include_deleted", e.target.checked ? "1" : "")} className="h-4 w-4 accent-accent-600" />
          Include deleted
        </label>
      </div>

      {actionError && <p role="alert" className="rounded-md bg-error-50 px-3 py-2 text-sm text-error">{actionError}</p>}

      <Card>
        {isLoading ? (
          <SkeletonRows rows={10} cols={6} />
        ) : isError ? (
          <ErrorState description="Couldn't load admin users." onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No admin users match your filters." description="Try clearing search or the status filter." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block">
              <Table>
                <THead>
                  <TR hover={false}>
                    <TH>Name</TH>
                    <TH>Email</TH>
                    <TH>Role</TH>
                    <TH>Status</TH>
                    <TH>Last login</TH>
                    <TH className="text-right"><span className="sr-only">Actions</span></TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((u) => (
                    <TR key={u.id}>
                      <TD className="font-medium text-text">{u.full_name}</TD>
                      <TD>{u.email}</TD>
                      <TD>{u.role}</TD>
                      <TD><StatusPill status={u.status} /></TD>
                      <TD className="text-text-muted">{u.last_login_at ? formatDateTime(u.last_login_at) : "—"}</TD>
                      <TD className="text-right"><RowActions user={u} meId={meId} onAction={(kind) => setPending({ kind, user: u })} onResend={() => actions.resendInvite.mutate(u.id)} /></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="space-y-3 p-4 lg:hidden">
              {rows.map((u) => (
                <li key={u.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-text">{u.full_name}</p>
                    <StatusPill status={u.status} />
                  </div>
                  <p className="text-sm text-text-muted">{u.email}</p>
                  <p className="mt-0.5 text-sm text-text-muted">{u.role}</p>
                  <div className="mt-3"><RowActions user={u} meId={meId} onAction={(kind) => setPending({ kind, user: u })} onResend={() => actions.resendInvite.mutate(u.id)} /></div>
                </li>
              ))}
            </ul>

            <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!pending}
        title={pending?.kind === "delete" ? "Delete admin user?" : pending?.kind === "suspend" ? "Suspend admin user?" : "Reactivate admin user?"}
        message={
          pending?.kind === "suspend"
            ? `${pending.user.full_name} will be signed out of all devices.`
            : pending?.kind === "delete"
              ? `${pending?.user.full_name} will be removed (soft-deleted).`
              : `${pending?.user.full_name} will be able to sign in again.`
        }
        confirmLabel={pending?.kind === "delete" ? "Delete" : pending?.kind === "suspend" ? "Suspend" : "Reactivate"}
        danger={pending?.kind !== "reactivate"}
        pending={actions.suspend.isPending || actions.reactivate.isPending || actions.remove.isPending}
        onConfirm={runAction}
        onClose={() => setPending(null)}
      />
    </div>
  );
}

function RowActions({
  user,
  meId,
  onAction,
  onResend,
}: {
  user: AdminUserRow;
  meId?: string;
  onAction: (kind: "suspend" | "reactivate" | "delete") => void;
  onResend: () => void;
}) {
  const isSelf = user.id === meId;
  const link = "text-sm font-medium text-accent-700 hover:underline";
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <Can permission="rbac.admin_user.update">
        <Link href={`/admin/users/${user.id}/edit`} className={link}>Edit</Link>
      </Can>
      {user.status === "pending" && (
        <Can permission="rbac.admin_user.create">
          <button type="button" onClick={onResend} className={link}>Resend invite</button>
        </Can>
      )}
      {!isSelf && user.status === "active" && (
        <Can permission="rbac.admin_user.suspend">
          <button type="button" onClick={() => onAction("suspend")} className="text-sm font-medium text-warning hover:underline">Suspend</button>
        </Can>
      )}
      {!isSelf && user.status === "suspended" && (
        <Can permission="rbac.admin_user.suspend">
          <button type="button" onClick={() => onAction("reactivate")} className="text-sm font-medium text-success hover:underline">Reactivate</button>
        </Can>
      )}
      {!isSelf && user.status !== "deleted" && (
        <Can permission="rbac.admin_user.delete">
          <button type="button" onClick={() => onAction("delete")} className="text-sm font-medium text-error hover:underline">Delete</button>
        </Can>
      )}
    </div>
  );
}
