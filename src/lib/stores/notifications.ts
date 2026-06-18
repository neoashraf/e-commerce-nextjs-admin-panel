import { create } from "zustand";

import { api } from "@/lib/api/client";
import {
  type AdminNotification,
  markAllReadResultSchema,
  markReadResultSchema,
  notificationFeedEnvelopeSchema,
} from "@/lib/api/schemas/notification-feed";

/**
 * In-app admin notification feed state — the data behind the topbar bell (NOTIF FR-NOTIF-073/074).
 *
 * This store is the single source of truth for the bell: it's hydrated once from the durable feed
 * (authoritative), then live SSE pushes are prepended via {@link receive}. The durable feed is what
 * survives reloads / offline windows; the SSE stream just accelerates delivery (BR-NOTIF-11), so on
 * reconnect we re-hydrate to recover anything missed.
 */

/** Cap the in-memory list — the dropdown shows recent items; older ones live in the durable feed. */
const MAX_ITEMS = 50;

interface NotificationsState {
  items: AdminNotification[];
  unread: number;
  hydrated: boolean;
  /** Load the durable feed (most-recent-first) + authoritative unread count. */
  hydrate: () => Promise<void>;
  /** A live SSE push: prepend (deduped) and bump unread. */
  receive: (n: AdminNotification) => void;
  /** Mark one read — optimistic, then reconcile the unread count with the server. */
  markRead: (id: string) => Promise<void>;
  /** Mark all read — optimistic, then persist. */
  markAllRead: () => Promise<void>;
  /** Drop all state (on logout). */
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unread: 0,
  hydrated: false,

  hydrate: async () => {
    try {
      const res = await api.get("/admin/notification-feed", {
        schema: notificationFeedEnvelopeSchema,
        rawEnvelope: true,
        params: { limit: MAX_ITEMS },
      });
      set({ items: res.data, unread: res.meta.unread, hydrated: true });
    } catch {
      // Leave any existing state intact; the SSE stream / next hydrate will recover.
      set({ hydrated: true });
    }
  },

  receive: (n) => {
    const { items } = get();
    if (items.some((i) => i.id === n.id)) return; // dedupe (e.g. a re-delivered frame)
    set((s) => ({
      items: [n, ...s.items].slice(0, MAX_ITEMS),
      unread: s.unread + (n.is_read ? 0 : 1),
    }));
  },

  markRead: async (id) => {
    const target = get().items.find((i) => i.id === id);
    if (target && !target.is_read) {
      set((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, is_read: true } : i)),
        unread: Math.max(0, s.unread - 1),
      }));
    }
    try {
      const res = await api.post(`/admin/notification-feed/${id}/read`, undefined, {
        schema: markReadResultSchema,
      });
      set({ unread: res.unread }); // server is authoritative
    } catch {
      // Optimistic state stands; a later hydrate reconciles.
    }
  },

  markAllRead: async () => {
    set((s) => ({ items: s.items.map((i) => ({ ...i, is_read: true })), unread: 0 }));
    try {
      await api.post("/admin/notification-feed/read-all", undefined, {
        schema: markAllReadResultSchema,
      });
    } catch {
      // Optimistic state stands; a later hydrate reconciles.
    }
  },

  reset: () => set({ items: [], unread: 0, hydrated: false }),
}));
