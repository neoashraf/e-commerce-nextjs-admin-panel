import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E for the admin panel. Drives the running dev server (default
 * http://localhost:3001) in a real browser; the spec seeds the auth store and
 * stubs the backend at the network layer, so no live API/DB is required — which
 * makes it a real layout/responsive check (catches CSS bugs jsdom can't).
 *
 * Run:  E2E_BASE_URL=http://localhost:3001 npx playwright test
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
