"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Link2, MoreHorizontal, Printer, X } from "lucide-react";
import { useAdminOrder } from "@/lib/api/hooks/useOrdersAdmin";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/stores/toast";
import { Badge, StatusPill } from "@/components/ui";
import { OrderDetailAdminView } from "./OrderDetailAdminView";
import { printInvoice } from "./printInvoice";

/**
 * Order detail in a right-side slide-over (AD3), opened over the Orders list via the
 * intercepting route. Unlike the generic Drawer, this reproduces the Orders (ORD) design
 * exactly: a canvas-tinted panel with a sticky WHITE header — back + "Order {no}" + placed
 * date, a bordered Print-invoice button, a ⋯ menu (Copy link / Print), a ✕ close, and the
 * status + payment pills below — over a single scrolling column of sectioned cards
 * (OrderDetailAdminView, header-less). role="dialog" + aria-modal, focus moved in + trapped,
 * body scroll locked; ✕ / scrim / Esc / back call router.back() and restore focus to the row.
 */
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export function OrderDrawer({ orderNo }: { orderNo: string }) {
  const router = useRouter();
  const { data } = useAdminOrder(orderNo);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [printing, setPrinting] = useState(false);

  const close = useCallback(() => router.back(), [router]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (menuOpen) setMenuOpen(false);
        else close();
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
    [close, menuOpen],
  );

  useEffect(() => {
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
  }, [handleKey]);

  const onPrint = async () => {
    setMenuOpen(false);
    setPrinting(true);
    try {
      await printInvoice(orderNo);
    } catch {
      toast("Couldn't open the invoice. Please try again.", "error");
    } finally {
      setPrinting(false);
    }
  };

  const onCopyLink = async () => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/admin/orders/${orderNo}`,
      );
      toast("Order link copied.");
    } catch {
      toast("Couldn't copy the link.", "error");
    }
  };

  const headerBtn =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface text-text-secondary hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40 [animation:scrimIn_180ms_ease-out]"
        onClick={close}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${orderNo}`}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[600px] flex-col overflow-hidden rounded-l-2xl bg-canvas shadow-lg [animation:drawerIn_200ms_ease-out] focus:outline-none"
      >
        {/* Sticky white header — back + title + placed date, Print / ⋯ / ✕, pills below. */}
        <div className="shrink-0 border-b border-border bg-surface px-[18px] pb-3.5 pt-[15px]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <button
                type="button"
                onClick={close}
                aria-label="Back to orders"
                className={`${headerBtn} mt-px`}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-6 tracking-tight text-text">
                  Order {orderNo}
                </h2>
                {data?.placed_at && (
                  <div className="mt-0.5 text-[11.5px] tabular-nums text-text-faint">
                    Placed {formatDateTime(data.placed_at)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={onPrint}
                disabled={printing}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2.5 text-[12.5px] font-semibold text-text-secondary hover:bg-surface-subtle disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Print invoice
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="More actions"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className={headerBtn}
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuOpen(false)}
                      aria-hidden="true"
                    />
                    <div
                      role="menu"
                      className="absolute right-0 top-[37px] z-20 min-w-[182px] rounded-lg border border-border bg-surface p-1.5 shadow-md [animation:scrimIn_120ms_ease-out]"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={onCopyLink}
                        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-text-secondary hover:bg-surface-subtle"
                      >
                        <Link2 className="h-4 w-4 text-text-muted" aria-hidden="true" />
                        Copy order link
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={onPrint}
                        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-text-secondary hover:bg-surface-subtle"
                      >
                        <Printer className="h-4 w-4 text-text-muted" aria-hidden="true" />
                        Print invoice
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className={headerBtn}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          {data && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill status={data.status} />
              {data.payment_state && (
                <span className="inline-flex items-center gap-1.5">
                  <Badge tone="neutral">{data.payment_method?.toUpperCase() ?? "—"}</Badge>
                  <StatusPill status={data.payment_state} />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Scrolling column of sectioned cards. */}
        <div className="flex-1 overflow-y-auto px-[18px] pb-8 pt-4">
          <OrderDetailAdminView orderNo={orderNo} variant="drawer" />
        </div>
      </aside>
    </div>
  );
}
