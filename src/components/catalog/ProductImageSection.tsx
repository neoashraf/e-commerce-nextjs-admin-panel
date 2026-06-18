"use client";

import { useEffect, useRef, useState } from "react";
import {
  useDeleteProductImage,
  useSetProductImagePrimary,
  useUpdateProductImageAlt,
  useUploadProductImage,
} from "@/lib/api/hooks/useCatalog";
import type { AdminProductImage } from "@/lib/api/schemas/catalog";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";
import { pickRendition } from "@/lib/media";

/**
 * Product image upload + gallery (FR-CAT-030/031/032).
 *  - Upload one OR several files at once (POST /admin/products/{id}/images per file). The alt text is
 *    applied to every file in the batch; refine each later by selecting it.
 *  - Click a thumbnail to SELECT it: its alt text loads into the box, and you can save an edited alt
 *    (PATCH .../images/{imageId}) or promote it to primary (PATCH .../images/{imageId}/primary).
 *  - Setting primary mirrors to Product.primary_image_id, so the storefront PDP (primary-first) always
 *    shows the currently-selected primary.
 * The gallery comes from the product detail (`images[]`) and refreshes on every mutation via query
 * invalidation.
 */
export function ProductImageSection({
  productId,
  hasPrimary,
  images = [],
}: {
  productId: string;
  hasPrimary: boolean;
  images?: AdminProductImage[];
}) {
  const upload = useUploadProductImage(productId);
  const setPrimary = useSetProductImagePrimary(productId);
  const updateAlt = useUpdateProductImageAlt(productId);
  const remove = useDeleteProductImage(productId);

  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [altText, setAltText] = useState("");
  const [makePrimary, setMakePrimary] = useState(!hasPrimary);
  // When set, the form acts on this existing image (alt edit / set primary / delete) rather than a new upload.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Two-step delete: first click arms the confirm, second click within the prompt commits.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedImage = selectedId ? images.find((i) => i.id === selectedId) ?? null : null;
  const editing = !!selectedImage;

  // Build (and clean up) local object-URL previews for the picked files, shown before upload.
  useEffect(() => {
    if (files.length === 0) {
      setPreviews([]);
      return;
    }
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const field =
    "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";
  const busy =
    upload.isPending || setPrimary.isPending || updateAlt.isPending || remove.isPending;

  /** Pick files for a NEW upload — exits any existing-image selection. */
  function onPickFiles(list: FileList | null) {
    setFiles(list ? Array.from(list) : []);
    setSelectedId(null);
    setConfirmingDelete(false);
    setError(null);
  }

  /** Select an existing gallery image to view/edit — loads its alt and exits upload mode. */
  function selectImage(img: AdminProductImage) {
    setSelectedId(img.id);
    setAltText(img.alt_text);
    setFiles([]);
    setConfirmingDelete(false);
    if (fileRef.current) fileRef.current.value = "";
    setError(null);
  }

  function resetForm() {
    setFiles([]);
    setAltText("");
    setSelectedId(null);
    setConfirmingDelete(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleError(err: unknown, fallback: string) {
    if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
      setError(err.message || fallback);
    } else {
      setError(fallback);
    }
  }

  async function onUpload() {
    setError(null);
    if (files.length === 0) {
      setError("Choose at least one image file first.");
      return;
    }
    if (!altText.trim()) {
      setError("Alt text is required for every image.");
      return;
    }
    try {
      // Upload sequentially; only the first carries is_primary so a batch promotes exactly one image.
      for (let i = 0; i < files.length; i++) {
        await upload.mutateAsync({
          file: files[i],
          alt_text: altText.trim(),
          is_primary: makePrimary && i === 0,
        });
      }
      toast(files.length > 1 ? `${files.length} images uploaded.` : "Image uploaded.");
      resetForm();
    } catch (err) {
      handleError(err, "Couldn't upload the image. Check the file — type, size, or alt text.");
    }
  }

  async function onSaveAlt() {
    if (!selectedImage) return;
    setError(null);
    if (!altText.trim()) {
      setError("Alt text can't be empty.");
      return;
    }
    try {
      await updateAlt.mutateAsync({ imageId: selectedImage.id, alt_text: altText.trim() });
      toast("Alt text updated.");
    } catch (err) {
      handleError(err, "Couldn't update the alt text. Try again.");
    }
  }

  async function onSetPrimary() {
    if (!selectedImage || selectedImage.is_primary) return;
    setError(null);
    try {
      await setPrimary.mutateAsync(selectedImage.id);
      toast("Primary image updated.");
    } catch (err) {
      handleError(err, "Couldn't set the primary image. Try again.");
    }
  }

  async function onDelete() {
    if (!selectedImage) return;
    setError(null);
    try {
      await remove.mutateAsync(selectedImage.id);
      toast(
        selectedImage.is_primary
          ? "Image deleted. Primary reassigned to the next image."
          : "Image deleted.",
      );
      resetForm();
    } catch (err) {
      handleError(err, "Couldn't delete the image. Try again.");
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

      {/* Existing gallery — click a thumbnail to select it (loads alt, enables set-primary). */}
      {images.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => selectImage(img)}
                aria-pressed={selectedId === img.id}
                className={
                  "group relative block w-full overflow-hidden rounded-md border bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-brand-500/40 " +
                  (selectedId === img.id
                    ? "border-brand-500 ring-2 ring-brand-500/40"
                    : "border-gray-200 hover:border-brand-300")
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pickRendition(img.renditions, img.url)}
                  alt={img.alt_text}
                  className="aspect-square w-full object-cover"
                />
                {img.is_primary && (
                  <span className="absolute left-1 top-1 rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Primary
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-400">
          No images yet. Upload the first one below.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {editing ? (
        // ── Edit mode: act on the selected existing image ──────────────────────────────
        <div className="space-y-4 rounded-md border border-brand-200 bg-brand-50/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">
              Editing selected image{selectedImage?.is_primary ? " (primary)" : ""}
            </span>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              + Add new image instead
            </button>
          </div>

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

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSaveAlt}
              disabled={busy}
              className="inline-flex h-10 items-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {updateAlt.isPending ? "Saving…" : "Save alt text"}
            </button>
            <button
              type="button"
              onClick={onSetPrimary}
              disabled={busy || selectedImage?.is_primary}
              className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {selectedImage?.is_primary
                ? "Already primary"
                : setPrimary.isPending
                  ? "Setting…"
                  : "Set as primary"}
            </button>

            {/* Delete — two-step inline confirm so it can't fire on a single stray click. */}
            {confirmingDelete ? (
              <span className="ml-auto inline-flex items-center gap-2">
                <span className="text-sm text-gray-600">Delete this image?</span>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {remove.isPending ? "Deleting…" : "Confirm delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className="ml-auto inline-flex h-10 items-center rounded-md border border-red-300 px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ) : (
        // ── Upload mode: add one or more new images ────────────────────────────────────
        <>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-900">Image file</span>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onPickFiles(e.target.files)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700"
            />
            <span className="mt-1 block text-xs text-gray-400">
              JPEG, PNG or WebP, up to 5 MB each. You can select multiple files.
            </span>
          </label>

          {/* Local previews of the picked files, before they are uploaded. */}
          {previews.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {previews.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={`Selected file ${i + 1} preview`}
                  className="h-20 w-20 rounded-md border border-gray-200 object-cover"
                />
              ))}
              <span className="text-xs text-gray-500">
                {previews.length === 1
                  ? "Preview — not uploaded yet."
                  : `${previews.length} files — not uploaded yet.`}
              </span>
            </div>
          )}

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
            {files.length > 1 && (
              <span className="mt-1 block text-xs text-gray-400">
                Applied to all {files.length} files — select a thumbnail afterward to refine each.
              </span>
            )}
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={makePrimary}
              onChange={(e) => setMakePrimary(e.target.checked)}
            />
            Set as primary image{files.length > 1 ? " (first file)" : ""}
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onUpload}
              disabled={busy}
              className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {upload.isPending
                ? "Uploading…"
                : files.length > 1
                  ? `Upload ${files.length} images`
                  : "Upload image"}
            </button>
          </div>
        </>
      )}

      <p className="text-xs text-gray-400">
        Click any thumbnail to edit its alt text, make it the primary image, or delete it. Deleting the
        primary promotes the next image automatically. Reordering still needs more backend support —
        flagged.
      </p>
    </section>
  );
}
