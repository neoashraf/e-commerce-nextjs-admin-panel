"use client";

import { useState } from "react";
import { useUpdateProfile } from "@/lib/api/hooks/useMe";
import type { MeProfile } from "@/lib/api/schemas/me";
import { formatDateTime } from "@/lib/format";

/**
 * Profile section (rbac-admin-profile-fe AC1). Edits full_name + phone via
 * PATCH /admin/me; email is read-only; role badge + last login shown. Per-section
 * save with inline confirmation.
 */
export function ProfileSection({ me }: { me: MeProfile }) {
  const update = useUpdateProfile();
  const [fullName, setFullName] = useState(me.full_name);
  const [phone, setPhone] = useState(me.phone ?? "");
  const [saved, setSaved] = useState(false);

  const dirty = fullName !== me.full_name || phone !== (me.phone ?? "");
  const field = "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    await update.mutateAsync({ full_name: fullName.trim(), phone: phone.trim() || null });
    setSaved(true);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden className="grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
          {me.full_name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="break-words text-base font-semibold text-gray-900">{me.full_name}</p>
          <p className="text-sm text-gray-500">{me.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">{me.role}</span>
            {me.last_login_at && (
              <span className="text-xs text-gray-400">Last login {formatDateTime(me.last_login_at)}</span>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={onSave} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Full name</span>
          <input className={field} value={fullName} onChange={(e) => { setFullName(e.target.value); setSaved(false); }} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Phone</span>
          <input className={field} value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false); }} placeholder="+8801…" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-gray-900">Email <span className="text-gray-400">(read-only)</span></span>
          <input className={field + " bg-gray-50 text-gray-500"} value={me.email} readOnly aria-readonly />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={!dirty || update.isPending}
            className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </button>
          {saved && <span role="status" className="text-sm text-green-700">Profile updated.</span>}
        </div>
      </form>
    </section>
  );
}
