"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useCreateFamily, useUpdateFamily, useAttributes } from "@/lib/api/hooks/useCatalog";
import { MANDATORY_ATTRIBUTE_CODES, type FamilyDetail, type FamilyGroup } from "@/lib/api/schemas/catalog";
import { ApiError } from "@/lib/api/errors";

/**
 * Attribute-family editor (attribute-family-editor.md, catalog-attribute-
 * families-fe). General (code read-only on edit) + a group canvas: an
 * Unassigned pool feeds ordered groups via keyboard-accessible "Move to…"
 * controls (the mandatory drag-drop alternative, editor §10). Mandatory system
 * attributes are locked from removal. Save sends ordered groups[]. Native
 * drag-drop is a flagged follow-up.
 */
type Group = { name: string; column: number; attribute_codes: string[] };

export function FamilyEditor({ mode, family }: { mode: "create" | "edit"; family?: FamilyDetail }) {
  const router = useRouter();
  const create = useCreateFamily();
  const update = useUpdateFamily(family?.id ?? "");
  const { data: allAttributes } = useAttributes({ page: 1, limit: 300 });

  const [code, setCode] = useState(family?.code ?? "");
  const [name, setName] = useState(family?.name ?? "");
  const [groups, setGroups] = useState<Group[]>(
    family?.groups?.map((g) => ({ name: g.name, column: g.column, attribute_codes: [...g.attribute_codes] })) ??
      [{ name: "General", column: 1, attribute_codes: [...MANDATORY_ATTRIBUTE_CODES] }],
  );
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  const assigned = useMemo(() => new Set(groups.flatMap((g) => g.attribute_codes)), [groups]);
  const pool = useMemo(
    () => (allAttributes ?? []).map((a) => a.code).filter((c) => !assigned.has(c)),
    [allAttributes, assigned],
  );

  const codeLocked = mode === "edit";
  const field = "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  function assign(codeToAdd: string, groupIdx: number) {
    setGroups((prev) => prev.map((g, i) => (i === groupIdx ? { ...g, attribute_codes: [...g.attribute_codes, codeToAdd] } : g)));
    setAnnounce(`${codeToAdd} added to ${groups[groupIdx].name}`);
  }
  function unassign(groupIdx: number, code: string) {
    if (MANDATORY_ATTRIBUTE_CODES.includes(code)) return;
    setGroups((prev) => prev.map((g, i) => (i === groupIdx ? { ...g, attribute_codes: g.attribute_codes.filter((c) => c !== code) } : g)));
    setAnnounce(`${code} returned to the unassigned pool`);
  }
  function moveWithin(groupIdx: number, code: string, dir: -1 | 1) {
    setGroups((prev) =>
      prev.map((g, i) => {
        if (i !== groupIdx) return g;
        const arr = [...g.attribute_codes];
        const idx = arr.indexOf(code);
        const j = idx + dir;
        if (j < 0 || j >= arr.length) return g;
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        return { ...g, attribute_codes: arr };
      }),
    );
  }
  function moveGroupTo(code: string, fromIdx: number, toIdx: number) {
    setGroups((prev) => {
      const next = prev.map((g) => ({ ...g, attribute_codes: [...g.attribute_codes] }));
      next[fromIdx].attribute_codes = next[fromIdx].attribute_codes.filter((c) => c !== code);
      next[toIdx].attribute_codes.push(code);
      return next;
    });
    setAnnounce(`${code} moved to ${groups[toIdx].name}`);
  }
  function addGroup() {
    setGroups((prev) => [...prev, { name: `Group ${prev.length + 1}`, column: 1, attribute_codes: [] }]);
  }
  function deleteGroup(idx: number) {
    if (groups[idx].attribute_codes.some((c) => MANDATORY_ATTRIBUTE_CODES.includes(c))) {
      setError("Move the locked system attributes out before deleting this group.");
      return;
    }
    setGroups((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) { setError("Family name is required."); return; }
    if (mode === "create" && !/^[a-z][a-z0-9_]*$/.test(code)) { setError("Code must be lowercase letters, numbers, and underscores."); return; }
    const missing = MANDATORY_ATTRIBUTE_CODES.filter((c) => !assigned.has(c));
    if (missing.length) { setError(`Place all mandatory attributes first: ${missing.join(", ")}.`); return; }

    const payloadGroups: FamilyGroup[] = groups.map((g, gi) => ({
      name: g.name,
      column: g.column,
      position: gi + 1,
      attribute_codes: g.attribute_codes,
    }));
    try {
      if (mode === "create") await create.mutateAsync({ code, name: name.trim(), groups: payloadGroups });
      else await update.mutateAsync({ name: name.trim(), groups: payloadGroups });
      router.push("/admin/attribute-families");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError("That code already exists.");
      else if (err instanceof ApiError && err.status === 400) setError("Check the groups — a mandatory attribute may be missing or a code unknown.");
      else setError("Something went wrong. Please try again.");
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <form onSubmit={onSave} className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">{mode === "create" ? "New attribute family" : `Edit ${family?.name}`}</h1>
      <p aria-live="polite" className="sr-only">{announce}</p>
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Code {codeLocked && <span className="text-gray-400">(locked)</span>}</span>
          <input className={field + (codeLocked ? " bg-gray-50 text-gray-500" : "")} value={code} onChange={(e) => setCode(e.target.value)} readOnly={codeLocked} placeholder="mens_footwear" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Name</span>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
        {/* Group canvas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Groups</h2>
            <button type="button" onClick={addGroup} className="text-sm font-medium text-brand-700 hover:underline">+ Add group</button>
          </div>
          {groups.map((g, gi) => (
            <fieldset key={gi} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={g.name}
                  onChange={(e) => setGroups((prev) => prev.map((gg, i) => (i === gi ? { ...gg, name: e.target.value } : gg)))}
                  className="h-9 flex-1 rounded-md border border-gray-300 px-2 text-sm font-medium"
                  aria-label="Group name"
                />
                <select value={g.column} onChange={(e) => setGroups((prev) => prev.map((gg, i) => (i === gi ? { ...gg, column: Number(e.target.value) } : gg)))} className="h-9 rounded-md border border-gray-300 px-2 text-sm" aria-label="Column">
                  <option value={1}>Col 1</option>
                  <option value={2}>Col 2</option>
                </select>
                <button type="button" onClick={() => deleteGroup(gi)} className="text-sm text-red-500 hover:underline">Delete</button>
              </div>
              <ul className="space-y-1">
                {g.attribute_codes.map((c) => {
                  const locked = MANDATORY_ATTRIBUTE_CODES.includes(c);
                  return (
                    <li key={c} className="flex items-center gap-2 rounded bg-gray-50 px-2 py-1 text-sm">
                      <span className="flex-1 font-mono text-xs text-gray-700">{c}{locked && <span className="ml-1 text-gray-400" title="Mandatory system attribute">🔒</span>}</span>
                      <button type="button" onClick={() => moveWithin(gi, c, -1)} aria-label={`Move ${c} up`} className="text-gray-400">↑</button>
                      <button type="button" onClick={() => moveWithin(gi, c, 1)} aria-label={`Move ${c} down`} className="text-gray-400">↓</button>
                      {groups.length > 1 && (
                        <select
                          value=""
                          onChange={(e) => e.target.value && moveGroupTo(c, gi, Number(e.target.value))}
                          aria-label={`Move ${c} to another group`}
                          className="h-7 rounded border border-gray-200 text-xs"
                        >
                          <option value="">Move to…</option>
                          {groups.map((gg, idx) => idx !== gi && <option key={idx} value={idx}>{gg.name}</option>)}
                        </select>
                      )}
                      {!locked && <button type="button" onClick={() => unassign(gi, c)} aria-label={`Remove ${c}`} className="text-red-500">✕</button>}
                    </li>
                  );
                })}
                {g.attribute_codes.length === 0 && <li className="px-2 py-1 text-xs text-gray-400">Empty group</li>}
              </ul>
            </fieldset>
          ))}
        </div>

        {/* Unassigned pool */}
        <aside className="h-max rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Unassigned ({pool.length})</h2>
          <ul className="mt-2 space-y-1">
            {pool.map((c) => (
              <li key={c} className="flex items-center gap-2 rounded bg-gray-50 px-2 py-1 text-sm">
                <span className="flex-1 font-mono text-xs text-gray-700">{c}</span>
                <select value="" onChange={(e) => e.target.value !== "" && assign(c, Number(e.target.value))} aria-label={`Add ${c} to a group`} className="h-7 rounded border border-gray-200 text-xs">
                  <option value="">Add to…</option>
                  {groups.map((g, idx) => <option key={idx} value={idx}>{g.name}</option>)}
                </select>
              </li>
            ))}
            {pool.length === 0 && <li className="px-2 py-1 text-xs text-gray-400">All attributes assigned.</li>}
          </ul>
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          <button type="button" onClick={() => router.push("/admin/attribute-families")} className="text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
          <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {pending ? "Saving…" : mode === "create" ? "Create family" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
