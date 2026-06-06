"use client";

import { useEffect, useState } from "react";
import { useNotifSettings, useSaveNotifSettings } from "@/lib/api/hooks/useSettings";
import { Can } from "@/lib/permissions/Can";
import { toast } from "@/lib/stores/toast";

/**
 * Notification settings (notif-settings-fe). Channel toggles + quiet-hours-style
 * boolean/string settings rendered generically from the settings record (the
 * exact shape is provider-defined; flagged). Saved via PUT.
 */
export function NotifSettingsView() {
  const { data, isLoading, isError, refetch } = useNotifSettings();
  const save = useSaveNotifSettings();
  const [settings, setSettings] = useState<Record<string, unknown>>({});

  useEffect(() => { if (data) setSettings(data); }, [data]);

  return (
    <div className="space-y-5 pb-24">
      <h1 className="text-xl font-bold text-gray-900">Notification settings</h1>

      {isLoading ? <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        : isError ? <div className="py-12 text-center"><p className="text-sm text-gray-600">Couldn&apos;t load settings.</p><button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">Try again</button></div>
        : (
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
            {Object.entries(settings).length === 0 && <p className="text-sm text-gray-400">No configurable settings.</p>}
            {Object.entries(settings).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700">{key.replace(/_/g, " ")}</span>
                {typeof value === "boolean" ? (
                  <input type="checkbox" checked={value} onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))} className="h-4 w-4" />
                ) : (
                  <input value={String(value ?? "")} onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))} className="h-9 w-48 rounded-md border border-gray-300 px-2 text-sm" />
                )}
              </div>
            ))}
            <p className="text-xs text-gray-400">Exact settings shape is provider-defined — rendered generically; flagged for BE alignment.</p>
          </div>
        )}

      <Can permission="notifications.settings.manage">
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:pl-72">
          <div className="mx-auto flex max-w-5xl items-center justify-end"><button type="button" onClick={() => save.mutate(settings, { onSuccess: () => toast("Settings saved.") })} disabled={save.isPending} className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{save.isPending ? "Saving…" : "Save settings"}</button></div>
        </div>
      </Can>
    </div>
  );
}
