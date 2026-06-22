import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./server";
import { useAuthStore } from "@/lib/stores/auth";

/**
 * Global test setup (fe-testing): jest-dom matchers, the MSW server lifecycle,
 * and lightweight mocks for the Next App-Router primitives the admin screens use
 * (`useRouter`/`useSearchParams` and `next/link`) so client components render in
 * jsdom without a router provider. The router `push` spy is stable across calls,
 * so a test asserts navigation via `useRouter().push`; `clearMocks` resets its
 * history between tests.
 */
vi.mock("next/navigation", () => {
  const push = vi.fn();
  const noop = vi.fn();
  return {
    useRouter: () => ({ push, replace: noop, back: noop, forward: noop, refresh: noop, prefetch: noop }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/admin/categories",
  };
});

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  useAuthStore.setState({ admin: null, tokens: null });
});

afterAll(() => server.close());
