"use client";

import { useToastStore } from "@/lib/stores/toast";

/**
 * Global toast viewport (aria-live). Mounted once in the root layout; admin
 * screens emit via `toast()` / `useToastStore`.
 */
const STYLE = {
  success: "bg-green-600",
  error: "bg-red-600",
  info: "bg-gray-800",
} as const;

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={"pointer-events-auto flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg " + STYLE[t.variant]}>
          <span className="break-words">{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 text-white/80 hover:text-white">✕</button>
        </div>
      ))}
    </div>
  );
}
