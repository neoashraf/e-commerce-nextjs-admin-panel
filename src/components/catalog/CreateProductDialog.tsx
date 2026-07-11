"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Layers, X } from "lucide-react";
import { useFamilies } from "@/lib/api/hooks/useCatalog";
import { Button, Select } from "@/components/ui";

type ProductType = "simple" | "configurable";

/** SKU rule (Products (CAT) design · FR-CAT-010): 1–64 chars, letters/numbers/hyphens only. */
function validateSku(raw: string): { ok: boolean; error: string } {
  const t = raw.trim();
  if (t.length === 0) return { ok: false, error: "SKU is required." };
  if (!/^[A-Za-z0-9-]{1,64}$/.test(t)) return { ok: false, error: "Use letters, numbers, and hyphens only." };
  return { ok: true, error: "" };
}

const TYPE_OPTIONS: { key: ProductType; label: string; Icon: typeof Box }[] = [
  { key: "simple", label: "Simple", Icon: Box },
  { key: "configurable", label: "Configurable", Icon: Layers },
];

/**
 * Create-product dialog (Products (CAT) design · FR-CAT-010). Collects the three
 * immutable-after-create fields — Type (Simple/Configurable) · Attribute family ·
 * SKU — then opens the family-driven editor (its first Save creates the product,
 * so no orphan drafts). Mirrors ConfirmDialog's a11y: role=dialog, Esc + scrim
 * dismiss, focus-in on open + restored on close.
 */
export function CreateProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { data: families } = useFamilies();
  const [type, setType] = useState<ProductType>("configurable");
  const [familyId, setFamilyId] = useState("");
  const [sku, setSku] = useState("");
  const [touched, setTouched] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  const skuCheck = useMemo(() => validateSku(sku), [sku]);
  const canSubmit = !!familyId && skuCheck.ok;

  useEffect(() => {
    if (!open) return;
    // Reset to defaults each time the dialog opens.
    setType("configurable");
    setFamilyId("");
    setSku("");
    setTouched(false);
    prevFocus.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLElement>("button, select, input")?.focus(),
    );
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      prevFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  function submit() {
    if (!canSubmit) {
      setTouched(true);
      return;
    }
    const qs = new URLSearchParams({ type, family: familyId, sku: sku.trim() });
    router.push(`/admin/products/new?${qs.toString()}`);
  }

  const showSkuError = touched && !skuCheck.ok;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create product"
        className="relative w-full max-w-[460px] overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 pb-3.5 pt-4">
          <div className="min-w-0">
            <h2 className="text-[15.5px] font-bold tracking-tight text-text">Create New Product</h2>
            <p className="mt-1 text-xs leading-snug text-text-muted">
              Opens the editor — the first Save there creates the product.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg border border-border text-text-secondary hover:bg-surface-subtle"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 pb-1 pt-4">
          {/* Type */}
          <div>
            <span className="mb-1.5 block text-eyebrow font-semibold uppercase tracking-wide text-text-muted">
              Type
            </span>
            <div role="radiogroup" aria-label="Product type" className="flex gap-1 rounded-lg bg-surface-subtle p-1">
              {TYPE_OPTIONS.map(({ key, label, Icon }) => {
                const active = type === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setType(key)}
                    className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-semibold transition-colors ${
                      active ? "bg-surface text-text shadow-xs" : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    <Icon className="h-[15px] w-[15px]" aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
            <span className="mt-1.5 block text-[11.5px] leading-snug text-text-muted">
              Simple is one SKU; Configurable adds variants. Can&apos;t change later.
            </span>
          </div>

          {/* Family */}
          <label className="block">
            <span className="mb-1.5 block text-eyebrow font-semibold uppercase tracking-wide text-text-muted">
              Family
            </span>
            <Select aria-label="Attribute family" value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
              <option value="">Choose a family…</option>
              {families?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
            <span className="mt-1.5 block text-[11.5px] leading-snug text-text-muted">
              Decides which fields this product has — can&apos;t change later.
            </span>
          </label>

          {/* SKU */}
          <label className="block">
            <span className="mb-1.5 block text-eyebrow font-semibold uppercase tracking-wide text-text-muted">
              SKU
            </span>
            <input
              type="text"
              aria-label="SKU"
              aria-invalid={showSkuError}
              maxLength={64}
              placeholder="e.g. PRED-ELITE"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              onBlur={() => setTouched(true)}
              className={`h-10 w-full rounded-lg border bg-surface px-3 font-mono text-sm tracking-wide text-text outline-none focus:ring-2 focus:ring-accent-600/30 ${
                showSkuError ? "border-error focus:border-error" : "border-border focus:border-accent-600"
              }`}
            />
            {showSkuError ? (
              <span className="mt-1.5 block text-[11.5px] leading-snug text-error">{skuCheck.error}</span>
            ) : (
              <span className="mt-1.5 block text-[11.5px] leading-snug text-text-muted">
                Letters, numbers, and hyphens only.
              </span>
            )}
          </label>
        </div>

        {/* Footer */}
        <div className="mt-2 flex items-center justify-end gap-2.5 border-t border-border px-5 py-3.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canSubmit}>
            Save Product
          </Button>
        </div>
      </div>
    </div>
  );
}
