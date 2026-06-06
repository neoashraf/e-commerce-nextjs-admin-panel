"use client";

import { useEffect, useState } from "react";
import { usePaymentSettings, useSavePaymentSettings, type PaymentSettings } from "@/lib/api/hooks/useSettings";
import { Can } from "@/lib/permissions/Can";
import { toast } from "@/lib/stores/toast";

/**
 * Payment settings (pay-settings-fe). Per-gateway enable + environment for
 * bKash / SSLCommerz + COD enable. Credentials are referenced (secret://) — not
 * entered here (handled server-side); the UI toggles enablement + environment.
 */
type Method = "bkash" | "sslcommerz" | "cod";
const LABEL: Record<Method, string> = { bkash: "bKash", sslcommerz: "SSLCommerz", cod: "Cash on delivery" };

export function PaymentSettingsView() {
  const { data, isLoading, isError, refetch } = usePaymentSettings();
  const save = useSavePaymentSettings();
  const [settings, setSettings] = useState<PaymentSettings>({});

  useEffect(() => { if (data) setSettings(data); }, [data]);

  function setMethod(m: Method, patch: Partial<NonNullable<PaymentSettings["bkash"]>>) {
    setSettings((prev) => ({ ...prev, [m]: { ...(prev[m] ?? { is_enabled: false }), ...patch } }));
  }

  return (
    <div className="space-y-5 pb-24">
      <h1 className="text-xl font-bold text-gray-900">Payment settings</h1>

      {isLoading ? <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        : isError ? <div className="py-12 text-center"><p className="text-sm text-gray-600">Couldn&apos;t load payment settings.</p><button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button></div>
        : (
          <div className="space-y-4">
            {(["bkash", "sslcommerz", "cod"] as Method[]).map((m) => {
              const cfg = settings[m];
              return (
                <fieldset key={m} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <legend className="text-sm font-semibold text-gray-900">{LABEL[m]}</legend>
                    <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={cfg?.is_enabled ?? false} onChange={(e) => setMethod(m, { is_enabled: e.target.checked })} className="h-4 w-4" /> Enabled</label>
                  </div>
                  {m !== "cod" && (
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                      <label className="flex items-center gap-2 text-gray-600">Environment
                        <select value={cfg?.environment ?? "sandbox"} onChange={(e) => setMethod(m, { environment: e.target.value })} className="h-9 rounded-md border border-gray-300 px-2 text-sm">
                          <option value="sandbox">Sandbox</option><option value="live">Live</option>
                        </select>
                      </label>
                      <span className="text-xs text-gray-400">Credentials are managed server-side (secret reference).</span>
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>
        )}

      <Can permission="payments.settings.manage">
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:pl-72">
          <div className="mx-auto flex max-w-5xl items-center justify-end"><button type="button" onClick={() => save.mutate(settings, { onSuccess: () => toast("Payment settings saved.") })} disabled={save.isPending} className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{save.isPending ? "Saving…" : "Save payment settings"}</button></div>
        </div>
      </Can>
    </div>
  );
}
