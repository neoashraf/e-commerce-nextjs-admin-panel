"use client";

import { useRef, useState } from "react";
import { useUploadProductImage } from "@/lib/api/hooks/useCatalog";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";

/**
 * Product image upload (FR-CAT-030/031/032). Upload-only: the admin API supports
 * POST /admin/products/{id}/images (with is_primary) but has no list/delete/
 * reorder endpoints yet, so this clears the `no_primary_image` publish blocker
 * but can't show or manage an existing gallery. A full gallery is flagged for BE.
 *
 * `hasPrimary` is driven by the parent (product.primary_image_id) so the UI shows
 * whether the publish requirement is already met.
 */
export function ProductImageSection({
  productId,
  hasPrimary,
}: {
  productId: string;
  hasPrimary: boolean;
}) {
  const upload = useUploadProductImage(productId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [makePrimary, setMakePrimary] = useState(!hasPrimary);
  const [error, setError] = useState<string | null>(null);

  const field =
    "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  async function onUpload() {
    setError(null);
    if (!file) {
      setError("Choose an image file first.");
      return;
    }
    if (!altText.trim()) {
      setError("Alt text is required for every image.");
      return;
    }
    try {
      await upload.mutateAsync({ file, alt_text: altText.trim(), is_primary: makePrimary });
      toast("Image uploaded.");
      setFile(null);
      setAltText("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError(err.message || "Check the file — type, size, or alt text.");
      } else {
        setError("Couldn't upload the image. Try again.");
      }
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Images</h2>
        <span
          className={
            "rounded-full px-2 py-0.5 text-xs font-medium " +
            (hasPrimary ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")
          }
        >
          {hasPrimary ? "Primary image set" : "No primary image yet"}
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-900">Image file</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700"
        />
        <span className="mt-1 block text-xs text-gray-400">JPEG, PNG or WebP, up to 5 MB.</span>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-900">Alt text *</span>
        <input
          className={field}
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          maxLength={160}
          placeholder="Describe the image for accessibility"
          aria-required
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={makePrimary}
          onChange={(e) => setMakePrimary(e.target.checked)}
        />
        Set as primary image
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onUpload}
          disabled={upload.isPending}
          className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {upload.isPending ? "Uploading…" : "Upload image"}
        </button>
      </div>

      <p className="text-xs text-gray-400">
        Managing the full image gallery (viewing, reordering, deleting) needs more backend
        support — flagged. For now you can upload images and set the primary one.
      </p>
    </section>
  );
}
