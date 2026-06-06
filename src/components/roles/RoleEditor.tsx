"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { usePermissionCatalog, useCreateRole, useUpdateRole } from "@/lib/api/hooks/useRoles";
import type { RoleDetail } from "@/lib/api/schemas/roles";
import { ApiError } from "@/lib/api/errors";

/**
 * Role editor + permission matrix (role-editor.md, rbac-roles-permissions-fe
 * AC3/AC4/AC5). Permissions grouped by module from GET /admin/permissions, each
 * module a tri-state master (checked/mixed/empty). Search filter, live selected
 * count, default-deny. The Super Admin system role opens read-only/all-checked
 * with Save disabled; non-Super system roles lock the name. 409 → reload banner.
 */
export function RoleEditor({
  mode,
  role,
}: {
  mode: "create" | "edit";
  role?: RoleDetail;
}) {
  const router = useRouter();
  const { data: catalog, isLoading } = usePermissionCatalog();
  const create = useCreateRole();
  const update = useUpdateRole(role?.id ?? "");

  const readOnly = role?.is_super_admin ?? false;
  const nameLocked = role?.is_system ?? false;

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const [search, setSearch] = useState("");
  const [conflict, setConflict] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const baselineUpdatedAt = useRef(role?.updated_at);

  // Group the catalog by module.
  const groups = useMemo(() => {
    const map = new Map<string, { code: string; description?: string }[]>();
    for (const p of catalog ?? []) {
      const q = search.trim().toLowerCase();
      if (q && !p.code.toLowerCase().includes(q) && !(p.description ?? "").toLowerCase().includes(q)) continue;
      map.set(p.module, [...(map.get(p.module) ?? []), { code: p.code, description: p.description }]);
    }
    return Array.from(map.entries());
  }, [catalog, search]);

  function toggle(code: string) {
    if (readOnly) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }
  function toggleModule(codes: string[], allOn: boolean) {
    if (readOnly) return;
    setSelected((prev) => {
      const next = new Set(prev);
      codes.forEach((c) => (allOn ? next.delete(c) : next.add(c)));
      return next;
    });
  }

  async function onSave() {
    setFormError(null);
    setConflict(false);
    const permissions = readOnly ? (role?.permissions ?? []) : Array.from(selected);
    try {
      if (mode === "create") {
        await create.mutateAsync({ name: name.trim(), description: description.trim() || undefined, permissions });
      } else {
        await update.mutateAsync({
          name: nameLocked ? undefined : name.trim(),
          description: description.trim() || undefined,
          permissions,
          updated_at: baselineUpdatedAt.current,
        });
      }
      router.push("/admin/roles");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setConflict(true);
      else if (err instanceof ApiError && err.status === 400) setFormError("Check the role name — it may be a duplicate.");
      else if (err instanceof ApiError && err.status === 403) setFormError("This role's permissions can't be changed.");
      else setFormError("Something went wrong. Please try again.");
    }
  }

  const pending = create.isPending || update.isPending;
  const field = "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="space-y-5 pb-24">
      <h1 className="text-xl font-bold text-gray-900">
        {mode === "create" ? "Create role" : readOnly ? `${role?.name} (read-only)` : `Edit ${role?.name}`}
      </h1>

      {conflict && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This role was changed by someone else. Reload to see the latest.
          <button type="button" onClick={() => router.refresh()} className="font-medium underline">Reload</button>
        </div>
      )}
      {readOnly && (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
          The Super Admin role always has all permissions and can&apos;t be edited.
        </p>
      )}
      {formError && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Role name {nameLocked && <span className="text-gray-400">(locked)</span>}</span>
          <input className={field + (nameLocked ? " bg-gray-50 text-gray-500" : "")} value={name} onChange={(e) => setName(e.target.value)} readOnly={nameLocked || readOnly} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-900">Description</span>
          <input className={field} value={description} onChange={(e) => setDescription(e.target.value)} readOnly={readOnly} />
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search permissions…"
          className="h-10 w-64 rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        <p className="text-sm text-gray-600" aria-live="polite">Selected: {readOnly ? "All" : selected.size}</p>
      </div>

      {!readOnly && selected.size === 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">This role has no permissions — admins assigned to it won&apos;t be able to do anything.</p>
      )}

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      ) : (
        <div className="space-y-3">
          {groups.map(([module, perms]) => {
            const codes = perms.map((p) => p.code);
            const checkedCount = readOnly ? codes.length : codes.filter((c) => selected.has(c)).length;
            const allOn = checkedCount === codes.length && codes.length > 0;
            const mixed = checkedCount > 0 && !allOn;
            return (
              <ModuleGroup
                key={module}
                module={module}
                perms={perms}
                isChecked={(c) => readOnly || selected.has(c)}
                masterState={allOn ? "on" : mixed ? "mixed" : "off"}
                disabled={readOnly}
                onToggle={toggle}
                onToggleModule={() => toggleModule(codes, allOn)}
              />
            );
          })}
        </div>
      )}

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:pl-72">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          <button type="button" onClick={() => router.push("/admin/roles")} className="text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
          <button
            type="button"
            onClick={onSave}
            disabled={readOnly || pending || !name.trim()}
            className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? "Saving…" : mode === "create" ? "Create role" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModuleGroup({
  module,
  perms,
  isChecked,
  masterState,
  disabled,
  onToggle,
  onToggleModule,
}: {
  module: string;
  perms: { code: string; description?: string }[];
  isChecked: (code: string) => boolean;
  masterState: "on" | "off" | "mixed";
  disabled: boolean;
  onToggle: (code: string) => void;
  onToggleModule: () => void;
}) {
  const [open, setOpen] = useState(true);
  const masterRef = (el: HTMLInputElement | null) => {
    if (el) el.indeterminate = masterState === "mixed";
  };

  return (
    <fieldset className="rounded-lg border border-gray-200">
      <legend className="sr-only">{module} permissions</legend>
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <input
            type="checkbox"
            ref={masterRef}
            checked={masterState === "on"}
            aria-checked={masterState === "mixed" ? "mixed" : masterState === "on"}
            disabled={disabled}
            onChange={onToggleModule}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          {module}
        </label>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-gray-400 hover:text-gray-600">
          {open ? "−" : "+"}
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 p-4 sm:grid-cols-2">
          {perms.map((p) => (
            <label key={p.code} className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isChecked(p.code)}
                disabled={disabled}
                onChange={() => onToggle(p.code)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span>
                <span className="block">{p.code}</span>
                {p.description && <span className="block text-xs text-gray-400">{p.description}</span>}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
