"use client";

/**
 * Error boundary for the admin section (fe-page-scaffold). Friendly message +
 * retry; admin UI may show the digest to help support, but never raw stack.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Something went wrong
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          The page failed to load. You can try again.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-gray-400">Ref: {error.digest}</p>
        )}
      </div>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Try again
      </button>
    </div>
  );
}
