"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The one per-row "⋯" actions menu (design-system §8.6 actions cell). The
 * dropdown panel is portaled to <body> and positioned with fixed coordinates
 * derived from the trigger, so it is never clipped by the data table's
 * `overflow-x-auto` / Card `overflow-hidden` wrappers — the bug where a
 * single-row table cut off the menu. It also flips above the trigger when there
 * isn't room below, and re-positions on scroll/resize.
 *
 * Closes on Escape, outside click, scroll, or resize; focus returns to the
 * trigger. Call sites supply their own menu items via the render-prop child,
 * which receives `close()` to dismiss the menu after an action.
 */
export function RowActions({
  label,
  children,
  width = "w-44",
  align = "right",
  disabled = false,
  triggerClassName,
}: {
  /** aria-label for the trigger and the menu (e.g. `Actions for order SO-1001`). */
  label: string;
  /** Menu items; receives `close()` to dismiss after an action. */
  children: (close: () => void) => ReactNode;
  /** Tailwind width class for the panel. */
  width?: string;
  /** Align the panel's edge to the trigger's matching edge. */
  align?: "left" | "right";
  disabled?: boolean;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const menuW = menuRef.current?.offsetWidth ?? 176; // w-44 ≈ 176px
    const menuH = menuRef.current?.offsetHeight ?? 0;
    // Horizontal: align to the chosen edge, then clamp into the viewport.
    let left = align === "right" ? r.right - menuW : r.left;
    left = Math.max(8, Math.min(left, vw - menuW - 8));
    // Vertical: open below; flip above when it would overflow the viewport.
    const below = r.bottom + 4;
    const top = below + menuH > vh - 8 ? Math.max(8, r.top - 4 - menuH) : below;
    setCoords({ top, left });
  }, [align]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    // Measure + position once the panel is in the DOM. The panel stays
    // visibility:hidden until `coords` is set, so there is no flash of an
    // un-positioned menu.
    place();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    function onPointer(e: MouseEvent) {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      // Clear stale coords so the next open re-measures (hidden) before showing.
      setCoords(null);
    };
  }, [open, place, close]);

  return (
    <span className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-subtle",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 disabled:opacity-50",
          open && "bg-surface-subtle",
          triggerClassName,
        )}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              visibility: coords ? "visible" : "hidden",
            }}
            className={cn(
              "z-50 rounded-lg border border-border bg-surface p-1 shadow-lg",
              width,
            )}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </span>
  );
}
