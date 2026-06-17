"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, MoreHorizontal, Printer } from "lucide-react";
import { toast } from "@/lib/stores/toast";
import { printInvoice } from "./printInvoice";

/**
 * Row actions menu (design-system §8.6 actions cell): View order + Print
 * invoice. Keyboard-accessible (Esc + outside-click close). Presentation only —
 * View navigates to the existing detail route; Print opens the documented
 * invoice endpoint.
 */
export function OrderRowMenu({ orderNo }: { orderNo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onClick(e: MouseEvent) {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const onPrint = async () => {
    setOpen(false);
    setPrinting(true);
    try {
      await printInvoice(orderNo);
    } catch {
      toast("Couldn't open the invoice. Please try again.", "error");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="relative flex justify-end">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for order ${orderNo}`}
        disabled={printing}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 disabled:opacity-50"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Order actions"
          className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push(`/admin/orders/${orderNo}`);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-subtle"
          >
            <Eye className="h-4 w-4 text-text-muted" aria-hidden="true" />
            View order
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={onPrint}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-subtle"
          >
            <Printer className="h-4 w-4 text-text-muted" aria-hidden="true" />
            Print invoice
          </button>
        </div>
      )}
    </div>
  );
}
