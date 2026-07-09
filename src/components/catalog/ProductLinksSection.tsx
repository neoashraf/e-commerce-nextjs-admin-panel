"use client";

import { useState } from "react";
import { Search, Plus, X } from "lucide-react";
import { useProducts, useSetProductLinks } from "@/lib/api/hooks/useCatalog";
import type { ProductLinkItem, ProductLinks } from "@/lib/api/schemas/catalog";
import { toast } from "@/lib/stores/toast";

/**
 * Product links (FR-CAT-019) — related / up-sell / cross-sell. Each group has a
 * type-ahead "Search products to add…" (via GET /admin/products?q=) and removable
 * chips; Save writes the full set via PUT /admin/products/{id}/links.
 */
type GroupKey = "related" | "up_sell" | "cross_sell";
const GROUPS: { key: GroupKey; label: string; lower: string }[] = [
  { key: "related", label: "Related products", lower: "related" },
  { key: "up_sell", label: "Up-sell", lower: "up-sell" },
  { key: "cross_sell", label: "Cross-sell", lower: "cross-sell" },
];

export function ProductLinksSection({
  productId,
  initialLinks,
}: {
  productId?: string;
  initialLinks?: ProductLinks;
}) {
  const [groups, setGroups] = useState<Record<GroupKey, ProductLinkItem[]>>({
    related: initialLinks?.related ?? [],
    up_sell: initialLinks?.up_sell ?? [],
    cross_sell: initialLinks?.cross_sell ?? [],
  });
  const [dirty, setDirty] = useState(false);
  const setLinks = useSetProductLinks(productId ?? "");

  if (!productId) {
    return <p className="text-sm text-text-muted">Save the product first, then link related products.</p>;
  }

  const linkedIds = new Set([...groups.related, ...groups.up_sell, ...groups.cross_sell].map((p) => p.id));

  function add(key: GroupKey, item: ProductLinkItem) {
    setGroups((g) => ({ ...g, [key]: [...g[key], item] }));
    setDirty(true);
  }
  function remove(key: GroupKey, id: string) {
    setGroups((g) => ({ ...g, [key]: g[key].filter((p) => p.id !== id) }));
    setDirty(true);
  }

  async function save() {
    try {
      await setLinks.mutateAsync({
        related: groups.related.map((p) => p.id),
        up_sell: groups.up_sell.map((p) => p.id),
        cross_sell: groups.cross_sell.map((p) => p.id),
      });
      setDirty(false);
      toast("Links saved.");
    } catch {
      toast("Couldn't save links. Try again.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {GROUPS.map((g) => (
        <div key={g.key}>
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">{g.label}</span>
          <div className="mb-2.5 flex flex-wrap gap-2">
            {groups[g.key].length === 0 && <span className="text-xs text-text-muted">No {g.lower} products linked.</span>}
            {groups[g.key].map((p) => (
              <span key={p.id} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface py-1 pl-2 pr-1.5">
                <span className="text-[12.5px] font-medium text-text-secondary">{p.name}</span>
                <button type="button" aria-label={`Remove ${p.name}`} onClick={() => remove(g.key, p.id)} className="inline-flex h-5 w-5 items-center justify-center rounded-md text-text-muted hover:bg-surface-subtle">
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
          <LinkPicker
            excludeIds={new Set([productId, ...linkedIds])}
            onPick={(item) => add(g.key, item)}
            lower={g.lower}
          />
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || setLinks.isPending}
          className="inline-flex h-9 items-center rounded-lg bg-accent-600 px-4 text-sm font-semibold text-accent-fg shadow-xs hover:bg-accent-700 disabled:opacity-50"
        >
          {setLinks.isPending ? "Saving…" : "Save links"}
        </button>
        {dirty && <span className="text-xs text-warning">Unsaved link changes</span>}
      </div>
    </div>
  );
}

/** Type-ahead product search → pick to add. Uses GET /admin/products?q=. */
function LinkPicker({
  excludeIds,
  onPick,
  lower,
}: {
  excludeIds: Set<string>;
  onPick: (item: ProductLinkItem) => void;
  lower: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { data } = useProducts(query.trim() ? { q: query.trim(), limit: 8 } : {});
  const candidates = (data?.data ?? []).filter((p) => !excludeIds.has(p.id)).slice(0, 8);

  return (
    <div className="relative max-w-[420px]">
      <div className="flex h-[38px] items-center gap-2.5 rounded-lg border border-border-strong bg-surface px-3">
        <Search className="h-4 w-4 shrink-0 text-text-faint" aria-hidden="true" />
        <input
          type="text"
          aria-label={`Search products to add to ${lower}`}
          placeholder="Search products to add…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none"
        />
      </div>
      {open && query.trim() && (
        <div role="listbox" className="absolute left-0 right-0 top-[42px] z-20 max-h-[212px] overflow-y-auto rounded-lg border border-border bg-surface p-1.5 shadow-lg">
          {candidates.length === 0 ? (
            <div className="p-3 text-center text-[12.5px] text-text-muted">No matching products.</div>
          ) : (
            candidates.map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onPick({ id: p.id, name: p.name, sku: p.sku ?? null, primary_image: p.primary_image ?? null }); setQuery(""); setOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left hover:bg-surface-subtle"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">{p.name}</span>
                <Plus className="h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
