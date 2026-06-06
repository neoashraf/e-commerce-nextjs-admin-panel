"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminUsers, useAdminUserActions } from "@/lib/api/hooks/useAdminUsers";
import type { AdminUserRow, AdminUserStatus } from "@/lib/api/schemas/admin-users";
import { useAuthStore } from "@/lib/stores/auth";
import { Can } from "@/lib/permissions/Can";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/errors";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Admin users list (admin-users-list.md, rbac-admin-users-fe). Desktop table /
 * mobile cards; search + status filter reflected in the URL; row actions
 * (suspend/reactivate/delete/resend-invite) behind confirm dialogs and `<Can>`;
 * own-row destructive actions hidden; Floor/self errors surfaced.
 */
const STATUS_STYLE: Record<AdminUserStatus, string> = {
  active: "bg-green-50 text-green-700",
  suspended: "bg-amber-50 text-amber-700",
  pending: "bg-blue-50 text-blue-700",
  deleted: "bg-gray-100 text-gray-500",
};

type Pending = { kind: "suspend" | "reactivate" | "delete"; user: AdminUserRow } | null;

export function UsersView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const meId = useAuthStore((s) => s.admin?.id);

  const status = sp.get("status") ?? "";
  const q = sp.get("q") ?? "";
  const includeDeleted = sp.get("include_deleted") === "1";

  const { data, isLoading, isError, refetch } = useAdminUsers({
    status: status || undefined,
    q: q || undefined,
    include_deleted: includeDeleted || undefined,
    page: 1,
    limit: 50,
  });
  const actions = useAdminUserActions();
  const [pending, setPending] = useState<Pending>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
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
        <h1 className="text-xl font-bold text-gray-900">Admin users</h1>
        <Can permission="rbac.admin_user.create">
          <Link href="/admin/users/new" className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
            Invite admin
          </Link>
        </Can>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          defaultValue={q}
          onKeyDown={(e) => e.key === "Enter" && setParam("q", (e.target as HTMLInputElement).value)}
          placeholder="Search name or email…"
          className="h-10 w-64 rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        <select value={status} onChange={(e) => setParam("status", e.target.value)} className="h-10 rounded-md border border-gray-300 px-3 text-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending">Pending</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={includeDeleted} onChange={(e) => setParam("include_deleted", e.target.checked ? "1" : "")} className="h-4 w-4" />
          Include deleted
        </label>
      </div>

      {actionError && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">Couldn&apos;t load admin users.</p>
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button>
        </div>
      ) : !data || data.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">No admin users match your filters.</p>
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden w-full text-sm lg:table">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Last login</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 font-medium text-gray-900">{u.full_name}</td>
                  <td className="py-3 pr-4 text-gray-600">{u.email}</td>
                  <td className="py-3 pr-4 text-gray-600">{u.role}</td>
                  <td className="py-3 pr-4"><StatusBadge status={u.status} /></td>
                  <td className="py-3 pr-4 text-gray-400">{u.last_login_at ? formatDateTime(u.last_login_at) : "—"}</td>
                  <td className="py-3"><RowActions user={u} meId={meId} onAction={(kind) => setPending({ kind, user: u })} onResend={() => actions.resendInvite.mutate(u.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <ul className="space-y-3 lg:hidden">
            {data.map((u) => (
              <li key={u.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{u.full_name}</p>
                  <StatusBadge status={u.status} />
                </div>
                <p className="text-sm text-gray-500">{u.email}</p>
                <p className="mt-0.5 text-sm text-gray-500">{u.role}</p>
                <div className="mt-3"><RowActions user={u} meId={meId} onAction={(kind) => setPending({ kind, user: u })} onResend={() => actions.resendInvite.mutate(u.id)} /></div>
              </li>
            ))}
          </ul>
        </>
      )}

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

function StatusBadge({ status }: { status: AdminUserStatus }) {
  return <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " + STATUS_STYLE[status]}>{status}</span>;
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
  const link = "text-sm font-medium text-brand-700 hover:underline";
  return (
    <div className="flex flex-wrap items-center gap-3">
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
          <button type="button" onClick={() => onAction("suspend")} className="text-sm font-medium text-amber-700 hover:underline">Suspend</button>
        </Can>
      )}
      {!isSelf && user.status === "suspended" && (
        <Can permission="rbac.admin_user.suspend">
          <button type="button" onClick={() => onAction("reactivate")} className="text-sm font-medium text-green-700 hover:underline">Reactivate</button>
        </Can>
      )}
      {!isSelf && user.status !== "deleted" && (
        <Can permission="rbac.admin_user.delete">
          <button type="button" onClick={() => onAction("delete")} className="text-sm font-medium text-red-600 hover:underline">Delete</button>
        </Can>
      )}
    </div>
  );
}
