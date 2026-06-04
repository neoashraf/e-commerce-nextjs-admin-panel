import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Page not found</h1>
        <p className="mt-1 text-sm text-gray-500">
          The page you’re looking for doesn’t exist.
        </p>
      </div>
      <Link
        href="/admin/dashboard"
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
