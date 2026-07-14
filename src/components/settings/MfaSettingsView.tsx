"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useMfaPolicy, useSaveMfaPolicy, type MfaPolicy } from "@/lib/api/hooks/useSettings";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";
import { Button, Card, Switch } from "@/components/ui";

type Enforcement = "optional" | "mandatory";

/**
 * MFA policy settings (mfa-2fa-admin-fe · docs/design/screens/17-mfa/mfa-policy-settings.md).
 * Super Admin configures the platform-wide CUSTOMER second factor: which channels are offered
 * (email default-on / SMS off until a gateway is set — BR-MFA-10) and enforcement (optional vs
 * mandatory). Blocks the lock-everyone-out combo (mandatory + no channel, FR-MFA-031). Applies to
 * subsequent logins only (FR-MFA-032).
 */
export function MfaSettingsView() {
  const { data, isLoading, isError, refetch } = useMfaPolicy();
  const save = useSaveMfaPolicy();

  const [smsEnabled, setSmsEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [enforcement, setEnforcement] = useState<Enforcement>("optional");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [otpTtl, setOtpTtl] = useState(300);
  const [cooldown, setCooldown] = useState(60);
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setSmsEnabled(data.sms_enabled);
    setEmailEnabled(data.email_enabled);
    setEnforcement(data.enforcement_mode);
    setOtpTtl(data.otp_ttl_seconds);
    setCooldown(data.resend_cooldown_seconds);
    setMaxAttempts(data.max_attempts);
  }, [data]);

  // FR-MFA-031: mandatory 2FA with no channel would lock every customer out.
  const noChannelGuard = enforcement === "mandatory" && !smsEnabled && !emailEnabled;

  async function onSave() {
    setError(null);
    if (noChannelGuard) {
      setError("Mandatory two-factor needs at least one channel (SMS or email) enabled.");
      return;
    }
    try {
      await save.mutateAsync({
        sms_enabled: smsEnabled,
        email_enabled: emailEnabled,
        enforcement_mode: enforcement,
        otp_ttl_seconds: otpTtl,
        resend_cooldown_seconds: cooldown,
        max_attempts: maxAttempts,
      });
      toast("MFA policy updated.");
    } catch (err) {
      if (err instanceof ApiError && err.code === "MFA_NO_CHANNEL") {
        setError("Mandatory two-factor needs at least one channel (SMS or email) enabled.");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("You don't have permission to change this.");
      } else {
        setError("Couldn't save. Try again.");
      }
    }
  }

  const numInput =
    "h-9 w-28 rounded-md border border-border bg-surface px-2 text-sm text-text focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600/30";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="h-5 w-5 text-text-muted" aria-hidden="true" />
        <div>
          <h1 className="text-[22px] font-bold leading-7 text-text">Two-factor authentication</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Control the second-factor login for customers — which channels they can receive codes on, and whether it&apos;s optional or required.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-error/10 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {isLoading ? (
        <Card><div className="h-64 animate-pulse rounded-lg bg-surface-subtle" /></Card>
      ) : isError ? (
        <Card>
          <div className="py-12 text-center">
            <p className="text-sm text-text-secondary">Couldn&apos;t load the MFA policy.</p>
            <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-accent-700 hover:underline">Try again</button>
          </div>
        </Card>
      ) : (
        <>
          {/* Channels */}
          <Card>
            <div className="p-4">
              <h2 className="text-sm font-semibold text-text">Channels</h2>
              <div className="mt-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-text">Email</p>
                    <p className="text-xs text-text-muted">On by default — the free, always-available channel.</p>
                  </div>
                  <Switch label="Email channel" checked={emailEnabled} onChange={setEmailEnabled} />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-text">SMS</p>
                    <p className="text-xs text-text-muted">Requires an SMS gateway to be configured in Notifications.</p>
                  </div>
                  <Switch label="SMS channel" checked={smsEnabled} onChange={setSmsEnabled} />
                </div>
              </div>
            </div>
          </Card>

          {/* Enforcement */}
          <Card>
            <div className="p-4">
              <h2 className="text-sm font-semibold text-text">Enforcement</h2>
              <div className="mt-3 space-y-2.5">
                {(
                  [
                    { v: "optional", t: "Optional", d: "Customers choose whether to turn 2FA on." },
                    { v: "mandatory", t: "Mandatory", d: "Every customer email + password login needs a code." },
                  ] as { v: Enforcement; t: string; d: string }[]
                ).map((o) => (
                  <label key={o.v} className="flex cursor-pointer items-start gap-3">
                    <input
                      type="radio"
                      name="enforcement"
                      value={o.v}
                      checked={enforcement === o.v}
                      onChange={() => setEnforcement(o.v)}
                      className="mt-0.5 h-4 w-4 text-accent-600 focus:ring-accent-600"
                    />
                    <span>
                      <span className="block text-sm font-medium text-text">{o.t}</span>
                      <span className="block text-xs text-text-muted">{o.d}</span>
                    </span>
                  </label>
                ))}
              </div>
              {noChannelGuard && (
                <p role="alert" className="mt-3 rounded-md bg-error/10 px-3 py-2 text-xs text-error">
                  Enable a channel before making two-factor mandatory.
                </p>
              )}
            </div>
          </Card>

          {/* Advanced */}
          <Card>
            <div className="p-4">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="flex w-full items-center justify-between text-sm font-semibold text-text"
                aria-expanded={advancedOpen}
              >
                Advanced
                <span className="text-text-muted">{advancedOpen ? "Hide" : "Show"}</span>
              </button>
              {advancedOpen && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <label className="block"><span className="mb-1 block text-xs text-text-muted">OTP lifetime (s)</span>
                    <input className={numInput} type="number" min={60} max={3600} value={otpTtl} onChange={(e) => setOtpTtl(Number(e.target.value))} /></label>
                  <label className="block"><span className="mb-1 block text-xs text-text-muted">Resend cooldown (s)</span>
                    <input className={numInput} type="number" min={15} max={600} value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} /></label>
                  <label className="block"><span className="mb-1 block text-xs text-text-muted">Max attempts</span>
                    <input className={numInput} type="number" min={3} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} /></label>
                </div>
              )}
            </div>
          </Card>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-text-muted">
              Applies to new logins only.
              {data?.updated_at && ` Last updated ${new Date(data.updated_at).toLocaleString("en-GB")}.`}
            </p>
            <Can permission="settings.setting.update">
              <Button onClick={onSave} loading={save.isPending} disabled={noChannelGuard}>
                Save changes
              </Button>
            </Can>
          </div>
        </>
      )}
    </div>
  );
}
