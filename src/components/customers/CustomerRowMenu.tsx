"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, MoreHorizontal, Tag } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { cn } from "@/lib/cn";
import { CUSTOMERS_TAG_PERMISSION } from "./permissions";

/**
 * Per-row "⋯" actions menu (design §8.6). "Open" (read-only navigation to the
 * 360 profile) is always shown; "Add tag" is gated on `customers.tag.manage`
 * and only for non-guest rows (guests are read-only). Keyboard: Esc closes,
 * focus returns to the trigger.
 */
const itemCls =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-text-secondary hover:bg-surface-subtle focus-visible:outline-none focus-visible:bg-surface-subtle";

export function CustomerRowMenu({
  id,
  name,
  isGuest,
  onAddTag,
}: {
  id: string;
  name: string;
  isGuest: boolean;
  /** Opens the bulk-tag flow scoped to this single row. */
  onAddTag: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function close() {
    setOpen(false);
    btnRef.current?.focus();
  }

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${name}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "grid h-[30px] w-[30px] place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-subtle",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
          open && "bg-surface-subtle",
        )}
      >
        <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.key === "Escape" && close()}
          className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-border bg-surface p-1 shadow-md"
        >
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              router.push(`/admin/customers/${id}`);
            }}
            className={itemCls}
          >
            <Eye className="h-4 w-4 text-text-muted" aria-hidden="true" />
            Open
          </button>
          {!isGuest && (
            <Can permission={CUSTOMERS_TAG_PERMISSION}>
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  onAddTag();
                }}
                className={itemCls}
              >
                <Tag className="h-4 w-4 text-text-muted" aria-hidden="true" />
                Add tag
              </button>
            </Can>
          )}
        </div>
      )}
    </div>
  );
}
