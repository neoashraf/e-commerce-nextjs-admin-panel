"use client";

import { useEffect, useRef, useState } from "react";
import {
  Upload,
  UploadCloud,
  ImageOff,
  AlertTriangle,
  Video,
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Star,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  useDeleteProductImage,
  useSetProductImagePrimary,
  useUpdateProductImage,
  useUploadProductImage,
  useReorderProductImages,
  useAddProductVideo,
  useDeleteProductVideo,
} from "@/lib/api/hooks/useCatalog";
import type {
  AdminProductImage,
  AdminProductVideo,
  ConfigurableAttribute,
} from "@/lib/api/schemas/catalog";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";
import { pickRendition } from "@/lib/media";

/**
 * Product Images & Videos (FR-CAT-030..034) — rebuilt to the design's media section
 * (docs/design/admin-panel-design-files/Product Editor (CAT).dc.html → "Images & Videos"):
 *  A. a persistent drag-&-drop dropzone (always visible),
 *  B. a pending-upload tray — per-file alt input + a single per-batch "Primary" pick — with Upload / Discard,
 *  C. a gallery grid whose tiles carry a hover action bar (grip · ↑ · ↓ · make-primary · delete),
 *     processing / primary / color badges, and a two-step delete-confirm overlay,
 *  D. an inline detail panel for the selected tile (alt text + color tag · Save / Set primary / Delete),
 *  E. a Videos sub-section (URL / upload source · add / remove).
 *
 * Wiring: upload (one POST per file), set-primary, alt+color PATCH, delete, and reorder
 * (PATCH .../images/reorder) are all live against the contract; reorder is optimistic and
 * rolls back on error. The color-tag select is populated from the product's `color`
 * configurable attribute and hides when the family exposes none. The gallery refreshes via
 * query invalidation on every mutation.
 */

type PendingFile = { id: string; file: File; preview: string; alt: string };

export function ProductImageSection({
  productId,
  hasPrimary,
  images = [],
  videos = [],
  colorOptions = [],
  embedded = false,
}: {
  productId: string;
  hasPrimary: boolean;
  images?: AdminProductImage[];
  videos?: AdminProductVideo[];
  /** Options of the product's `color` configurable attribute (for the per-image color tag). */
  colorOptions?: ConfigurableAttribute["options"];
  /** When true, render bare content (no outer card/heading) — the editor wraps it. */
  embedded?: boolean;
}) {
  const upload = useUploadProductImage(productId);
  const setPrimary = useSetProductImagePrimary(productId);
  const updateImage = useUpdateProductImage(productId);
  const remove = useDeleteProductImage(productId);
  const reorder = useReorderProductImages(productId);
  const addVideo = useAddProductVideo(productId);
  const deleteVideo = useDeleteProductVideo(productId);

  // ── Pending upload tray ──────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [pendingPrimaryId, setPendingPrimaryId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const seq = useRef(0);

  // ── Gallery selection / inline detail ────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailAlt, setDetailAlt] = useState("");
  const [detailColor, setDetailColor] = useState<string>("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // ── Drag reorder ─────────────────────────────────────────────────────────────
  const dragId = useRef<string | null>(null);

  // ── Add-video draft ──────────────────────────────────────────────────────────
  const [videoSource, setVideoSource] = useState<"url" | "upload">("url");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const selectedImage = selectedId ? images.find((i) => i.id === selectedId) ?? null : null;
  const hasColorOptions = colorOptions.length > 0;

  // Revoke object-URL previews when the tray clears / unmounts.
  useEffect(() => {
    return () => pending.forEach((p) => URL.revokeObjectURL(p.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the detail panel's fields in sync with the selected tile. Depend on the
  // image's stable fields (not the derived object, which is fresh each render) so
  // this only re-syncs when the selection or the upstream values actually change.
  const selectedAlt = selectedImage?.alt_text;
  const selectedColor = selectedImage?.color_option_id ?? "";
  useEffect(() => {
    if (selectedId) {
      setDetailAlt(selectedAlt ?? "");
      setDetailColor(selectedColor);
    }
  }, [selectedId, selectedAlt, selectedColor]);

  const busy =
    upload.isPending || setPrimary.isPending || updateImage.isPending || remove.isPending;

  function colorLabel(id: string | null | undefined): string | null {
    if (!id) return null;
    return colorOptions.find((o) => o.id === id)?.value ?? null;
  }
  function colorSwatch(id: string | null | undefined): string | null {
    if (!id) return null;
    return colorOptions.find((o) => o.id === id)?.swatch_value ?? null;
  }

  function handleError(err: unknown, fallback: string) {
    if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
      setError(err.message || fallback);
    } else {
      setError(fallback);
    }
  }

  // ── A/B. File picking → pending tray ─────────────────────────────────────────
  function addToPending(list: FileList | File[] | null) {
    const picked = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (picked.length === 0) {
      setError("Drop image files only (JPEG, PNG or WebP).");
      return;
    }
    setError(null);
    setSelectedId(null);
    setPending((prev) => [
      ...prev,
      ...picked.map((file) => ({
        id: `pd${(seq.current += 1)}`,
        file,
        preview: URL.createObjectURL(file),
        alt: "",
      })),
    ]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function setPendingAlt(id: string, alt: string) {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, alt } : p)));
  }

  function removePending(id: string) {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
    setPendingPrimaryId((cur) => (cur === id ? null : cur));
  }

  function discardPending() {
    pending.forEach((p) => URL.revokeObjectURL(p.preview));
    setPending([]);
    setPendingPrimaryId(null);
    setError(null);
  }

  async function onUploadPending() {
    setError(null);
    if (pending.length === 0) return;
    if (pending.some((p) => !p.alt.trim())) {
      setError("Alt text is required for every image.");
      return;
    }
    try {
      // Upload sequentially; the chosen pending file (if any) carries is_primary so
      // a batch promotes exactly one image. When none is chosen and the product has
      // no primary yet, the first uploaded image becomes primary.
      const promoteFallback = !hasPrimary;
      for (let i = 0; i < pending.length; i++) {
        const p = pending[i];
        const isPrimary = pendingPrimaryId
          ? p.id === pendingPrimaryId
          : promoteFallback && i === 0;
        await upload.mutateAsync({ file: p.file, alt_text: p.alt.trim(), is_primary: isPrimary });
      }
      toast(pending.length > 1 ? `${pending.length} images uploaded.` : "Image uploaded.");
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setPending([]);
      setPendingPrimaryId(null);
    } catch (err) {
      handleError(err, "Couldn't upload. Check each file — type, size (≤ 5 MB), and alt text.");
    }
  }

  // ── C. Gallery actions ───────────────────────────────────────────────────────
  function selectTile(img: AdminProductImage) {
    setSelectedId((cur) => (cur === img.id ? null : img.id));
    setConfirmingDeleteId(null);
  }

  async function onMakePrimary(img: AdminProductImage) {
    if (img.is_primary) return;
    setError(null);
    try {
      await setPrimary.mutateAsync(img.id);
      toast("Primary image set.");
    } catch (err) {
      handleError(err, "Couldn't set the primary image. Try again.");
    }
  }

  async function move(img: AdminProductImage, dir: -1 | 1) {
    const i = images.findIndex((x) => x.id === img.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= images.length) return;
    const ids = images.map((x) => x.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    persistOrder(ids);
  }

  function onDropReorder(targetId: string) {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === targetId) return;
    const ids = images.map((x) => x.id);
    const fi = ids.indexOf(from);
    const ti = ids.indexOf(targetId);
    if (fi < 0 || ti < 0) return;
    const [m] = ids.splice(fi, 1);
    ids.splice(ti, 0, m);
    persistOrder(ids);
  }

  async function persistOrder(orderedIds: string[]) {
    setError(null);
    try {
      await reorder.mutateAsync(orderedIds);
    } catch (err) {
      handleError(err, "Couldn't save the new order. Try again.");
    }
  }

  async function onConfirmDelete(img: AdminProductImage) {
    setError(null);
    try {
      await remove.mutateAsync(img.id);
      toast(
        img.is_primary
          ? "Image deleted. Primary reassigned to the next image."
          : "Image deleted.",
      );
      setConfirmingDeleteId(null);
      if (selectedId === img.id) setSelectedId(null);
    } catch (err) {
      handleError(err, "Couldn't delete the image. Try again.");
    }
  }

  // ── D. Detail panel ──────────────────────────────────────────────────────────
  async function onSaveDetail() {
    if (!selectedImage) return;
    setError(null);
    if (!detailAlt.trim()) {
      setError("Alt text is required for every image.");
      return;
    }
    const next: { imageId: string; alt_text?: string; color_option_id?: string | null } = {
      imageId: selectedImage.id,
    };
    if (detailAlt.trim() !== selectedImage.alt_text) next.alt_text = detailAlt.trim();
    if (hasColorOptions) {
      const nextColor = detailColor || null;
      if (nextColor !== (selectedImage.color_option_id ?? null)) next.color_option_id = nextColor;
    }
    if (next.alt_text === undefined && next.color_option_id === undefined) {
      toast("Nothing to save.");
      return;
    }
    try {
      await updateImage.mutateAsync(next);
      toast("Image saved.");
    } catch (err) {
      handleError(err, "Couldn't save the image. Try again.");
    }
  }

  // ── E. Videos ────────────────────────────────────────────────────────────────
  async function onAddVideo() {
    setVideoError(null);
    const url = videoUrl.trim();
    if (!url) { setVideoError("Enter a video URL."); return; }
    try { new URL(url); } catch { setVideoError("Enter a valid video URL."); return; }
    try {
      await addVideo.mutateAsync({ source: videoSource, url, display_order: videos.length });
      setVideoUrl("");
      toast("Video added.");
    } catch {
      toast("Couldn't add the video. Try again.", "error");
    }
  }

  async function onRemoveVideo(id: string) {
    try {
      await deleteVideo.mutateAsync(id);
      toast("Video removed.");
    } catch {
      toast("Couldn't remove the video. Try again.", "error");
    }
  }

  // ── Shared classes ───────────────────────────────────────────────────────────
  const field =
    "h-[36px] w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600";
  const tileBtn =
    "inline-flex h-[26px] w-[26px] items-center justify-center rounded-md bg-white/90 text-text-secondary shadow-xs transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40";

  const Wrapper = embedded ? "div" : "section";
  return (
    <Wrapper
      className={
        embedded ? "flex flex-col gap-[18px]" : "flex flex-col gap-[18px] rounded-lg border border-border bg-surface p-5"
      }
    >
      {!embedded && (
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-text">Images &amp; Videos</h2>
          <span className="text-xs tabular-nums text-text-muted">
            {images.length} {images.length === 1 ? "image" : "images"}
            {videos.length > 0 && ` · ${videos.length} ${videos.length === 1 ? "video" : "videos"}`}
          </span>
        </div>
      )}

      {/* ── A. PERSISTENT DROPZONE ─────────────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload images — drag and drop or browse"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addToPending(e.dataTransfer.files); }}
        className={
          "flex cursor-pointer flex-col items-center gap-2.5 rounded-lg border-[1.5px] border-dashed px-5 py-[26px] text-center transition-colors " +
          (dragOver ? "border-accent-600 bg-accent-50" : "border-border-strong bg-surface hover:bg-surface-subtle")
        }
      >
        <span className="flex h-[42px] w-[42px] items-center justify-center rounded-lg bg-accent-50 text-accent-600">
          <Upload className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="text-[13.5px] font-semibold text-text-secondary">
          Drag &amp; drop images here, or <span className="text-accent-600">browse</span>
        </div>
        <div className="text-xs text-text-muted">JPEG, PNG or WebP, up to 5 MB each. You can select multiple files.</div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => addToPending(e.target.files)}
          className="hidden"
        />
      </div>

      {/* ── B. PENDING UPLOAD TRAY ─────────────────────────────────────────────── */}
      {pending.length > 0 && (
        <div className="rounded-lg border border-accent-100 bg-accent-50 p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2.5">
            <span className="text-[13px] font-bold text-accent-700">Pending upload · {pending.length}</span>
            <span className="text-[11.5px] text-text-secondary">Alt text is required for every image.</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-2.5 py-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" className="h-[42px] w-[42px] shrink-0 rounded-md border border-border object-cover" />
                <input
                  type="text"
                  aria-label="Alt text for pending image"
                  placeholder="Add alt text (required)…"
                  value={p.alt}
                  onChange={(e) => setPendingAlt(p.id, e.target.value)}
                  maxLength={160}
                  className={
                    "h-[34px] min-w-0 flex-1 rounded-md border bg-surface px-2.5 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600 " +
                    (p.alt.trim() ? "border-border-strong" : "border-warning/60")
                  }
                />
                <button
                  type="button"
                  onClick={() => setPendingPrimaryId((cur) => (cur === p.id ? null : p.id))}
                  aria-pressed={pendingPrimaryId === p.id}
                  className={
                    "inline-flex h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-semibold transition " +
                    (pendingPrimaryId === p.id
                      ? "border-accent-600 bg-accent-600 text-accent-fg"
                      : "border-border-strong bg-surface text-text-secondary hover:bg-surface-subtle")
                  }
                >
                  <span
                    className={
                      "inline-flex h-[13px] w-[13px] items-center justify-center rounded-full border-[1.5px] " +
                      (pendingPrimaryId === p.id ? "border-accent-fg" : "border-border-strong")
                    }
                  >
                    {pendingPrimaryId === p.id && <span className="h-1.5 w-1.5 rounded-full bg-accent-fg" />}
                  </span>
                  Primary
                </button>
                <button
                  type="button"
                  onClick={() => removePending(p.id)}
                  aria-label="Remove pending image"
                  className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface text-error hover:bg-error-50"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onUploadPending}
              disabled={upload.isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-[15px] text-[13px] font-semibold text-accent-fg hover:bg-accent-700 disabled:opacity-50"
            >
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              {upload.isPending
                ? "Uploading…"
                : pending.length > 1
                  ? `Upload ${pending.length} images`
                  : "Upload image"}
            </button>
            <button
              type="button"
              onClick={discardPending}
              disabled={upload.isPending}
              className="h-9 rounded-md px-3 text-[13px] font-semibold text-text-secondary hover:bg-surface-subtle disabled:opacity-50"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-error-50 px-3 py-2 text-sm text-error">{error}</p>
      )}

      {/* ── C. GALLERY ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="mb-2.5 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-text">Gallery</h3>
            <span className="text-[11.5px] tabular-nums text-text-muted">
              {images.length} {images.length === 1 ? "image" : "images"}
            </span>
          </div>
          {images.length > 0 && (
            <span className="text-[11.5px] text-text-muted">Drag, or use ↑ ↓, to reorder.</span>
          )}
        </div>

        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-subtle px-5 py-9 text-center">
            <span className="mb-3 flex h-[42px] w-[42px] items-center justify-center rounded-full bg-surface text-text-muted">
              <ImageOff className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="text-[13.5px] font-semibold text-text">No images yet. Upload the first one above.</div>
            <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              A published product needs at least one image.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {images.map((img, idx) => {
              const cLabel = colorLabel(img.color_option_id);
              const cSwatch = colorSwatch(img.color_option_id);
              return (
                <div
                  key={img.id}
                  draggable
                  onDragStart={() => { dragId.current = img.id; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); onDropReorder(img.id); }}
                  onClick={() => selectTile(img)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") selectTile(img); }}
                  aria-label={`Image: ${img.alt_text}`}
                  className={
                    "group relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 bg-surface-subtle transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 " +
                    (selectedId === img.id ? "border-accent-600" : "border-border hover:border-accent-500")
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pickRendition(img.renditions, img.url)}
                    alt={img.alt_text}
                    className="h-full w-full object-cover"
                  />

                  {/* top action bar — visible on hover / focus / when selected */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={
                      "absolute inset-x-0 top-0 flex items-center justify-between gap-1 bg-gradient-to-b from-black/50 to-transparent p-1.5 transition-opacity " +
                      (selectedId === img.id ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100")
                    }
                  >
                    <span className="inline-flex h-[26px] w-[26px] cursor-grab items-center justify-center text-white" title="Drag to reorder">
                      <GripVertical className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => move(img, -1)} disabled={idx === 0 || reorder.isPending} aria-label="Move up" className={tileBtn}>
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => move(img, 1)} disabled={idx === images.length - 1 || reorder.isPending} aria-label="Move down" className={tileBtn}>
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => onMakePrimary(img)} disabled={img.is_primary || busy} aria-label="Make primary" title="Make primary" className={tileBtn + (img.is_primary ? " text-accent-600" : "")}>
                        <Star className={"h-3.5 w-3.5 " + (img.is_primary ? "fill-accent-600" : "")} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => setConfirmingDeleteId(img.id)} aria-label="Delete image" title="Delete" className={tileBtn + " text-error"}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* primary badge */}
                  {img.is_primary && (
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-accent-600 px-2 py-0.5 text-[11px] font-semibold text-accent-fg">
                      <Star className="h-3 w-3 fill-current" aria-hidden="true" />Primary
                    </span>
                  )}

                  {/* color tag */}
                  {cLabel && (
                    <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-text-secondary shadow-xs">
                      <span
                        className="h-[9px] w-[9px] rounded-full border border-border"
                        style={cSwatch ? { backgroundColor: cSwatch } : undefined}
                      />
                      {cLabel}
                    </span>
                  )}

                  {/* two-step delete confirm overlay */}
                  {confirmingDeleteId === img.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/80 p-3"
                    >
                      <span className="text-center text-[13px] font-semibold text-white">Delete this image?</span>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => onConfirmDelete(img)} disabled={remove.isPending} className="h-8 rounded-md bg-error px-3 text-[12.5px] font-semibold text-white hover:bg-error/90 disabled:opacity-50">
                          {remove.isPending ? "Deleting…" : "Delete"}
                        </button>
                        <button type="button" onClick={() => setConfirmingDeleteId(null)} disabled={remove.isPending} className="h-8 rounded-md bg-white/90 px-3 text-[12.5px] font-semibold text-text-secondary hover:bg-white disabled:opacity-50">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── D. INLINE DETAIL PANEL ─────────────────────────────────────────────── */}
      {selectedImage && (
        <div className="flex flex-wrap gap-4 rounded-lg border-[1.5px] border-accent-600 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pickRendition(selectedImage.renditions, selectedImage.url)}
            alt={selectedImage.alt_text}
            className="h-[140px] w-[140px] shrink-0 rounded-lg border border-border object-cover"
          />
          <div className="min-w-[220px] flex-1">
            <div className="mb-3 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-accent-600" aria-hidden="true" />
                <h3 className="text-[13.5px] font-semibold text-text">Image details</h3>
                {selectedImage.is_primary && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-700">
                    <Star className="h-3 w-3 fill-current" aria-hidden="true" />Primary
                  </span>
                )}
              </div>
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Close details" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:bg-surface-subtle">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className={"grid items-start gap-3 " + (hasColorOptions ? "grid-cols-1 sm:grid-cols-[1fr_180px]" : "grid-cols-1")}>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">Alt text <span className="text-error">*</span></span>
                <input
                  type="text"
                  className={field}
                  value={detailAlt}
                  onChange={(e) => setDetailAlt(e.target.value)}
                  maxLength={160}
                  placeholder="Describe the image…"
                  aria-required
                />
                {!detailAlt.trim() && <span className="mt-1 block text-[11.5px] text-error">Alt text is required for every image.</span>}
              </label>
              {hasColorOptions && (
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">Color tag</span>
                  <select
                    aria-label="Color tag"
                    value={detailColor}
                    onChange={(e) => setDetailColor(e.target.value)}
                    className={field + " cursor-pointer"}
                  >
                    <option value="">None</option>
                    {colorOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.value}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <button type="button" onClick={onSaveDetail} disabled={busy} className="inline-flex h-[34px] items-center rounded-md bg-accent-600 px-3.5 text-[12.5px] font-semibold text-accent-fg hover:bg-accent-700 disabled:opacity-50">
                {updateImage.isPending ? "Saving…" : "Save"}
              </button>
              {!selectedImage.is_primary && (
                <button type="button" onClick={() => onMakePrimary(selectedImage)} disabled={busy} className="inline-flex h-[34px] items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-[12.5px] font-semibold text-text hover:bg-surface-subtle disabled:opacity-50">
                  <Star className="h-3.5 w-3.5" aria-hidden="true" />Set primary
                </button>
              )}
              <button type="button" onClick={() => onConfirmDelete(selectedImage)} disabled={busy} className="ml-auto inline-flex h-[34px] items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold text-error hover:bg-error-50 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── E. VIDEOS ──────────────────────────────────────────────────────────── */}
      <div className="border-t border-border pt-4">
        <div className="mb-2.5 flex items-center gap-2">
          <Video className="h-4 w-4 text-accent-600" aria-hidden="true" />
          <h3 className="text-[13px] font-semibold text-text">Videos</h3>
          <span className="text-[11.5px] tabular-nums text-text-muted">
            {videos.length} {videos.length === 1 ? "video" : "videos"}
          </span>
        </div>

        {videos.length === 0 ? (
          <div className="pb-3 text-[12.5px] text-text-muted">No videos yet.</div>
        ) : (
          <div className="mb-3 flex flex-col gap-2.5">
            {videos.map((v) => (
              <div key={v.id} className="flex items-center gap-2.5">
                <span className="inline-flex h-9 shrink-0 items-center rounded-md border border-border-strong bg-surface-subtle px-2.5 text-xs font-semibold text-text-secondary">
                  {v.source === "upload" ? "Upload" : "URL"}
                </span>
                <a
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-accent-700 hover:underline"
                >
                  {v.url}
                </a>
                <button
                  type="button"
                  onClick={() => onRemoveVideo(v.id)}
                  disabled={deleteVideo.isPending}
                  aria-label="Remove video"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface text-error hover:bg-error-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add-video row: source select + URL input + Add. */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Video source"
            value={videoSource}
            onChange={(e) => setVideoSource(e.target.value as "url" | "upload")}
            className="h-9 w-[104px] shrink-0 cursor-pointer rounded-md border border-border-strong bg-surface px-2.5 text-sm font-medium text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          >
            <option value="url">URL</option>
            <option value="upload">Upload</option>
          </select>
          <input
            type="text"
            aria-label="Video URL"
            placeholder="https://…"
            value={videoUrl}
            onChange={(e) => { setVideoUrl(e.target.value); setVideoError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddVideo(); } }}
            className={
              "h-9 min-w-0 flex-1 rounded-md border bg-surface px-3 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600 " +
              (videoError ? "border-error" : "border-border-strong")
            }
          />
          <button
            type="button"
            onClick={onAddVideo}
            disabled={addVideo.isPending}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-[12.5px] font-semibold text-text hover:bg-surface-subtle disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />{addVideo.isPending ? "Adding…" : "Add video"}
          </button>
        </div>
        {videoError && <p className="mt-2 text-[11.5px] text-error">{videoError}</p>}
      </div>
    </Wrapper>
  );
}
