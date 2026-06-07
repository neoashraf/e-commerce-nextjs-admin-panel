"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAdminResetPassword } from "@/lib/api/hooks/useAuth";
import { resetSchema, passwordRules, type ResetFormValues } from "@/lib/validations/password-reset";
import { ApiError } from "@/lib/api/errors";

/**
 * Admin reset/set-password form (rbac-admin-auth-fe, FR-RBAC-007). Reads the
 * tokenized link, enforces the live password checklist, and on success routes
 * to login with a banner. A 410 (expired/used) token shows the token-error card.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const reset = useAdminResetPassword();
  const [tokenError, setTokenError] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({ resolver: zodResolver(resetSchema), defaultValues: { new_password: "" } });

  const pwd = watch("new_password") ?? "";

  const onSubmit = handleSubmit(async (data) => {
    setTokenError(false);
    try {
      await reset.mutateAsync({ token, new_password: data.new_password });
      router.replace("/login?reset=1");
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) setTokenError(true);
      else if (err instanceof ApiError && err.status === 400) {
        setError("new_password", { message: "Choose a stronger password." });
      } else {
        setError("new_password", { message: "Something went wrong. Try again." });
      }
    }
  });

  if (!token || tokenError) {
    return (
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">This link has expired</h1>
        <p className="mt-2 text-sm text-gray-600">
          Your reset link is invalid or has already been used. Request a new one.
        </p>
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-gray-900">Set a new password</h1>

      <div className="mt-5 space-y-1.5">
        <label htmlFor="new_password" className="block text-sm font-medium text-gray-900">New password</label>
        <input
          id="new_password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.new_password}
          aria-describedby="password-rules"
          {...register("new_password")}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </div>

      <ul id="password-rules" className="mt-3 space-y-1">
        {passwordRules.map((rule) => {
          const ok = rule.test(pwd);
          return (
            <li key={rule.key} className={"flex items-center gap-2 text-xs " + (ok ? "text-green-700" : "text-gray-500")}>
              <span aria-hidden="true">{ok ? "✓" : "○"}</span>
              {rule.label}
            </li>
          );
        })}
      </ul>

      {errors.new_password && (
        <p role="alert" className="mt-2 text-sm text-red-600">{errors.new_password.message}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || reset.isPending}
        aria-busy={isSubmitting || reset.isPending}
        className="mt-5 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {isSubmitting || reset.isPending ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}
