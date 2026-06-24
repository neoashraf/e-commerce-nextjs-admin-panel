import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * Vitest + React Testing Library + MSW harness for the admin FE (fe-testing).
 * jsdom environment, `@/` → `src` alias (mirrors tsconfig paths), and a fixed
 * NEXT_PUBLIC_API_URL so `@/lib/env` doesn't throw at import in tests.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.tsx"],
    env: { NEXT_PUBLIC_API_URL: "http://localhost/api/v1" },
    clearMocks: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
