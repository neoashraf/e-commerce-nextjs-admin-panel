"use client";

import { useState } from "react";
import { useUpdateTwoFa } from "@/lib/api/hooks/useMe";
import type { MeProfile } from "@/lib/api/schemas/me";
import { ApiError } from "@/lib/api/errors";

/**
 * Own-2FA control (rbac-admin-profile-fe AC3/AC4). Enable reveals the channel;
 * SMS without a phone prompts to add one; the toggle flips only after server
 * confirmation. Disable requires the current password. Every admin — including
 * Super Admin — can turn their own 2FA on or off.
 */
export function TwoFactorControl({ me }: { me: MeProfile }) {
  const update = useUpdateTwoFa();
  const enabled = me.two_fa_enabled ?? false;

  const [channel, setChannel] = useState<string>(me.two_fa_channel ?? "sms");
  const [password, setPassword] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const smsNoPhone = channel === "sms" && !me.phone;

  async function submit(nextEnabled: boolean) {
    setError(null);
    setDone(null);
    if (!password) {
      setError("Enter your current password to confirm.");
      return;
    }
    if (nextEnabled && smsNoPhone) {
      setError("Add a phone number to your profile before enabling SMS two-factor.");
      return;
    }
    try {
      await update.mutateAsync({ enabled: nextEnabled, channel: nextEnabled ? channel : undefined, current_password: password });
      setPassword("");
      setShowForm(false);
      setDone(nextEnabled ? "Two-factor authentication is on." : "Two-factor authentication is off.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError("That password is incorrect.");
      else if (err instanceof ApiError && err.status === 400) setError("Couldn't update two-factor — check the channel.");
      else setError("Something went wrong. Try again.");
    }
  }

  const field = "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="border-t border-gray-100 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Two-factor authentication</p>
          <p id="twofa-status" className="text-sm text-gray-500">
            {enabled ? `On — via ${me.two_fa_channel ?? channel}` : "Off"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((s) => !s); setError(null); setDone(null); }}
          className="inline-flex h-9 items-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          {enabled ? "Disable" : "Enable"}
        </button>
      </div>

      {done && <p role="status" className="mt-2 text-sm text-green-700">{done}</p>}

      {showForm && (
        <div className="mt-4 space-y-3 rounded-md bg-gray-50 p-4">
          {!enabled && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-900">Channel</span>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className={field}>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="app">Authenticator app</option>
              </select>
              {smsNoPhone && <p className="mt-1 text-xs text-amber-700">Add a phone number above to use SMS.</p>}
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-900">Current password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} autoComplete="current-password" />
          </label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={() => submit(!enabled)}
            disabled={update.isPending}
            className="inline-flex h-10 items-center rounded-md bg-gray-900 px-5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {update.isPending ? "Confirming…" : enabled ? "Turn off two-factor" : "Turn on two-factor"}
          </button>
        </div>
      )}
    </div>
  );
}
