# Sports E-Commerce - Admin Panel

Admin console for a Bangladesh sports e-commerce platform. Store staff use it to manage
the catalog, inventory, orders and exchanges, customers, leads, promotions, site content,
notifications, reports, platform settings, and admin users and roles. Every screen and
action is gated by the signed-in admin's role-based permissions.

This is the frontend only. It consumes the REST API of
[e-commerce-nestjs-backend](https://github.com/neoashraf/e-commerce-nestjs-backend), which
owns all data, business rules and authorization; the permission checks here only decide
what to show. The customer side is
[sports-e-commerce-nextjs-storefront](https://github.com/neoashraf/sports-e-commerce-nextjs-storefront).

## Status

Built for a fixed-scope delivery with a target date of 20 June 2026. Work continued after
delivery, including the customer two-factor (MFA) policy screen, test coverage and fixes;
the latest commit on `main` is from September 2026.

Known gaps, as the code stands:

- The report Schedules tab is hidden (commented out in `ReportTabs.tsx`). The schedules
  page itself still works and opens from the Schedule button on a report.
- `.env.production` still points at `localhost` (marked TODO in the file). Deployed builds
  get their URL from the server's env file (see CI/CD).

## Stack

Versions as declared in `package.json`.

| Concern | Choice |
| --- | --- |
| Framework | Next.js 14.2.15 (App Router), React ^18.3.1 |
| Language | TypeScript ^5.6.3 (strict) |
| Styling | Tailwind CSS ^3.4.13, lucide-react ^1.20.0 icons |
| Charts | recharts ^3.8.1 |
| Server state | @tanstack/react-query ^5.59.0 |
| Client state | zustand ^4.5.5 |
| Forms | react-hook-form ^7.53.0, @hookform/resolvers ^3.9.0 |
| Validation | zod ^3.23.8 (API responses and auth forms) |
| Unit and component tests | vitest ^2.1.9, @testing-library/react ^16.3.2, msw ^2.14.6, jsdom ^25.0.1 |
| End-to-end tests | @playwright/test ^1.61.0 |
| Lint | eslint ^8.57.1 with eslint-config-next 14.2.15 |
| Package manager | pnpm 10.15.0; Node 20 in CI and Docker |

## Screens by module

Module codes follow the project SRS. Everything under `/admin` is inside the authenticated
shell.

| Module | Routes | Notes |
| --- | --- | --- |
| Sign-in (RBAC) | `/login`, `/forgot-password`, `/reset-password`, `/accept-invite` | Email and password with an optional 2FA code step; invite acceptance for new admins |
| Dashboard (DASH) | `/admin/dashboard` | Period selector, KPI cards, alerts, sales and orders trend, status and payment breakdowns, top products, recent activity; widgets shown per role |
| Catalog (CAT) | `/admin/products`, `/admin/products/new`, `/admin/products/[id]`, `/admin/categories`, `/admin/categories/new`, `/admin/categories/[id]`, `/admin/attributes`, `/admin/attributes/new`, `/admin/attributes/[id]`, `/admin/attribute-families`, `/admin/attribute-families/new`, `/admin/attribute-families/[id]` | Product editor with variant matrix, images and linked products; category tree; attributes and attribute families |
| Inventory (INV) | `/admin/inventory`, `/admin/inventory/bulk`, `/admin/inventory/[variantId]/movements` | Per-SKU stock with set and adjust actions and low-stock thresholds, CSV export, bulk CSV update wizard, movement ledger |
| Orders (ORD, PAY) | `/admin/orders`, `/admin/orders/[orderNo]`, `/admin/exchanges`, `/admin/exchanges/[id]` | Order list with a detail drawer, order detail with payment panel, invoice printing, CSV export; exchange queue and review with replacement picker |
| Customers (CUST) | `/admin/customers`, `/admin/customers/[id]` | Directory with filters, tags, bulk tagging and export; customer detail with LTV, order history, notes and account actions |
| Leads (LEAD) | `/admin/leads`, `/admin/leads/[reference]` | Lead inbox and conversation thread |
| Promotions (PROMO) | `/admin/promotions`, `/admin/promotions/new`, `/admin/promotions/[id]` | Coupon list and editor |
| Content (CMS) | `/admin/content/pages`, `/admin/content/pages/new`, `/admin/content/pages/[id]`, `/admin/content/menus`, `/admin/content/merchandising` | Static pages, menus, home banners and home sections (`/admin/content` redirects to pages) |
| Notifications (NOTIF) | `/admin/notifications`, `/admin/notifications/log`, `/admin/notifications/campaigns/new`, `/admin/settings/notifications` | Templates, delivery log, campaigns, settings |
| Reports (RPT) | `/admin/reports/[reportKey]`, `/admin/reports/exports`, `/admin/reports/schedules` | Sales, orders, products, inventory, customers, payments, promotions and search reports; export manager; schedules (`/admin/reports` redirects to sales) |
| Settings (PAY, CART, MFA) | `/admin/settings/payments`, `/admin/settings/delivery`, `/admin/settings/mfa` | Payment gateways, delivery charges, platform-wide customer 2FA channels and enforcement |
| Admin users and audit (RBAC) | `/admin/users`, `/admin/users/new`, `/admin/users/[id]/edit`, `/admin/roles`, `/admin/roles/new`, `/admin/roles/[id]`, `/admin/audit`, `/admin/profile` | Admin invites, roles and permissions, audit log, own profile with password and 2FA |

The shell provides the following:

- **Sidebar.** Filtered by permission.
- **Global search.** Ctrl+K or Cmd+K. It routes to the Orders, Products or Customers list
  with `?q=`.
- **Notification bell.** Fed by a server-sent events stream.
- **Forbidden view.** Shown for routes the admin cannot open.

## State model

- **Server state: TanStack Query.** Hooks live in `src/lib/api/hooks/` (17 files). Every
  response is parsed with a Zod schema from `src/lib/api/schemas/` (14 files).
- **Session and client-only state: Zustand** (`src/lib/stores/`, 3 stores).
  - `auth`: tokens and the signed-in admin, persisted to localStorage.
  - `notifications`: the bell feed. It is loaded from the API, then live events from an
    `EventSource` (`src/lib/hooks/useAdminNotificationStream.ts`) are prepended.
  - `toast`: UI state only.
- **Filters: URL `searchParams`.** Used by 24 files. List filters, search and pagination
  live in the query string. `src/lib/usePageParams.ts` keeps `?page=` and `?limit=` for
  every table.
- **Forms.** React Hook Form + zod is used for the four auth forms (login, forgot
  password, reset password, accept invite). The catalog, content, promotion and settings
  editors use controlled component state.
- **Permissions.** `src/lib/permissions/` provides `usePermissions` and a declarative
  `<Can>` gate, used across screens to hide actions. `src/config/nav.ts` maps each sidebar
  entry to its permission.

## Design

- **Where the designs live.** The admin designs are in `docs/design/` of the private
  `e-commerce-workspace` repository: `admin-design-system.md` and the screen files in
  `admin-panel-design-files/`. They were developed in Claude Design and pulled into the
  workspace through MCP.
- **Theme.** A brand-neutral console: slate neutrals, white cards and one indigo accent
  (`#4F46E5`).
- **How the tokens are set up.** The tokens are local to this repo:
  - `src/app/globals.css` defines CSS variables on `:root`.
  - `tailwind.config.ts` maps Tailwind colours, radius, shadow and font to those
    variables.
  - The file comments say a client re-brands by overriding only the accent ramp.
- **Fonts.** Inter and Hind Siliguri (Bangla), loaded with `next/font/google`.
- **Not shared with the storefront.** The storefront has its own, unrelated theme.

## Architecture

```text
src/
  app/
    layout.tsx            QueryProvider, toasts, fonts, noindex metadata
    login/ forgot-password/ reset-password/ accept-invite/   public auth routes
    (admin)/
      layout.tsx          AuthGuard + AdminShell (sidebar, topbar)
      error.tsx           route-group error boundary
      admin/<module>/     one folder per screen; most have a loading.tsx skeleton
  components/
    <domain>/             admin-users, audit, catalog, content, customers, dashboard,
                          exchanges, inventory, leads, notif, orders, payments, profile,
                          promo, roles, settings
    shell/                AdminShell, Sidebar, Topbar, GlobalSearch, NotificationBell,
                          PermissionBoundary, ForbiddenView, PageSkeletons
    ui/                   shared primitives (Table, Card, StatCard, Drawer, Tabs, ...)
    charts.tsx            recharts wrappers for dashboard and reports
  config/nav.ts           sidebar items and their permissions
  lib/
    api/client.ts         typed fetch wrapper, attaches the admin Bearer token
    api/errors.ts         ApiError for the backend error envelope
    api/hooks/            TanStack Query hooks per domain
    api/schemas/          Zod schemas per domain
    permissions/          usePermissions, <Can>
    stores/               Zustand stores
    exportCsv.ts          client-side CSV export
    env.ts                validated public env access
```

- **Rendering.** Route files are thin: they render a client view from
  `src/components/<domain>/` or a route-local `_components/` folder.
- **Indexing.** The admin UI is never indexed (`robots: noindex`).
- **Authorization.** The client guard is for UX only; the backend enforces access on every
  request.

## Testing

| Kind | Files | Tests | Command |
| --- | --- | --- | --- |
| Component (Vitest + React Testing Library + MSW, jsdom) | 6 | 42 | `pnpm test` |
| Unit (Vitest, API client) | 1 | 2 | `pnpm test` |
| End-to-end (Playwright, desktop and mobile projects) | 1 | 4 per project | `pnpm test:e2e` |

- **Vitest suites.** Live in `__tests__/` folders under `src/`. `src/test/` holds the
  shared MSW server, the provider-wrapped render helper and the setup file. The Vitest
  config sets `NEXT_PUBLIC_API_URL` to `http://localhost/api/v1`.
- **Playwright suite.** Lives in `e2e/`. It drives a running dev server
  (`E2E_BASE_URL`, default `http://localhost:3001`), seeds the auth store and stubs the
  backend at the network layer, so it needs no live API.
- **Running e2e locally.** Install browsers once with `pnpm exec playwright install`.
  End-to-end tests are not part of CI.

## CI/CD

`.github/workflows/ci-cd.yml` runs on every push to `main` or `dev`, and on manual
dispatch. Pushes to other branches and pull requests do not trigger it.

| Job | When | Runs on | What it does |
| --- | --- | --- | --- |
| Lint, typecheck & test | every run | `ubuntu-latest` | `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` |
| Deploy to Home Server | push to `dev` | self-hosted runner `sports-ecommerce-home` | copies the server's `.env`, `docker compose up -d --build`, waits for `http://localhost:6002/` |
| Deploy to Hostinger VPS | push to `main` | self-hosted runner `sports-ecommerce-hostinger` | same steps on the VPS |

`docker compose` passes `NEXT_PUBLIC_API_URL` from that env file as a build argument. The
image is a standalone Next.js build on `node:20-alpine`, listening on 3002 and published on
host port 6002.

## Getting started

```bash
pnpm install
pnpm dev                     # http://localhost:3000
```

`pnpm dev` loads `.env.development`, which points at the team's shared backend on the
office LAN. To use your own backend, create `.env.local`:

```ini
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

(8000 is the backend's default port.) Sign in with an admin account created by the
backend's `seed:rbac` script.

To run the production image locally:

```bash
docker compose up --build    # http://localhost:6002
```

## Scripts

| Script | Command |
| --- | --- |
| `pnpm dev` | `next dev` |
| `pnpm build` | `next build` |
| `pnpm start` | `next start` |
| `pnpm lint` | `next lint` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | `vitest run` |
| `pnpm test:watch` | `vitest` |
| `pnpm test:e2e` | `playwright test` |

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | yes | Backend REST API base, including `/api/v1`. `src/lib/env.ts` throws at import time if it is missing |
| `E2E_BASE_URL` | no | Base URL for the Playwright suite (default `http://localhost:3001`) |

- **Which file applies.** `.env.development` and `.env.production` are committed.
  `.env.local` (gitignored) overrides them.
- **Build time.** `NEXT_PUBLIC_API_URL` is baked into the bundle at build time.
