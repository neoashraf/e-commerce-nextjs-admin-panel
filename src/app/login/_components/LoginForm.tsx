"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import {
  loginSchema,
  twoFaSchema,
  type LoginFormValues,
  type TwoFaFormValues,
} from "@/lib/validations/login";
import { mapApiErrorsToForm } from "@/lib/api/form-errors";
import {
  useAdminLogin,
  useAdminTwoFaVerify,
} from "@/lib/api/hooks/useAuth";

/**
 * Admin login form (fe-form-builder): RHF + Zod, API field-error mapping,
 * submit loading state, accessible field markup. Handles the optional 2FA step
 * returned by POST /admin/auth/login (docs/api-contracts/16-rbac.md).
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAdminLogin();
  const verify = useAdminTwoFaVerify();

  // Where to go after a successful sign-in (the shell guard sets ?next= on redirect).
  const next = searchParams.get("next") || "/admin/dashboard";
  const justReset = searchParams.get("reset") === "1";

  // null = credentials step; set = 2FA challenge in progress.
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const credForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const codeForm = useForm<TwoFaFormValues>({
    resolver: zodResolver(twoFaSchema),
    defaultValues: { code: "" },
  });

  const onCredentials = credForm.handleSubmit((data) => {
    setFormError(null);
    login.mutate(data, {
      onSuccess: (result) => {
        if ("twofa_required" in result) {
          setChallengeId(result.challenge_id);
        } else {
          router.replace(next);
        }
      },
      onError: (err) => {
        setFormError(mapApiErrorsToForm(err, credForm.setError));
      },
    });
  });

  const onVerify = codeForm.handleSubmit((data) => {
    if (!challengeId) return;
    setFormError(null);
    verify.mutate(
      { challenge_id: challengeId, code: data.code },
      {
        onSuccess: () => router.replace(next),
        onError: (err) => setFormError(mapApiErrorsToForm(err, codeForm.setError)),
      },
    );
  });

  const pending = login.isPending || verify.isPending;

  return (
    <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Admin sign in</h1>
      <p className="mt-1 text-sm text-gray-500">
        {challengeId
          ? "Enter the verification code sent to you."
          : "Sign in to the Sports E-Commerce admin panel."}
      </p>

      {justReset && !formError && (
        <p role="status" className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Your password has been reset. Sign in with your new password.
        </p>
      )}

      {formError && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {formError}
        </p>
      )}

      {!challengeId ? (
        <form onSubmit={onCredentials} className="mt-5 space-y-4" noValidate>
          <Field
            id="email"
            label="Email"
            type="email"
            autoComplete="username"
            error={credForm.formState.errors.email?.message}
            register={credForm.register("email")}
          />
          <Field
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            error={credForm.formState.errors.password?.message}
            register={credForm.register("password")}
          />
          <SubmitButton pending={pending} idle="Sign in" busy="Signing in…" />
          <Link
            href="/forgot-password"
            className="block text-center text-sm font-medium text-brand-700 hover:underline"
          >
            Forgot your password?
          </Link>
        </form>
      ) : (
        <form onSubmit={onVerify} className="mt-5 space-y-4" noValidate>
          <Field
            id="code"
            label="Verification code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            error={codeForm.formState.errors.code?.message}
            register={codeForm.register("code")}
          />
          <SubmitButton pending={pending} idle="Verify" busy="Verifying…" />
          <button
            type="button"
            onClick={() => {
              setChallengeId(null);
              setFormError(null);
            }}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
          >
            Back
          </button>
        </form>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  error,
  register,
  ...input
}: {
  id: string;
  label: string;
  error?: string;
  register: ReturnType<ReturnType<typeof useForm>["register"]>;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-900">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-required
        {...register}
        {...input}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                   focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30
                   aria-[invalid=true]:border-red-500"
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function SubmitButton({
  pending,
  idle,
  busy,
}: {
  pending: boolean;
  idle: string;
  busy: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white
                 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? busy : idle}
    </button>
  );
}
