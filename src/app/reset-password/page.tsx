import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetPasswordForm } from "./_components/ResetPasswordForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
