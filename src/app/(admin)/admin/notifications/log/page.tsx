import { Suspense } from "react";
import { NotifLogView } from "@/components/notif/NotifLogView";

/** Notification log — /admin/notifications/log (notif-log-fe). */
export default function NotifLogPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
      <NotifLogView />
    </Suspense>
  );
}
