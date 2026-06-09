"use client";

import { useEditorFamily, useAttributes, useAttribute } from "@/lib/api/hooks/useCatalog";
import type { AttributeRow, FamilyAttribute } from "@/lib/api/schemas/catalog";

/**
 * Family-driven attribute inputs for the product editor. Renders the chosen
 * family's groups (minus the system attributes the editor already has dedicated
 * fields for) and, per attribute, the right input for its type. Values flow up
 * through `value` / `onChange` as a flat { code -> value } map that the editor
 * sends as `attributes` on save (FR-CAT-010/018/053).
 *
 * Scope note: select/multiselect options are fetched per-attribute. The admin
 * API exposes is_required + options only on the attribute detail, so we join the
 * family's attribute list against the attribute list (for is_required/id) and
 * lazily load options for the select-typed ones.
 */

// Codes the editor already renders as first-class fields — don't duplicate them.
const HANDLED_CODES = new Set([
  "sku", "name", "url_key", "price", "status", "description",
  "short_description", "brand", "meta_title", "meta_keywords", "meta_description",
]);

const SELECT_TYPES = new Set(["select", "multiselect"]);

type AttrValue = string | string[] | boolean;

export function FamilyAttributesSection({
  familyId,
  values,
  onChange,
}: {
  familyId: string;
  values: Record<string, AttrValue>;
  onChange: (code: string, value: AttrValue) => void;
}) {
  const { data: family, isLoading } = useEditorFamily(familyId);
  // Full attribute list → is_required + id keyed by code (capped at the BE max).
  const { data: attrList } = useAttributes({ limit: 200 });

  if (!familyId) return null;
  if (isLoading) return <div className="h-24 animate-pulse rounded-lg bg-gray-100" />;
  if (!family) return null;

  const byCode = new Map<string, AttributeRow>((attrList ?? []).map((a) => [a.code, a]));

  // Flatten the family's groups into the custom (non-handled) attributes.
  const custom: FamilyAttribute[] = family.groups
    .flatMap((g) => g.attributes)
    .filter((a) => !HANDLED_CODES.has(a.code));

  if (custom.length === 0) return null;

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900">Attributes</h2>
      <p className="text-xs text-gray-500">
        These come from the product&apos;s family. Required ones must be filled before publishing.
      </p>
      {custom.map((attr) => (
        <AttributeField
          key={attr.code}
          attr={attr}
          meta={byCode.get(attr.code)}
          value={values[attr.code]}
          onChange={(v) => onChange(attr.code, v)}
        />
      ))}
    </section>
  );
}

function AttributeField({
  attr,
  meta,
  value,
  onChange,
}: {
  attr: FamilyAttribute;
  meta: AttributeRow | undefined;
  value: AttrValue | undefined;
  onChange: (v: AttrValue) => void;
}) {
  const required = meta?.is_required ?? false;
  const type = attr.type;
  const label = (
    <span className="mb-1 block text-sm font-medium text-gray-900">
      {attr.admin_label}
      {required && <span className="text-red-500"> *</span>}
    </span>
  );
  const field =
    "h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  if (type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        {attr.admin_label}
        {required && <span className="text-red-500"> *</span>}
      </label>
    );
  }

  if (type === "textarea" || type === "rich_text") {
    return (
      <label className="block">
        {label}
        <textarea
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          aria-required={required}
        />
      </label>
    );
  }

  if (SELECT_TYPES.has(type) && meta?.id) {
    return (
      <SelectField
        attrId={meta.id}
        label={label}
        multiple={type === "multiselect"}
        required={required}
        field={field}
        value={value}
        onChange={onChange}
      />
    );
  }

  // text / number / decimal / price / date / datetime / url / file / image fallback.
  const inputType =
    type === "number" || type === "decimal" || type === "price"
      ? "number"
      : type === "date"
      ? "date"
      : type === "datetime"
      ? "datetime-local"
      : "text";

  return (
    <label className="block">
      {label}
      <input
        className={field}
        type={inputType}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required}
      />
    </label>
  );
}

function SelectField({
  attrId,
  label,
  multiple,
  required,
  field,
  value,
  onChange,
}: {
  attrId: string;
  label: React.ReactNode;
  multiple: boolean;
  required: boolean;
  field: string;
  value: AttrValue | undefined;
  onChange: (v: AttrValue) => void;
}) {
  const { data: detail, isLoading } = useAttribute(attrId);
  const options = detail?.options ?? [];

  if (multiple) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className="block">
        {label}
        {isLoading ? (
          <p className="text-xs text-gray-400">Loading options…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {options.map((o) => {
              const on = selected.includes(o.value);
              return (
                <label
                  key={o.value}
                  className={
                    "cursor-pointer rounded-full border px-3 py-1 text-sm " +
                    (on
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-gray-300 text-gray-600")
                  }
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...selected, o.value]
                          : selected.filter((v) => v !== o.value),
                      )
                    }
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
    );
  }

  return (
    <label className="block">
      {label}
      <select
        className={field}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required}
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
