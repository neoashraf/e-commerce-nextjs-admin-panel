import { create } from "zustand";

/**
 * Minimal admin toast system — success/info/error confirmations for CRUD
 * actions (publish/archive/delete, saved, guard messages). Rendered by
 * <ToastViewport /> in an aria-live region.
 */
export interface Toast {
  id: number;
  message: string;
  variant: "success" | "error" | "info";
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, variant?: Toast["variant"]) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, variant = "success") => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper for non-component code. */
export function toast(message: string, variant: Toast["variant"] = "success") {
  useToastStore.getState().push(message, variant);
}
