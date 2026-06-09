"use client";

import { useEffect, useState } from "react";
import {
  useNotifSettings,
  useSaveNotifSettings,
  type EmailSettings,
  type NotifSettings,
  type SmsSettings,
} from "@/lib/api/hooks/useSettings";
import { Can } from "@/lib/permissions/Can";
import { isApiError } from "@/lib/api/errors";
import { toast } from "@/lib/stores/toast";

/**
 * Notification provider settings (notif-settings-fe; FR-NOTIF-063, contract
 * "Provider Settings"). Two channel sections — SMS and Email — each with the
 * fields the backend accepts. `credentials_ref` is a pointer to a stored secret;
 * raw credentials are never shown or accepted here. Saved via PUT.
 */

const EMPTY: NotifSettings = {
  sms: {
    provider_name: null,
    masked_sender_id: null,
    non_masking_sender: null,
    credentials_ref: null,
    quiet_hours_start: null,
    quiet_hours_end: null,
  },
  email: { provider_name: null, transactional_from: null, credentials_ref: null },
};

export function NotifSettingsView() {
  const { data, isLoading, isError, refetch } = useNotifSettings();
  const save = useSaveNotifSettings();
  const [form, setForm] = useState<NotifSettings>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const setSms = <K extends keyof SmsSettings>(key: K, value: string) =>
    setForm((f) => ({ ...f, sms: { ...f.sms, [key]: value === "" ? null : value } }));
  const setEmail = <K extends keyof EmailSettings>(key: K, value: string) =>
    setForm((f) => ({ ...f, email: { ...f.email, [key]: value === "" ? null : value } }));

  const onSave = () => {
    setErrors({});
    save.mutate(form, {
      onSuccess: () => toast("Notification settings saved."),
      onError: (err) => {
        if (isApiError(err) && Object.keys(err.fieldErrors).length > 0) {
          setErrors(err.fieldErrors);
        } else {
          toast(isApiError(err) ? err.message : "Couldn't save settings.");
        }
      },
    });
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Notification settings</h1>
      <p className="text-sm text-gray-500">
        Configure the SMS and email providers used for all customer notifications.
        Credentials are stored securely and referenced by a pointer — they are
        never displayed here.
      </p>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">Couldn&apos;t load settings.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 text-sm font-medium text-brand-700 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* SMS channel */}
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold text-gray-900">SMS provider</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Provider name" value={form.sms.provider_name} onChange={(v) => setSms("provider_name", v)} placeholder="ssl_wireless" error={errors.provider_name} />
              <Field
                label="Masked sender ID"
                value={form.sms.masked_sender_id}
                onChange={(v) => setSms("masked_sender_id", v)}
                placeholder="SportShop"
                hint="Alphanumeric, ≤ 11 characters."
                error={errors.masked_sender_id}
              />
              <Field label="Non-masking sender" value={form.sms.non_masking_sender} onChange={(v) => setSms("non_masking_sender", v)} placeholder="8801XXXXXXXXX" error={errors.non_masking_sender} />
              <Field label="Credentials reference" value={form.sms.credentials_ref} onChange={(v) => setSms("credentials_ref", v)} placeholder="secret://sms/ssl_wireless" hint="Pointer to the stored secret — not the secret itself." error={errors.credentials_ref} />
              <Field label="Quiet hours start" type="time" value={form.sms.quiet_hours_start} onChange={(v) => setSms("quiet_hours_start", v)} placeholder="22:00" hint="24-hour HH:MM." error={errors.quiet_hours_start} />
              <Field label="Quiet hours end" type="time" value={form.sms.quiet_hours_end} onChange={(v) => setSms("quiet_hours_end", v)} placeholder="08:00" hint="24-hour HH:MM." error={errors.quiet_hours_end} />
            </div>
          </section>

          {/* Email channel */}
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold text-gray-900">Email provider</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Provider name" value={form.email.provider_name} onChange={(v) => setEmail("provider_name", v)} placeholder="smtp_relay" />
              <Field label="Transactional from" type="email" value={form.email.transactional_from} onChange={(v) => setEmail("transactional_from", v)} placeholder="noreply@sportshop.com.bd" error={errors.transactional_from} />
              <Field label="Credentials reference" value={form.email.credentials_ref} onChange={(v) => setEmail("credentials_ref", v)} placeholder="secret://email/smtp" hint="Pointer to the stored secret — not the secret itself." error={errors.credentials_ref} />
            </div>
          </section>
        </>
      )}

      {!isLoading && !isError && (
        <Can permission="notifications.settings.manage">
          <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
            <div className="mx-auto flex max-w-5xl items-center justify-end">
              <button
                type="button"
                onClick={onSave}
                disabled={save.isPending}
                className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save settings"}
              </button>
            </div>
          </div>
        </Can>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  type = "text",
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  type?: "text" | "email" | "time";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={[
          "h-10 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30",
          error ? "border-red-400 focus:border-red-500" : "border-gray-300 focus:border-brand-500",
        ].join(" ")}
      />
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-gray-400">{hint}</span>
      ) : null}
    </label>
  );
}
