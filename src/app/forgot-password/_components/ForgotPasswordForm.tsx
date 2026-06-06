"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAdminForgotPassword } from "@/lib/api/hooks/useAuth";
import { forgotSchema, type ForgotFormValues } from "@/lib/validations/password-reset";

/**
 * Admin forgot-password form (rbac-admin-auth-fe, FR-RBAC-007). Always advances
 * to a generic "check your email" confirmation regardless of whether the email
 * exists (anti-enumeration, §12.12).
 */
export function ForgotPasswordForm() {
  const forgot = useAdminForgotPassword();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = handleSubmit((data) => forgot.mutateAsync(data.email).catch(() => undefined));

  if (forgot.isSuccess) {
    return (
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm" role="status">
        <h1 className="text-lg font-semibold text-gray-900">Check your email</h1>
        <p className="mt-2 text-sm text-gray-600">
          If an account exists for that address, we&apos;ve sent a link to reset your password.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-gray-900">Forgot your password?</h1>
      <p className="mt-1 text-sm text-gray-500">Enter your admin email and we&apos;ll send you a reset link.</p>

      <div className="mt-5 space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-gray-900">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting || forgot.isPending}
        aria-busy={isSubmitting || forgot.isPending}
        className="mt-5 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {isSubmitting || forgot.isPending ? "Sending…" : "Send reset link"}
      </button>

      <Link href="/login" className="mt-4 block text-center text-sm font-medium text-brand-700 hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
