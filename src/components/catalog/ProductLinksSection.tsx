"use client";

import { useState } from "react";
import { Search, Plus, X, ImageIcon } from "lucide-react";
import { useProducts, useSetProductLinks } from "@/lib/api/hooks/useCatalog";
import type { ProductLinkItem, ProductLinks } from "@/lib/api/schemas/catalog";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";
import { resolveMediaUrl } from "@/lib/media";

/** A small square product thumbnail (or a placeholder when the product has no image). */
function LinkThumb({ src, alt, size = 28 }: { src?: string | null; alt: string; size?: number }) {
  const url = resolveMediaUrl(src);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-md border border-border object-cover"
    />
  ) : (
    <span
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-text-faint"
      aria-hidden="true"
    >
      <ImageIcon className="h-3.5 w-3.5" />
    </span>
  );
}

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
    } catch (err) {
      // Surface the backend's actual reason (e.g. a linked product is draft/archived,
      // or self-link) instead of a generic message — "save doesn't work" should say why.
      const msg =
        err instanceof ApiError && err.message && err.code !== "UNKNOWN"
          ? `Couldn't save links — ${err.message}`
          : "Couldn't save links. Try again.";
      toast(msg, "error");
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
              <span key={p.id} className="inline-flex h-[34px] items-center gap-2 rounded-md border border-border bg-surface pl-1.5 pr-1.5">
                <LinkThumb src={p.primary_image} alt={p.name} size={24} />
                <span className="whitespace-nowrap text-[12.5px] font-medium text-text-secondary">{p.name}</span>
                <button type="button" aria-label={`Remove ${p.name}`} onClick={() => remove(g.key, p.id)} className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-text-muted hover:bg-surface-subtle">
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
          className="inline-flex h-9 items-center rounded-md bg-accent-600 px-4 text-sm font-semibold text-accent-fg shadow-xs hover:bg-accent-700 disabled:opacity-50"
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
  // Fetch on focus even before typing (recent products), narrowing as the admin types —
  // so the picker visibly works without requiring a search term first.
  const { data, isLoading } = useProducts(query.trim() ? { q: query.trim(), limit: 8 } : { limit: 8 });
  const candidates = (data?.data ?? []).filter((p) => !excludeIds.has(p.id)).slice(0, 8);

  return (
    <div className="relative max-w-[420px]">
      <div className="flex h-[38px] items-center gap-2.5 rounded-md border border-border-strong bg-surface px-3">
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
      {open && (
        <div role="listbox" className="absolute left-0 right-0 top-[42px] z-20 max-h-[212px] overflow-y-auto rounded-lg border border-border bg-surface p-1.5 shadow-lg">
          {isLoading ? (
            <div className="p-3 text-center text-[12.5px] text-text-muted">Loading products…</div>
          ) : candidates.length === 0 ? (
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
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-surface-subtle"
              >
                <LinkThumb src={p.primary_image} alt={p.name} size={28} />
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
