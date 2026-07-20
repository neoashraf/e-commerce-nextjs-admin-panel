"use client";

import { useEffect, useRef, useState } from "react";
import { useConfirmTwoFa, useUpdateTwoFa } from "@/lib/api/hooks/useMe";
import type { MeProfile, TwoFaVerification } from "@/lib/api/schemas/me";
import { ApiError } from "@/lib/api/errors";

/**
 * Own-2FA control (rbac-admin-2fa-confirm-fe, contract 16 v0.2). Email-only —
 * no channel choice; codes always go to the account email (shown masked).
 * Enable is two-step: password → emailed code → confirmed (the toggle stays OFF
 * until confirm, FR-RBAC-008). Disable needs a fresh emailed code when this
 * session did not pass the 2FA step at login (`session_mfa_verified`,
 * FR-RBAC-009). Every admin — including Super Admin — sees the same control.
 */
export function TwoFactorControl({ me }: { me: MeProfile }) {
  const update = useUpdateTwoFa();
  const confirm = useConfirmTwoFa();
  const enabled = me.two_fa_enabled ?? false;

  const [step, setStep] = useState<"idle" | "password" | "code">("idle");
  const [intent, setIntent] = useState<"enable" | "disable">("enable");
  const [password, setPassword] = useState("");
  const [verification, setVerification] = useState<TwoFaVerification | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [resendLeft, setResendLeft] = useState(0);

  // Resend cooldown ticker (server stays authoritative — a premature resend 429s).
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (resendLeft <= 0) return;
    timer.current = setInterval(() => setResendLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [resendLeft]);

  const reset = () => {
    setStep("idle");
    setPassword("");
    setVerification(null);
    setCode("");
    setError(null);
  };

  function fail(err: unknown, fallback: string) {
    if (err instanceof ApiError && err.status === 401) setError("That password is incorrect.");
    else if (err instanceof ApiError && err.status === 429)
      setError("Too many codes requested — wait a moment and try again.");
    else if (err instanceof ApiError && err.status === 400)
      setError("That code is wrong or has expired. Try again or send a new one.");
    else setError(fallback);
  }

  /** Step 1 (both intents): submit the password; a `verification` means a code was emailed. */
  async function submitPassword() {
    setError(null);
    setDone(null);
    if (!password) {
      setError("Enter your current password to confirm.");
      return;
    }
    try {
      const res = await update.mutateAsync({ enabled: intent === "enable", current_password: password });
      if (res.verification) {
        setVerification(res.verification);
        setResendLeft(res.verification.resend_after ?? 60);
        setCode("");
        setStep("code");
        return;
      }
      // Disable from a 2FA-verified session completes password-only (FR-RBAC-009).
      finish(res.two_fa_enabled);
    } catch (err) {
      fail(err, "Something went wrong. Try again.");
    }
  }

  /** Step 2: the emailed code — confirm (enable) or complete the disable. */
  async function submitCode() {
    setError(null);
    if (code.length < 6) return;
    try {
      if (intent === "enable") {
        const res = await confirm.mutateAsync({ challenge_id: (verification as TwoFaVerification).challenge_id, code });
        finish(res.two_fa_enabled);
      } else {
        const res = await update.mutateAsync({ enabled: false, current_password: password, code });
        finish(res.two_fa_enabled);
      }
    } catch (err) {
      setCode("");
      fail(err, "Couldn't verify the code. Try again.");
    }
  }

  /** Re-send: re-submitting the password step issues a fresh code (cooldown-limited). */
  async function resend() {
    setError(null);
    try {
      const res = await update.mutateAsync({ enabled: intent === "enable", current_password: password });
      if (res.verification) {
        setVerification(res.verification);
        setResendLeft(res.verification.resend_after ?? 60);
        setCode("");
      }
    } catch (err) {
      fail(err, "Couldn't send a new code. Try again.");
    }
  }

  function finish(nowEnabled: boolean) {
    reset();
    setDone(
      nowEnabled
        ? "Two-factor authentication is on. Other sessions have been signed out."
        : "Two-factor authentication is off. Other sessions have been signed out.",
    );
  }

  const pending = update.isPending || confirm.isPending;
  const field = "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="border-t border-gray-100 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Two-factor authentication</p>
          <p id="twofa-status" className="text-sm text-gray-500">
            {enabled ? "On — codes go to your account email" : "Off"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIntent(enabled ? "disable" : "enable");
            setStep((s) => (s === "idle" ? "password" : "idle"));
            setError(null);
            setDone(null);
            setPassword("");
            setVerification(null);
            setCode("");
          }}
          className="inline-flex h-9 items-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          {step !== "idle" ? "Cancel" : enabled ? "Disable" : "Enable"}
        </button>
      </div>

      {done && <p role="status" className="mt-2 text-sm text-green-700">{done}</p>}

      {step === "password" && (
        <div className="mt-4 space-y-3 rounded-md bg-gray-50 p-4">
          <p className="text-sm text-gray-600">
            {intent === "enable"
              ? "We'll email a code to confirm it's you — 2FA turns on only after you enter it."
              : me.session_mfa_verified
                ? "Confirm your password to turn off two-factor authentication."
                : "Confirm your password — we'll also email a code to verify it's you."}
          </p>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-900">Current password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} autoComplete="current-password" />
          </label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={() => void submitPassword()}
            disabled={pending || !password}
            className="inline-flex h-10 items-center rounded-md bg-gray-900 px-5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {pending ? "Working…" : intent === "enable" ? "Email me a code" : "Turn off two-factor"}
          </button>
        </div>
      )}

      {step === "code" && verification && (
        <div className="mt-4 space-y-3 rounded-md bg-gray-50 p-4">
          <p aria-live="polite" className="text-sm text-gray-600">
            Enter the code we emailed to <span className="font-medium text-gray-900">{verification.sent_to}</span>.
          </p>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-900">Verification code</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                setError(null);
              }}
              className={`${field} max-w-[220px] text-center text-lg font-semibold tracking-[0.4em]`}
            />
          </label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void submitCode()}
              disabled={pending || code.length < 6}
              className="inline-flex h-10 items-center rounded-md bg-gray-900 px-5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {pending ? "Verifying…" : intent === "enable" ? "Turn on two-factor" : "Turn off two-factor"}
            </button>
            <button
              type="button"
              onClick={() => void resend()}
              disabled={pending || resendLeft > 0}
              className="text-sm font-medium text-brand-600 underline hover:no-underline disabled:no-underline disabled:opacity-60"
            >
              {resendLeft > 0 ? `Resend in ${resendLeft}s` : "Resend code"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
