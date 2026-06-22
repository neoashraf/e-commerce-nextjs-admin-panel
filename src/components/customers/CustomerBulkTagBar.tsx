"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Tag, X } from "lucide-react";
import type { CustomerTag } from "@/lib/api/hooks/useCustomers";
import { cn } from "@/lib/cn";

/**
 * Bulk-tag bar shown when customer rows are selected (design §D, FR-CUST-031).
 * "{n} selected" + an idempotent "Add tag" picker (from the real tag catalog) + a
 * "Create new tag…" inline action + a clear control. The parent gates this on
 * `customers.tag.manage`. Picking a catalog tag calls `onApplyTag(tagId)`; the
 * create field calls `onCreateTag(key, label)` (which creates then assigns).
 */
const DOT = "var(--accent-600)";

/** Slugify a free-text label to a valid tag key ([a-z0-9_-]). */
export function toTagKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CustomerBulkTagBar({
  selectedCount,
  tags,
  busy = false,
  onApplyTag,
  onCreateTag,
  onClear,
}: {
  selectedCount: number;
  tags: CustomerTag[];
  busy?: boolean;
  onApplyTag: (tagId: string) => void;
  onCreateTag: (key: string, label: string) => void;
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

  function pick(tagId: string) {
    onApplyTag(tagId);
    setOpen(false);
  }

  function create() {
    const label = draft.trim();
    const key = toTagKey(label);
    if (!key) return;
    onCreateTag(key, label);
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
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-[30px] items-center gap-1.5 rounded-md border border-accent-600 bg-surface px-2.5 text-[12.5px] font-semibold text-accent-700 hover:bg-accent-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
        >
          <Tag className="h-3.5 w-3.5" aria-hidden="true" />
          {busy ? "Applying…" : "Add tag"}
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
            {tags.length === 0 ? (
              <p className="px-2 py-1.5 text-[12.5px] text-text-muted">
                No tags yet — create one below.
              </p>
            ) : (
              <div className="max-h-[200px] overflow-y-auto">
                {tags.map((t) => (
                  <button
                    key={t.id}
                    role="menuitem"
                    type="button"
                    onClick={() => pick(t.id)}
                    className="flex h-[34px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-text-secondary hover:bg-surface-subtle focus-visible:outline-none focus-visible:bg-surface-subtle"
                  >
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: t.color ?? DOT }}
                      aria-hidden="true"
                    />
                    {t.label}
                  </button>
                ))}
              </div>
            )}
            <div className="mx-1 my-1.5 h-px bg-border" />
            <div className="flex items-center gap-2 px-1 py-0.5">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Create new tag…"
                aria-label="Create new tag"
                className="h-8 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-2.5 text-[12.5px] text-text placeholder:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
              />
              <button
                type="button"
                onClick={create}
                disabled={!draft.trim()}
                className="h-8 flex-shrink-0 rounded-md bg-accent-600 px-2.5 text-[12.5px] font-semibold text-accent-fg hover:bg-accent-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
      <span className="hidden text-xs text-accent-700/70 sm:inline">
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
