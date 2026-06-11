"use client";

import { useEffect, useState } from "react";
import { useMenu, useSaveMenu } from "@/lib/api/hooks/useContent";
import type { MenuItem } from "@/lib/api/schemas/content";
import { Can } from "@/lib/permissions/Can";
import { toast } from "@/lib/stores/toast";

/**
 * CMS menu builder (cms-menus-fe). Header/footer tabs; an ordered tree of items
 * (label + link type/ref + children, ≤2 levels) edited with keyboard-accessible
 * add/remove/up-down controls, saved via PUT (full replace). Native drag-drop
 * flagged as a follow-up.
 */
const LINK_TYPES = ["category", "product", "page", "url"] as const;

export function MenusView() {
  const [menu, setMenu] = useState<"header" | "footer">("header");
  const { data, isLoading, isError, refetch } = useMenu(menu);
  const save = useSaveMenu(menu);
  const [items, setItems] = useState<MenuItem[]>([]);

  useEffect(() => { if (data) setItems(data.items); }, [data]);

  function newItem(): MenuItem { return { label: "New item", link_type: "url", link_ref: "", display_order: items.length + 1, children: [] }; }

  function updateAt(path: number[], patch: Partial<MenuItem>) {
    setItems((prev) => mutate(prev, path, (it) => ({ ...it, ...patch })));
  }
  function removeAt(path: number[]) { setItems((prev) => removePath(prev, path)); }
  function moveAt(path: number[], dir: -1 | 1) { setItems((prev) => movePath(prev, path, dir)); }
  function addChild(path: number[]) {
    setItems((prev) => mutate(prev, path, (it) => ({ ...it, children: [...it.children, newItem()] })));
  }

  async function onSave() {
    try { await save.mutateAsync(items); toast(`${menu} menu saved.`); }
    catch { toast("Couldn't save the menu.", "error"); }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Menus</h1>

      <div className="inline-flex rounded-md border border-gray-300 p-0.5 text-sm">
        {(["header", "footer"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMenu(m)} className={"rounded px-3 py-1 font-medium capitalize " + (menu === m ? "bg-brand-600 text-white" : "text-gray-600")}>{m}</button>
        ))}
      </div>

      {isLoading ? <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        : isError ? <div className="py-12 text-center"><p className="text-sm text-gray-600">Couldn&apos;t load the menu.</p><button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button></div>
        : (
          <div className="space-y-2">
            {items.map((item, i) => (
              <MenuRow key={i} item={item} path={[i]} depth={0} count={items.length} index={i} onUpdate={updateAt} onRemove={removeAt} onMove={moveAt} onAddChild={addChild} />
            ))}
            <Can permission="content.menu.manage">
              <button type="button" onClick={() => setItems((prev) => [...prev, newItem()])} className="text-sm font-medium text-brand-700 hover:underline">+ Add top-level item</button>
            </Can>
          </div>
        )}

      <Can permission="content.menu.manage">
        <div className="mt-2">
          <div className="mx-auto flex max-w-5xl items-center justify-end">
            <button type="button" onClick={onSave} disabled={save.isPending} className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{save.isPending ? "Saving…" : `Save ${menu} menu`}</button>
          </div>
        </div>
      </Can>
    </div>
  );
}

function MenuRow({ item, path, depth, count, index, onUpdate, onRemove, onMove, onAddChild }: {
  item: MenuItem; path: number[]; depth: number; count: number; index: number;
  onUpdate: (p: number[], patch: Partial<MenuItem>) => void; onRemove: (p: number[]) => void; onMove: (p: number[], dir: -1 | 1) => void; onAddChild: (p: number[]) => void;
}) {
  const field = "h-9 rounded-md border border-gray-300 px-2 text-sm";
  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
        <input className={field + " flex-1"} value={item.label} onChange={(e) => onUpdate(path, { label: e.target.value })} aria-label="Label" />
        <select className={field} value={item.link_type} onChange={(e) => onUpdate(path, { link_type: e.target.value as MenuItem["link_type"] })} aria-label="Link type">
          {LINK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className={field + " w-40"} value={item.link_ref} onChange={(e) => onUpdate(path, { link_ref: e.target.value })} placeholder="slug or URL" aria-label="Link target" />
        <button type="button" onClick={() => onMove(path, -1)} disabled={index === 0} aria-label="Move up" className="text-gray-400 disabled:opacity-30">↑</button>
        <button type="button" onClick={() => onMove(path, 1)} disabled={index === count - 1} aria-label="Move down" className="text-gray-400 disabled:opacity-30">↓</button>
        {depth === 0 && <button type="button" onClick={() => onAddChild(path)} className="text-xs font-medium text-brand-700">+ child</button>}
        <button type="button" onClick={() => onRemove(path)} aria-label="Remove" className="text-red-500">✕</button>
      </div>
      {item.children.map((c, ci) => (
        <MenuRow key={ci} item={c} path={[...path, ci]} depth={depth + 1} count={item.children.length} index={ci} onUpdate={onUpdate} onRemove={onRemove} onMove={onMove} onAddChild={onAddChild} />
      ))}
    </div>
  );
}

// ---- immutable tree helpers ----
function mutate(items: MenuItem[], path: number[], fn: (it: MenuItem) => MenuItem): MenuItem[] {
  const [head, ...rest] = path;
  return items.map((it, i) => (i !== head ? it : rest.length === 0 ? fn(it) : { ...it, children: mutate(it.children, rest, fn) }));
}
function removePath(items: MenuItem[], path: number[]): MenuItem[] {
  const [head, ...rest] = path;
  if (rest.length === 0) return items.filter((_, i) => i !== head);
  return items.map((it, i) => (i !== head ? it : { ...it, children: removePath(it.children, rest) }));
}
function movePath(items: MenuItem[], path: number[], dir: -1 | 1): MenuItem[] {
  const [head, ...rest] = path;
  if (rest.length === 0) {
    const j = head + dir;
    if (j < 0 || j >= items.length) return items;
    const next = [...items];
    [next[head], next[j]] = [next[j], next[head]];
    return next;
  }
  return items.map((it, i) => (i !== head ? it : { ...it, children: movePath(it.children, rest, dir) }));
}
