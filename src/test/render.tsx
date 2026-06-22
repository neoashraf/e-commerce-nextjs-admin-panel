import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore, type AdminUser } from "@/lib/stores/auth";

/** All catalog.category.* permissions, for screens that exercise every action. */
export const ALL_CATEGORY_PERMS = [
  "catalog.category.read",
  "catalog.category.create",
  "catalog.category.update",
  "catalog.category.delete",
];

/** Seed the auth store so `<Can>` gates render (permissions come from /admin/me). */
export function seedPermissions(permissions: string[]) {
  const admin: AdminUser = {
    id: "admin-1",
    full_name: "Test Admin",
    email: "test@example.com",
    role: "admin",
    permissions,
  };
  useAuthStore.getState().setAdmin(admin);
}

/** Render a client component inside a fresh React Query provider (no retries). */
export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}
