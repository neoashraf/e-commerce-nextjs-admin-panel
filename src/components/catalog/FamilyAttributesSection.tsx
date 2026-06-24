"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";
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

/**
 * Standard sport attributes always shown in the editor (matches the design's
 * Attributes section and the SRS seeded attributes, Appendix B). Codes use the
 * SRS canonical codes so saved values map to the real attribute model. These are
 * rendered for every product; any further family-specific attributes are appended
 * below (deduped by code).
 *
 * IMPORTANT: each option is `{ value, label }` mirroring the backend seed
 * (src/database/seeds/catalog-attributes.seed.ts). The editor must SUBMIT the
 * canonical `value` (e.g. `men`) and only DISPLAY the `label` (e.g. `Men`) —
 * the attribute validator accepts an option's `value`/`id`, never its label
 * (backend AttributeAssignmentValidator.knownOption), so submitting a label is
 * rejected as UNKNOWN_OPTION. Keep these in sync with the seed.
 */
type StandardOption = { value: string; label: string };
const STANDARD_ATTRIBUTES: {
  code: string;
  label: string;
  kind: "select" | "multiselect";
  options: StandardOption[];
  required?: boolean;
}[] = [
  { code: "gender", label: "Gender", kind: "select", required: true, options: [
    { value: "men", label: "Men" }, { value: "women", label: "Women" },
    { value: "unisex", label: "Unisex" }, { value: "kids", label: "Kids" },
  ] },
  { code: "sport", label: "Sport", kind: "multiselect", required: true, options: [
    { value: "football", label: "Football" }, { value: "futsal", label: "Futsal" },
    { value: "turf", label: "Turf" }, { value: "running", label: "Running" },
    { value: "training", label: "Training" }, { value: "lifestyle", label: "Lifestyle" },
  ] },
  { code: "surface_type", label: "Surface / Ground", kind: "multiselect", required: true, options: [
    { value: "fg", label: "Firm Ground (FG)" }, { value: "sg", label: "Soft Ground (SG)" },
    { value: "ag", label: "Artificial Ground (AG)" }, { value: "tf", label: "Turf (TF)" },
    { value: "in", label: "Indoor (IN)" },
  ] },
  { code: "material", label: "Upper Material", kind: "select", required: true, options: [
    { value: "synthetic", label: "Synthetic" }, { value: "leather", label: "Leather" },
    { value: "knit", label: "Knit" }, { value: "mesh", label: "Mesh" },
  ] },
  { code: "tier", label: "Performance Tier", kind: "select", required: true, options: [
    { value: "elite", label: "Elite" }, { value: "pro", label: "Pro" },
    { value: "league", label: "League" }, { value: "club", label: "Club" },
  ] },
  { code: "product_type", label: "Product Type", kind: "select", required: true, options: [
    { value: "boots", label: "Boots" }, { value: "jersey", label: "Jersey" },
    { value: "turf_shoe", label: "Turf Shoe" }, { value: "futsal_shoe", label: "Futsal Shoe" },
    { value: "accessory", label: "Accessory" },
  ] },
];
const STANDARD_CODES = new Set(STANDARD_ATTRIBUTES.map((a) => a.code));

export function FamilyAttributesSection({
  familyId,
  values,
  onChange,
  onAllowedCodes,
  embedded = false,
}: {
  familyId: string;
  values: Record<string, AttrValue>;
  onChange: (code: string, value: AttrValue) => void;
  /**
   * Reports the set of attribute codes this family allows, once the family loads.
   * The editor uses it to drop any family-foreign values before save so the
   * backend never sees an ATTRIBUTE_NOT_IN_FAMILY. Undefined until the family is
   * known (so the editor can skip filtering rather than wrongly drop everything).
   */
  onAllowedCodes?: (codes: Set<string> | undefined) => void;
  /** When true, render bare content (no outer card/heading) — the editor wraps it. */
  embedded?: boolean;
}) {
  const { data: family } = useEditorFamily(familyId);
  // Full attribute list → is_required + id keyed by code (capped at the BE max).
  const { data: attrList } = useAttributes({ limit: 200 });

  const byCode = new Map<string, AttributeRow>((attrList?.data ?? []).map((a) => [a.code, a]));

  // Codes the family actually contains. The backend rejects any submitted
  // attribute that isn't part of the product's family (ATTRIBUTE_NOT_IN_FAMILY),
  // so we must only render — and therefore only submit — attributes in this set.
  // Until the family loads, render nothing rather than show fields that may not
  // belong (e.g. the Default family has only gender + brand, not material/sport).
  const familyCodes = new Set(
    (family?.groups ?? []).flatMap((g) => g.attributes).map((a) => a.code),
  );

  // Surface the allowed-code set to the editor once the family resolves.
  const familyLoaded = !!family;
  useEffect(() => {
    onAllowedCodes?.(familyLoaded ? familyCodes : undefined);
    // familyCodes is derived from `family`; key the effect on the family load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyLoaded, familyId]);

  // Standard sport attributes the family includes (intersection with the seeded
  // standard set) — shown first, matching the design's Attributes section.
  const standard = STANDARD_ATTRIBUTES.filter((a) => familyCodes.has(a.code));

  // Extra family attributes beyond the standard sport set (and beyond the system
  // fields the editor handles elsewhere) — appended after the standard ones.
  const extra: FamilyAttribute[] = (family?.groups ?? [])
    .flatMap((g) => g.attributes)
    .filter((a) => !HANDLED_CODES.has(a.code) && !STANDARD_CODES.has(a.code));

  const body = (
    <>
      <p className="text-[12.5px] leading-relaxed text-text-muted">
        Product specs &amp; configurable attributes. Required ones must be filled before publishing.
      </p>
      {/* Standard sport attributes the family includes. */}
      {standard.map((a) => (
        <StandardField
          key={a.code}
          def={a}
          value={values[a.code]}
          onChange={(v) => onChange(a.code, v)}
        />
      ))}
      {/* Any further family-specific attributes (deduped against the standard set). */}
      {extra.map((attr) => (
        <AttributeField
          key={attr.code}
          attr={attr}
          meta={byCode.get(attr.code)}
          value={values[attr.code]}
          onChange={(v) => onChange(attr.code, v)}
        />
      ))}
    </>
  );

  if (embedded) return <div className="flex flex-col gap-4">{body}</div>;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold text-text">Attributes</h2>
      {body}
    </section>
  );
}

/** Self-contained renderer for a standard attribute (no per-attribute fetch):
 * select → dropdown, multiselect → check chips. Matches the design's fields. */
function StandardField({
  def,
  value,
  onChange,
}: {
  def: { code: string; label: string; kind: "select" | "multiselect"; options: StandardOption[]; required?: boolean };
  value: AttrValue | undefined;
  onChange: (v: AttrValue) => void;
}) {
  const label = (
    <span className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
      {def.label}
      {def.required && <span className="text-error">*</span>}
    </span>
  );

  if (def.kind === "multiselect") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className="block">
        {label}
        <div className="flex flex-wrap gap-2">
          {def.options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
                className={
                  "inline-flex select-none items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1 " +
                  (on ? "border-accent-600 bg-accent-50 text-accent-700" : "border-border-strong text-text-secondary hover:bg-surface-subtle")
                }
              >
                {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                {o.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  return (
    <label className="block">
      {label}
      <select
        className="h-[38px] w-full max-w-[340px] cursor-pointer rounded-lg border border-border-strong bg-surface px-3 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        aria-required={def.required}
      >
        <option value="">Select…</option>
        {def.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
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
    <span className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
      {attr.admin_label}
      {required && <span className="text-error">*</span>}
    </span>
  );
  const field =
    "h-[38px] w-full max-w-[340px] rounded-lg border border-border-strong bg-surface px-3 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1";

  if (type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border-strong text-accent-600 focus-visible:ring-accent-600"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        {attr.admin_label}
        {required && <span className="text-error"> *</span>}
      </label>
    );
  }

  if (type === "textarea" || type === "rich_text") {
    return (
      <label className="block">
        {label}
        <textarea
          className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
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
          <p className="text-xs text-text-faint">Loading options…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {options.map((o) => {
              const on = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])
                  }
                  className={
                    "inline-flex select-none items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1 " +
                    (on
                      ? "border-accent-600 bg-accent-50 text-accent-700"
                      : "border-border-strong text-text-secondary hover:bg-surface-subtle")
                  }
                >
                  {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                  {o.label}
                </button>
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
        className={field + " cursor-pointer"}
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
