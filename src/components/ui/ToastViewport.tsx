"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore } from "@/lib/stores/toast";

/**
 * Global toast viewport (aria-live). Mounted once in the root layout; admin
 * screens emit via `toast()` / `useToastStore`. Styled to the design system:
 * surface card + semantic left border/icon, soft shadow (§8.9).
 */
const STYLE = {
  success: { bar: "border-l-success", icon: "text-success", Icon: CheckCircle2 },
  error: { bar: "border-l-error", icon: "text-error", Icon: XCircle },
  info: { bar: "border-l-info", icon: "text-info", Icon: Info },
} as const;

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {toasts.map((t) => {
        const { bar, icon, Icon } = STYLE[t.variant];
        return (
          <div
            key={t.id}
            className={
              "pointer-events-auto flex items-start gap-3 rounded-md border border-border border-l-4 bg-surface px-4 py-3 text-sm text-text shadow-md " +
              bar
            }
          >
            <Icon className={"mt-0.5 h-4 w-4 shrink-0 " + icon} aria-hidden="true" />
            <span className="min-w-0 flex-1 break-words">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 text-text-faint hover:text-text-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
