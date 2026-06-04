"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  type DefaultOptions,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { isApiError } from "@/lib/api/errors";

/**
 * App-wide React Query provider. React Query owns all server state
 * (fe-state-management); never copy fetched data into useState/Context.
 *
 * Retry policy: don't retry 4xx client errors (auth/validation) — only
 * transient 5xx/network, up to twice.
 */
const defaultOptions: DefaultOptions = {
  queries: {
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (isApiError(error) && error.isClientError) return false;
      return failureCount < 2;
    },
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: false,
  },
};

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // One client per browser session; useState keeps it stable across renders.
  const [client] = useState(() => new QueryClient({ defaultOptions }));
  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
