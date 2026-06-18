"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

import { useNotificationsStore } from "@/lib/stores/notifications";

/**
 * Topbar notification bell + dropdown feed (NOTIF SRS §10; FR-NOTIF-073/074). Shows the unread count
 * badge; opening lists recent in-app notifications (most-recent-first), each deep-linking to its
 * target (e.g. the order). New items arrive live via the SSE stream mounted in the shell. Keyboard
 * accessible: Esc + outside-click close, focus returns to the trigger.
 */
export function NotificationBell() {
  const items = useNotificationsStore((s) => s.items);
  const unread = useNotificationsStore((s) => s.unread);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onClick(e: MouseEvent) {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.05rem] items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-surface">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-md border border-border bg-surface shadow-md"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-medium text-text">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-accent-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-muted">
                No notifications yet
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const row = (
                    <span className="flex gap-2.5">
                      <span
                        aria-hidden
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          n.is_read ? "bg-transparent" : "bg-accent-600"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text">
                          {n.title}
                        </span>
                        {n.body && (
                          <span className="mt-0.5 block truncate text-xs text-text-muted">
                            {n.body}
                          </span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-text-faint">
                          {relativeTime(n.created_at)}
                        </span>
                      </span>
                    </span>
                  );

                  const onSelect = () => {
                    void markRead(n.id);
                    setOpen(false);
                  };

                  return (
                    <li key={n.id} className={n.is_read ? "" : "bg-accent-50/40"}>
                      {n.link ? (
                        <Link
                          href={n.link}
                          role="menuitem"
                          onClick={onSelect}
                          className="block px-4 py-3 hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                        >
                          {row}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={onSelect}
                          className="block w-full px-4 py-3 text-left hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                        >
                          {row}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact relative time ("just now", "5m ago", "3h ago", "2d ago"); falls back to a date. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 45) return "just now";
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
