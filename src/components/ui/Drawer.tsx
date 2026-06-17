"use client";

import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Right-side slide-over drawer (design-system §8.9). role="dialog" +
 * aria-modal, focus moved in + trapped, closes on ✕ / scrim / Esc (focus
 * returns to the trigger), a single scrolling column, body scroll locked.
 * Slide-in 200ms ease-out; fades instead of sliding under prefers-reduced-motion.
 */
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  footer,
  width = "max-w-[560px]",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  /** Tailwind max-width class for the panel; defaults to 560px. */
  width?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const nodes = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((el) => el.offsetParent !== null);
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => {
      const target =
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current;
      target?.focus();
    });
    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = overflow;
      prevFocus.current?.focus?.();
    };
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40 [animation:scrimIn_180ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        className={cn(
          "absolute right-0 top-0 flex h-full w-full flex-col bg-surface shadow-lg",
          "[animation:drawerIn_200ms_ease-out] focus:outline-none",
          width,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-text">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-sm text-text-muted">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="border-t border-border px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
