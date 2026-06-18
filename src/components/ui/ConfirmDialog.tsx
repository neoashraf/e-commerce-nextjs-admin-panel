"use client";

import { useEffect, useRef } from "react";
import { Button } from "./Button";

/**
 * Accessible confirm dialog for destructive admin actions (reused across admin
 * screens). role="dialog" aria-modal, focus moves in on open, Esc + scrim
 * dismiss, focus restored to the trigger on close. Styled to the design system.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  pending = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLElement>("button")?.focus(),
    );
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      prevFocus.current?.focus?.();
    };
  }, [open, pending, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={pending ? undefined : onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-lg"
      >
        <h2 className="text-[15px] font-semibold text-text">{title}</h2>
        <div className="mt-2 text-sm text-text-secondary">{message}</div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={danger ? "destructive" : "primary"}
            onClick={onConfirm}
            loading={pending}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
