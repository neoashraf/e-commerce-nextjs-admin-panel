"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Box, Layers, X } from "lucide-react";
import { useFamilies } from "@/lib/api/hooks/useCatalog";
import { cn } from "@/lib/cn";

type ProductType = "simple" | "configurable";

/** SKU rule (Validation Rules · FR-CAT-010): 1–64 chars, letters/digits/hyphens. */
function validateSku(value: string): { ok: boolean; error: string } {
  const t = value.trim();
  if (t.length === 0) return { ok: false, error: "SKU is required." };
  if (!/^[A-Za-z0-9-]{1,64}$/.test(t)) return { ok: false, error: "Use letters, numbers, and hyphens only." };
  return { ok: true, error: "" };
}

/**
 * Create-Product dialog (FR-CAT-010 · Products (CAT) design). Collects Type
 * (segmented; immutable after create), Attribute Family (immutable after
 * create), and a validated SKU, then opens the editor — the editor's first Save
 * is what actually creates the product (no orphan drafts). role="dialog"
 * aria-modal, focus moves in on open, Esc + scrim dismiss, focus restored on
 * close. The type/family/sku ride to the editor as query params.
 */
export function CreateProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { data: families } = useFamilies();
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const [type, setType] = useState<ProductType>("configurable");
  const [familyId, setFamilyId] = useState("");
  const [sku, setSku] = useState("");
  const [touched, setTouched] = useState(false);

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) { setType("configurable"); setFamilyId(""); setSku(""); setTouched(false); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLElement>("button, select, input")?.focus(),
    );
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      prevFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const skuV = validateSku(sku);
  const canContinue = !!familyId && skuV.ok;
  const showSkuError = touched && !skuV.ok;

  function onContinue() {
    setTouched(true);
    if (!canContinue) return;
    const params = new URLSearchParams({ type, family: familyId, sku: sku.trim() });
    onClose();
    router.push(`/admin/products/new?${params.toString()}`);
  }

  const typeOptions: { value: ProductType; label: string; Icon: typeof Box }[] = [
    { value: "simple", label: "Simple", Icon: Box },
    { value: "configurable", label: "Configurable", Icon: Layers },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-text/40"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-[460px] max-w-full overflow-hidden rounded-2xl bg-surface shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h3 id={titleId} className="text-[15.5px] font-bold text-text">Create New Product</h3>
            <p className="mt-1 text-[12.5px] leading-snug text-text-muted">
              Opens the editor — the first Save there creates the product.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text-secondary hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Type — segmented; immutable after create (FR-CAT-065) */}
          <div>
            <span className="mb-1.5 block text-eyebrow uppercase tracking-wide text-text-muted">Type</span>
            <div role="radiogroup" aria-label="Product type" className="flex gap-1 rounded-md bg-surface-subtle p-[3px]">
              {typeOptions.map(({ value, label, Icon }) => {
                const on = type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setType(value)}
                    className={cn(
                      "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[6px] text-[13px] font-semibold transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
                      on ? "bg-surface text-text shadow-xs" : "text-text-muted hover:text-text-secondary",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
            <span className="mt-1.5 block text-[11.5px] leading-snug text-text-muted">
              Simple is one SKU; Configurable adds variants. Can’t change later.
            </span>
          </div>

          {/* Family — select; immutable after create (FR-CAT-065) */}
          <label className="block">
            <span className="mb-1.5 block text-eyebrow uppercase tracking-wide text-text-muted">Family</span>
            <div className="relative">
              <select
                aria-label="Attribute family"
                value={familyId}
                onChange={(e) => setFamilyId(e.target.value)}
                className="h-10 w-full appearance-none rounded-md border border-border-strong bg-surface pl-3 pr-9 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1"
              >
                <option value="">Choose a family…</option>
                {families?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <span className="mt-1.5 block text-[11.5px] leading-snug text-text-muted">
              Decides which fields this product has — can’t change later.
            </span>
          </label>

          {/* SKU — mono input; 1–64 chars, letters/numbers/hyphens */}
          <label className="block">
            <span className="mb-1.5 block text-eyebrow uppercase tracking-wide text-text-muted">SKU</span>
            <input
              type="text"
              aria-label="SKU"
              aria-invalid={showSkuError || undefined}
              maxLength={64}
              placeholder="e.g. PRED-ELITE"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              onBlur={() => setTouched(true)}
              className={cn(
                "h-10 w-full rounded-md border bg-surface px-3 font-mono text-sm tracking-wide text-text",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1",
                showSkuError ? "border-error" : "border-border-strong",
              )}
            />
            {showSkuError ? (
              <span className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-error">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {skuV.error}
              </span>
            ) : (
              <span className="mt-1.5 block text-[11.5px] text-text-muted">Letters, numbers, and hyphens only.</span>
            )}
          </label>
        </div>

        <div className="mt-2 flex items-center justify-end gap-2.5 border-t border-border px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onContinue}
            aria-disabled={!canContinue}
            className={cn(
              "inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold text-accent-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2",
              canContinue ? "bg-accent-600 hover:bg-accent-700" : "cursor-not-allowed bg-border-strong opacity-70",
            )}
          >
            Save Product
          </button>
        </div>
      </div>
    </div>
  );
}
