import { z } from "zod";

/**
 * In-app admin notification feed (docs/api-contracts/09-notifications.md → In-App Admin Feed).
 * One row per recipient admin; the same shape arrives over the SSE `notification` event and from
 * the REST list/mark-read endpoints.
 */
export const adminNotificationSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  data: z.record(z.unknown()).nullable(),
  related_entity: z.object({ type: z.string(), id: z.string().nullable() }).nullable(),
  is_read: z.boolean(),
  created_at: z.string(),
});
export type AdminNotification = z.infer<typeof adminNotificationSchema>;

/** GET /admin/notification-feed — raw envelope: { data: rows, meta: { page, limit, total, unread } }. */
export const notificationFeedEnvelopeSchema = z.object({
  data: z.array(adminNotificationSchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    unread: z.number(),
  }),
});
export type NotificationFeedEnvelope = z.infer<typeof notificationFeedEnvelopeSchema>;

/** GET /admin/notification-feed/unread-count. */
export const unreadCountSchema = z.object({ unread: z.number() });

/** POST /admin/notification-feed/:id/read. */
export const markReadResultSchema = z.object({
  id: z.string(),
  is_read: z.boolean(),
  unread: z.number(),
});

/** POST /admin/notification-feed/read-all. */
export const markAllReadResultSchema = z.object({
  marked: z.number(),
  unread: z.number(),
});
