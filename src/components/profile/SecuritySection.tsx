"use client";

import { useState } from "react";
import { useChangePassword } from "@/lib/api/hooks/useMe";
import type { MeProfile } from "@/lib/api/schemas/me";
import { passwordRules } from "@/lib/validations/password-reset";
import { ApiError } from "@/lib/api/errors";
import { PasswordChecklist } from "./PasswordChecklist";
import { TwoFactorControl } from "./TwoFactorControl";

/**
 * Security section (rbac-admin-profile-fe AC2/AC3/AC4): change password (current
 * + new with live checklist + confirm; success notes other sessions are signed
 * out) and the own-2FA control.
 */
export function SecuritySection({ me }: { me: MeProfile }) {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const field = "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";
  const strong = passwordRules.every((r) => r.test(next));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (!strong) return setError("Your new password doesn't meet the requirements.");
    if (next !== confirm) return setError("Passwords don't match.");
    try {
      await change.mutateAsync({ current_password: current, new_password: next });
      setCurrent(""); setNext(""); setConfirm("");
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError("Your current password is incorrect.");
      else if (err instanceof ApiError && err.status === 400) setError("Choose a stronger password.");
      else setError("Something went wrong. Try again.");
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900">Security</h2>

      <form onSubmit={onSubmit} className="mt-4 max-w-md space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Current password</span>
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">New password</span>
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); setDone(false); }} className={field} />
        </label>
        <PasswordChecklist value={next} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Confirm new password</span>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {done && <p role="status" className="text-sm text-green-700">Password changed. Your other sessions have been signed out.</p>}
        <button
          type="submit"
          disabled={change.isPending}
          className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {change.isPending ? "Updating…" : "Change password"}
        </button>
      </form>

      <div className="mt-6">
        <TwoFactorControl me={me} />
      </div>
    </section>
  );
}
