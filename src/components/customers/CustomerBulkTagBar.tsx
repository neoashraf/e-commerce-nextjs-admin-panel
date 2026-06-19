"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Tag, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Bulk-tag bar shown when customer rows are selected (design §8.7, FR-CUST-031).
 * "{n} selected" + an idempotent "Add tag" picker + a clear control. The parent
 * gates this on `customers.tag.manage` (so it never renders for roles without
 * the permission). Applying a tag is presentation-only here — there is no
 * customers tag-assign mutation hook yet.
 * TODO(design): wire `onApplyTag` to a real assign-tag mutation
 * (`POST /admin/customers/{id}/tags`) when that hook is added (out of scope).
 */

const KNOWN_TAGS = ["VIP", "Wholesale", "Repeat", "Newsletter", "Football", "Cricket"];

const TAG_DOT: Record<string, string> = {
  VIP: "#D97706",
  Wholesale: "var(--accent-600)",
  Repeat: "#16A34A",
  Newsletter: "#94A3B8",
  Football: "#06B6D4",
  Cricket: "#8B5CF6",
};

export function CustomerBulkTagBar({
  selectedCount,
  onApplyTag,
  onClear,
}: {
  selectedCount: number;
  onApplyTag: (tag: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function apply(tag: string) {
    const t = tag.trim();
    if (!t) return;
    onApplyTag(t);
    setOpen(false);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-t-lg border-b border-accent-100 bg-accent-50 px-4 py-2.5">
      <span className="text-sm font-semibold tabular-nums text-accent-700">
        {selectedCount} selected
      </span>
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-[30px] items-center gap-1.5 rounded-md border border-accent-600 bg-surface px-2.5 text-[12.5px] font-semibold text-accent-700 hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
        >
          <Tag className="h-3.5 w-3.5" aria-hidden="true" />
          Add tag
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute left-0 top-9 z-30 w-[228px] rounded-lg border border-border bg-surface p-2 text-left shadow-md"
          >
            <div className="px-2 pb-1.5 pt-1 text-eyebrow uppercase tracking-wide text-text-faint">
              Apply tag to {selectedCount}
            </div>
            {KNOWN_TAGS.map((t) => (
              <button
                key={t}
                role="menuitem"
                type="button"
                onClick={() => apply(t)}
                className="flex h-[34px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-text-secondary hover:bg-surface-subtle focus-visible:outline-none focus-visible:bg-surface-subtle"
              >
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: TAG_DOT[t] ?? "#94A3B8" }}
                  aria-hidden="true"
                />
                {t}
              </button>
            ))}
            <div className="mx-1 my-1.5 h-px bg-border" />
            <div className="flex items-center gap-2 px-1 py-0.5">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && apply(draft)}
                placeholder="Create new tag…"
                aria-label="Create new tag"
                className="h-8 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-2.5 text-[12.5px] text-text placeholder:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
              />
              <button
                type="button"
                onClick={() => apply(draft)}
                className="h-8 flex-shrink-0 rounded-md bg-accent-600 px-2.5 text-[12.5px] font-semibold text-accent-fg hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
      <span className="text-xs text-accent-700/70">
        Applying a tag is idempotent — already-tagged customers are unaffected.
      </span>
      <button
        type="button"
        onClick={onClear}
        className={cn(
          "ml-auto inline-flex h-[30px] items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-semibold text-text-muted",
          "hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
        )}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Clear
      </button>
    </div>
  );
}
