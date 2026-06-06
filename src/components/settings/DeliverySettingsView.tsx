"use client";

import { useEffect, useState } from "react";
import { useDeliverySettings, useSaveDeliverySettings, type DeliveryZone } from "@/lib/api/hooks/useSettings";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";

/**
 * Delivery settings (delivery-settings-fe). Per-zone delivery charge, COD
 * surcharge (% + flat), free-shipping threshold, COD-enabled, active. Saved via
 * PUT (full replace). Validation: charge ≥ 0, surcharge % 0–100.
 */
const ZONE_LABEL: Record<string, string> = { inside_dhaka: "Inside Dhaka", near_dhaka: "Near Dhaka", outside_dhaka: "Outside Dhaka" };

export function DeliverySettingsView() {
  const { data, isLoading, isError, refetch } = useDeliverySettings();
  const save = useSaveDeliverySettings();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (data) setZones(data.zones); }, [data]);

  function set(i: number, patch: Partial<DeliveryZone>) { setZones((prev) => prev.map((z, idx) => (idx === i ? { ...z, ...patch } : z))); }

  async function onSave() {
    setError(null);
    for (const z of zones) {
      if (Number(z.delivery_charge) < 0) { setError("Delivery charge can't be negative."); return; }
      const pct = Number(z.cod_surcharge_pct);
      if (pct < 0 || pct > 100) { setError("COD surcharge % must be between 0 and 100."); return; }
    }
    try { await save.mutateAsync(zones); toast("Delivery settings saved."); }
    catch (err) { setError(err instanceof ApiError && err.status === 400 ? "Check the values — charges must be valid." : "Couldn't save. Try again."); }
  }

  const inp = "h-9 w-full rounded-md border border-gray-300 px-2 text-sm";

  return (
    <div className="space-y-5 pb-24">
      <h1 className="text-xl font-bold text-gray-900">Delivery settings</h1>
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isLoading ? <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        : isError ? <div className="py-12 text-center"><p className="text-sm text-gray-600">Couldn&apos;t load delivery settings.</p><button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button></div>
        : (
          <div className="space-y-4">
            {zones.map((z, i) => (
              <fieldset key={z.zone} className="rounded-lg border border-gray-200 bg-white p-4">
                <legend className="px-1 text-sm font-semibold text-gray-900">{ZONE_LABEL[z.zone] ?? z.zone}</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label className="block"><span className="mb-1 block text-xs text-gray-500">Delivery charge (৳)</span><input className={inp} type="number" value={z.delivery_charge} onChange={(e) => set(i, { delivery_charge: e.target.value })} /></label>
                  <label className="block"><span className="mb-1 block text-xs text-gray-500">COD surcharge (%)</span><input className={inp} type="number" value={z.cod_surcharge_pct} onChange={(e) => set(i, { cod_surcharge_pct: e.target.value })} /></label>
                  <label className="block"><span className="mb-1 block text-xs text-gray-500">COD flat (৳)</span><input className={inp} type="number" value={z.cod_surcharge_flat} onChange={(e) => set(i, { cod_surcharge_flat: e.target.value })} /></label>
                  <label className="block"><span className="mb-1 block text-xs text-gray-500">Free shipping over (৳)</span><input className={inp} type="number" value={z.free_shipping_threshold ?? ""} onChange={(e) => set(i, { free_shipping_threshold: e.target.value || null })} placeholder="none" /></label>
                </div>
                <div className="mt-3 flex gap-5">
                  <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={z.cod_enabled} onChange={(e) => set(i, { cod_enabled: e.target.checked })} className="h-4 w-4" /> COD enabled</label>
                  <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={z.is_active} onChange={(e) => set(i, { is_active: e.target.checked })} className="h-4 w-4" /> Active</label>
                </div>
              </fieldset>
            ))}
          </div>
        )}

      <Can permission="cart.settings.manage">
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:pl-72">
          <div className="mx-auto flex max-w-5xl items-center justify-end"><button type="button" onClick={onSave} disabled={save.isPending} className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{save.isPending ? "Saving…" : "Save delivery settings"}</button></div>
        </div>
      </Can>
    </div>
  );
}
