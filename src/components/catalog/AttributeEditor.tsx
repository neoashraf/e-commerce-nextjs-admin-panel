"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCreateAttribute, useUpdateAttribute } from "@/lib/api/hooks/useCatalog";
import { ATTRIBUTE_TYPES, type AttributeDetail, type AttributeOption } from "@/lib/api/schemas/catalog";
import { ApiError } from "@/lib/api/errors";

/**
 * Attribute editor (catalog-attributes-fe editor spec). Label/code/type/flags/
 * validation; options repeater for select/multiselect (≥1 to save, reorder,
 * in-use delete blocked); is_configurable enabled only for type=select and
 * cleared on type change; code read-only in edit; system attribute read-only.
 */
const HAS_OPTIONS = (t: string) => t === "select" || t === "multiselect";

export function AttributeEditor({ mode, attribute }: { mode: "create" | "edit"; attribute?: AttributeDetail }) {
  const router = useRouter();
  const create = useCreateAttribute();
  const update = useUpdateAttribute(attribute?.id ?? "");

  const readOnly = attribute?.is_user_defined === false;

  const [label, setLabel] = useState(attribute?.admin_label ?? "");
  const [code, setCode] = useState(attribute?.code ?? "");
  const [type, setType] = useState(attribute?.type ?? "text");
  const [flags, setFlags] = useState({
    is_required: attribute?.is_required ?? false,
    is_unique: attribute?.is_unique ?? false,
    is_filterable: attribute?.is_filterable ?? false,
    is_configurable: attribute?.is_configurable ?? false,
    is_visible_on_front: attribute?.is_visible_on_front ?? true,
    is_comparable: attribute?.is_comparable ?? false,
  });
  const [options, setOptions] = useState<AttributeOption[]>(attribute?.options ?? []);
  const [error, setError] = useState<string | null>(null);

  const codeLocked = mode === "edit";
  const field = "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  function onTypeChange(t: string) {
    setType(t);
    // is_configurable only valid for select — clear it otherwise (FR-CAT-027).
    if (t !== "select") setFlags((f) => ({ ...f, is_configurable: false }));
  }
  function setOption(i: number, patch: Partial<AttributeOption>) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }
  function moveOption(i: number, dir: -1 | 1) {
    setOptions((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (label.trim().length < 2) { setError("Admin label is required."); return; }
    if (mode === "create" && !/^[a-z][a-z0-9_]*$/.test(code)) { setError("Code must be lowercase letters, numbers, and underscores."); return; }
    if (HAS_OPTIONS(type) && options.filter((o) => o.label && o.value).length === 0) {
      setError("Add at least one option for a select attribute.");
      return;
    }
    const cleanedOptions = HAS_OPTIONS(type) ? options.filter((o) => o.label && o.value).map((o, i) => ({ ...o, position: i + 1 })) : undefined;
    try {
      if (mode === "create") {
        await create.mutateAsync({ admin_label: label.trim(), code, type, ...flags, options: cleanedOptions });
      } else {
        await update.mutateAsync({ admin_label: label.trim(), ...flags, options: cleanedOptions });
      }
      router.push("/admin/attributes");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError("That code already exists.");
      else if (err instanceof ApiError && err.code === "OPTION_IN_USE") setError("An option you removed is still in use by products.");
      else if (err instanceof ApiError && err.status === 400) setError("Check the configuration — some flags aren't valid for this type.");
      else setError("Something went wrong. Please try again.");
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <form onSubmit={onSave} className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900">
        {mode === "create" ? "New attribute" : `${readOnly ? "View" : "Edit"} ${attribute?.admin_label}`}
      </h1>
      {readOnly && <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">This is a system attribute — its code, type, and options are locked.</p>}
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">Basics</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Admin label</span>
          <input className={field} value={label} onChange={(e) => setLabel(e.target.value)} readOnly={readOnly} required />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-900">Code {codeLocked && <span className="text-gray-400">(locked)</span>}</span>
            <input className={field + (codeLocked || readOnly ? " bg-gray-50 text-gray-500" : "")} value={code} onChange={(e) => setCode(e.target.value)} readOnly={codeLocked || readOnly} placeholder="shoe_type" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-900">Type</span>
            <select className={field} value={type} onChange={(e) => onTypeChange(e.target.value)} disabled={mode === "edit" || readOnly}>
              {ATTRIBUTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">Configuration</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {([
            ["is_required", "Required"],
            ["is_unique", "Unique"],
            ["is_filterable", "Filterable"],
            ["is_visible_on_front", "Visible on storefront"],
            ["is_comparable", "Comparable"],
          ] as const).map(([key, lbl]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={flags[key]} onChange={(e) => setFlags((f) => ({ ...f, [key]: e.target.checked }))} disabled={readOnly} className="h-4 w-4" />
              {lbl}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={flags.is_configurable}
              onChange={(e) => setFlags((f) => ({ ...f, is_configurable: e.target.checked }))}
              disabled={type !== "select" || readOnly}
              aria-describedby="config-hint"
              className="h-4 w-4"
            />
            Configurable (variant axis)
          </label>
        </div>
        {type !== "select" && <p id="config-hint" className="text-xs text-gray-400">Only <code>select</code> attributes can be a variant axis.</p>}
      </section>

      {HAS_OPTIONS(type) && (
        <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Options</h2>
            {!readOnly && (
              <button type="button" onClick={() => setOptions((o) => [...o, { label: "", value: "", position: o.length + 1 }])} className="text-sm font-medium text-brand-700 hover:underline">+ Add option</button>
            )}
          </div>
          {options.length === 0 && <p className="text-sm text-gray-400">Add at least one option.</p>}
          <ul className="space-y-2">
            {options.map((o, i) => (
              <li key={i} className="flex items-center gap-2">
                <input className={field} value={o.label} onChange={(e) => setOption(i, { label: e.target.value, value: o.value || e.target.value.toLowerCase().replace(/\s+/g, "_") })} placeholder="Label" readOnly={readOnly} />
                <input className={field} value={o.value} onChange={(e) => setOption(i, { value: e.target.value })} placeholder="value" readOnly={readOnly} />
                {!readOnly && (
                  <span className="flex shrink-0 items-center gap-1 text-xs">
                    <button type="button" onClick={() => moveOption(i, -1)} disabled={i === 0} aria-label="Move up" className="text-gray-400 disabled:opacity-30">↑</button>
                    <button type="button" onClick={() => moveOption(i, 1)} disabled={i === options.length - 1} aria-label="Move down" className="text-gray-400 disabled:opacity-30">↓</button>
                    <button type="button" onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove option" className="text-red-500">✕</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-2">
        <div className="mx-auto flex max-w-2xl items-center justify-end gap-3">
          <button type="button" onClick={() => router.push("/admin/attributes")} className="text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
          {!readOnly && (
            <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {pending ? "Saving…" : mode === "create" ? "Create attribute" : "Save changes"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
