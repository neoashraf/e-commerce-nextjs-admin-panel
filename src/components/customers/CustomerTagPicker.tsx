"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  useCustomerTags,
  useAssignCustomerTag,
  useCreateCustomerTag,
} from "@/lib/api/hooks/useCustomers";
import { toast } from "@/lib/stores/toast";
import { toTagKey } from "./CustomerBulkTagBar";

/**
 * Inline "Add tag" control for the Customer 360 header (design §A). A dashed-border
 * chip that opens a popover of the real tag catalog (assign by id) plus a "Create new
 * tag…" field (create then assign). Assignment is idempotent server-side and invalidates
 * the customer so the header chips refresh. Gated by the parent on `customers.tag.manage`.
 */
export function CustomerTagPicker({
  customerId,
  assignedKeys,
}: {
  customerId: string;
  /** Tag keys already on the customer — hidden from the catalog list to reduce noise. */
  assignedKeys: string[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const tagsQuery = useCustomerTags(open);
  const assign = useAssignCustomerTag();
  const create = useCreateCustomerTag();
  const busy = assign.isPending || create.isPending;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function doAssign(tagId: string) {
    assign.mutate(
      { customerId, tagId },
      {
        onSuccess: () => {
          toast("Tag added.");
          setOpen(false);
        },
        onError: () => toast("Couldn't add the tag. Try again.", "error"),
      },
    );
  }

  function doCreate() {
    const label = draft.trim();
    const key = toTagKey(label);
    if (!key) return;
    create.mutate(
      { key, label },
      {
        onSuccess: (tag) => {
          setDraft("");
          doAssign(tag.id);
        },
        onError: () => toast("Couldn't create that tag. Try again.", "error"),
      },
    );
  }

  const available = (tagsQuery.data ?? []).filter((t) => !assignedKeys.includes(t.key));

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-border-strong bg-surface px-2 py-0.5 text-[11.5px] font-semibold text-text-muted hover:bg-surface-subtle hover:text-text-secondary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
        {busy ? "Adding…" : "Add tag"}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-7 z-30 w-[228px] rounded-lg border border-border bg-surface p-2 text-left shadow-md"
        >
          <div className="px-2 pb-1.5 pt-1 text-eyebrow uppercase tracking-wide text-text-faint">
            Add a tag
          </div>
          {available.length === 0 ? (
            <p className="px-2 py-1.5 text-[12.5px] text-text-muted">
              {tagsQuery.isLoading ? "Loading…" : "No more tags — create one below."}
            </p>
          ) : (
            <div className="max-h-[200px] overflow-y-auto">
              {available.map((t) => (
                <button
                  key={t.id}
                  role="menuitem"
                  type="button"
                  onClick={() => doAssign(t.id)}
                  className="flex h-[34px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-text-secondary hover:bg-surface-subtle focus-visible:outline-none focus-visible:bg-surface-subtle"
                >
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: t.color ?? "var(--accent-600)" }}
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
              onKeyDown={(e) => e.key === "Enter" && doCreate()}
              placeholder="Create new tag…"
              aria-label="Create new tag"
              className="h-8 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-2.5 text-[12.5px] text-text placeholder:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            />
            <button
              type="button"
              onClick={doCreate}
              disabled={!draft.trim() || busy}
              className="h-8 flex-shrink-0 rounded-md bg-accent-600 px-2.5 text-[12.5px] font-semibold text-accent-fg hover:bg-accent-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
