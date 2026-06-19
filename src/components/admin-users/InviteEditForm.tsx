"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useInviteAdmin, useEditAdmin, useRoles } from "@/lib/api/hooks/useAdminUsers";
import { useAuthStore } from "@/lib/stores/auth";
import { toast } from "@/lib/stores/toast";
import { ApiError } from "@/lib/api/errors";

/**
 * Invite / edit admin form (admin-user-invite-edit.md, rbac-admin-users-fe).
 * Create mode invites a `pending` admin; edit mode locks the email and blocks
 * changing your own role. Role selector shows a capability summary
 * (permission count). Duplicate-email + Floor + self-role errors mapped.
 */
export function InviteEditForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: { id: string; full_name: string; email: string; phone?: string; role_id?: string };
}) {
  const router = useRouter();
  const meId = useAuthStore((s) => s.admin?.id);
  const { data: roles } = useRoles();
  const invite = useInviteAdmin();
  const edit = useEditAdmin(initial?.id ?? "");

  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [roleId, setRoleId] = useState(initial?.role_id ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isSelf = mode === "edit" && initial?.id === meId;
  const selectedRole = roles?.find((r) => r.id === roleId);
  const field = "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setFormError(null);
    try {
      if (mode === "create") {
        const created = await invite.mutateAsync({ full_name: fullName.trim(), email: email.trim(), phone: phone.trim() || undefined, role_id: roleId });
        toast(`Invite sent to ${email.trim()}`);
        // Land on the new admin's edit page so it can be reviewed/edited right away.
        router.push(`/admin/users/${created.id}/edit`);
      } else {
        await edit.mutateAsync({ full_name: fullName.trim(), phone: phone.trim() || undefined, role_id: isSelf ? undefined : roleId });
        router.push("/admin/users");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && mode === "create") {
        setEmailError("An admin with this email already exists.");
      } else if (err instanceof ApiError && err.status === 403) {
        setFormError("You can't change your own role.");
      } else if (err instanceof ApiError && err.code === "SUPER_ADMIN_FLOOR") {
        setFormError("At least one active Super Admin must remain.");
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  }

  const pending = invite.isPending || edit.isPending;

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold text-gray-900">{mode === "create" ? "Invite admin" : "Edit admin"}</h1>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-900">Full name</span>
        <input className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-900">
          Email {mode === "edit" && <span className="text-gray-400">(read-only)</span>}
        </span>
        <input
          className={field + (mode === "edit" ? " bg-gray-50 text-gray-500" : "")}
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
          readOnly={mode === "edit"}
          aria-invalid={!!emailError}
          aria-describedby={emailError ? "email-error" : undefined}
          required
        />
        {emailError && <p id="email-error" role="alert" className="mt-1 text-sm text-red-600">{emailError}</p>}
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-900">Phone</span>
        <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+8801…" />
      </label>

      <div className="block">
        <label htmlFor="role" className="mb-1 block text-sm font-medium text-gray-900">Role</label>
        <select
          id="role"
          className={field}
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          disabled={isSelf}
          required
        >
          <option value="" disabled>Select a role…</option>
          {roles?.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        {isSelf && <p className="mt-1 text-xs text-gray-500">You can&apos;t change your own role.</p>}
        {selectedRole && (
          <p className="mt-1 text-xs text-gray-500">
            {typeof selectedRole.permission_count === "string"
              ? "Full access"
              : `${selectedRole.permission_count ?? 0} permissions`}
            {selectedRole.assigned_count != null ? ` · ${selectedRole.assigned_count} assigned` : ""}
          </p>
        )}
      </div>

      {formError && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {pending ? "Saving…" : mode === "create" ? "Send invite" : "Save changes"}
        </button>
        <button type="button" onClick={() => router.push("/admin/users")} className="text-sm font-medium text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>
    </form>
  );
}
