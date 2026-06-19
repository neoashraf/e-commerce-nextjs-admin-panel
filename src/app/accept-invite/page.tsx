import { Suspense } from "react";
import type { Metadata } from "next";
import { AcceptInviteForm } from "./_components/AcceptInviteForm";

export const metadata: Metadata = { title: "Accept invitation" };

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
