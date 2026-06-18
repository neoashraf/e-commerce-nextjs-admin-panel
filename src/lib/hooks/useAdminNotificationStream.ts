"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { env } from "@/lib/env";
import { adminNotificationSchema } from "@/lib/api/schemas/notification-feed";
import { useNotificationsStore } from "@/lib/stores/notifications";
import { useAuthStore } from "@/lib/stores/auth";
import { toast } from "@/lib/stores/toast";
import { playAlertSound } from "@/lib/sound/alert";

/**
 * Subscribe to the admin's real-time notification stream (NOTIF FR-NOTIF-071). Opens an SSE
 * `EventSource` to `/admin/notification-feed/stream?token=…` (EventSource can't set an Authorization
 * header, so the access token rides as a query param — validated server-side, FR-NOTIF-075).
 *
 * On each `notification` event: push it into the store, fire a toast, play the alert sound, and — for
 * order events — invalidate the dashboard query so the recent-activity widget refreshes (FR-DASH-033).
 * The browser auto-reconnects on a drop; we re-hydrate the durable feed on (re)connect so a push
 * missed during the gap is recovered (FR-NOTIF-072, §12 edge case 16). Mount once in the admin shell.
 */
export function useAdminNotificationStream(): void {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken ?? null);
  const authHydrated = useAuthStore((s) => s.hydrated);
  const qc = useQueryClient();

  useEffect(() => {
    if (!authHydrated || !accessToken) return;

    const { hydrate, receive } = useNotificationsStore.getState();
    const base = env.apiUrl.replace(/\/$/, "");
    const url = `${base}/admin/notification-feed/stream?token=${encodeURIComponent(accessToken)}`;

    // Populate the bell immediately, before/independent of the stream connecting.
    void hydrate();

    const es = new EventSource(url);

    // Re-sync the durable feed on every successful (re)connect to recover any missed pushes.
    es.onopen = () => void hydrate();

    es.addEventListener("notification", (event) => {
      const parsed = adminNotificationSchema.safeParse(
        safeJson((event as MessageEvent).data),
      );
      if (!parsed.success) return;
      const n = parsed.data;
      receive(n);
      playAlertSound();
      toast(n.title, "info");
      if (n.type === "order") {
        void qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      }
    });

    return () => es.close();
  }, [authHydrated, accessToken, qc]);
}

function safeJson(raw: unknown): unknown {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
