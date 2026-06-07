import Link from "next/link";

/**
 * In-app 403 view (rbac-admin-shell-fe AC4, §12.10). Shown when an admin
 * deep-links a route they lack the permission for — a graceful page, not a
 * crash. UI gating is cosmetic; the backend would also reject the request.
 */
export function ForbiddenView() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-3xl font-bold text-gray-300">403</p>
      <h1 className="text-lg font-semibold text-gray-900">You don&apos;t have access to this area</h1>
      <p className="max-w-sm text-sm text-gray-500">
        Your role doesn&apos;t include permission for this page. If you think this is a
        mistake, ask a Super Admin to update your role.
      </p>
      <Link
        href="/admin/dashboard"
        className="mt-2 inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
