# Sports E-Commerce — Admin Panel (Frontend)

Admin panel for the Sports E-Commerce platform. Next.js 14 (App Router) +
TypeScript + Tailwind CSS, consuming the backend NestJS REST API. Frontend only —
no DB or server business logic; the backend owns authorization.

> Part of the `e-commerce-workspace`. Specs live in the workspace `docs/`
> (`docs/srs/`, `docs/api-contracts/`); this app implements admin modules 10–16
> plus admin-facing catalog/order management.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 14 App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS (mobile-first) |
| Server state | TanStack React Query |
| Client state | Zustand (auth/session) |
| Forms | React Hook Form + Zod |
| Validation | Zod (also validates API responses at the boundary) |

## Getting started

```bash
pnpm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL to the backend
pnpm dev                     # http://localhost:3000
```

Other scripts: `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend REST API base, incl. `/api/v1` prefix. |

## Project structure

```
src/
  app/
    layout.tsx                 # root layout: React Query provider, no-index metadata
    page.tsx                   # → redirects to /admin/dashboard
    not-found.tsx
    login/                     # public admin login (+ 2FA step)
    (admin)/                   # authenticated route group
      layout.tsx               # AuthGuard + AdminShell (sidebar/topbar)
      error.tsx
      admin/dashboard/         # dashboard (placeholder + loading skeleton)
  components/
    auth/AuthGuard.tsx         # client gate → /login when no token
    shell/                     # Sidebar, Topbar, AdminShell
  config/nav.ts                # sidebar nav, permission-gated per module
  lib/
    env.ts                     # validated public env access
    format.ts                  # BDT ৳ + DD/MM/YYYY formatters
    query-client.tsx           # React Query provider + retry policy
    api/
      client.ts                # typed fetch wrapper, attaches admin token
      errors.ts                # ApiError (platform error envelope)
      form-errors.ts           # map API field errors → RHF setError
      schemas/                 # Zod schemas per domain (auth…)
      hooks/                   # React Query hooks (useAuth…)
    stores/auth.ts             # Zustand admin session (persisted)
    validations/               # form schemas (login…)
```

## Conventions

- All API access goes through `lib/api/client.ts`; never scatter raw `fetch`.
  Responses are validated with Zod (`schema` option) — the backend shape is
  treated as external input.
- Server data lives in **React Query**, client/session state in **Zustand**,
  shareable filters in **URL `searchParams`**, form state in **React Hook Form**.
- Money is transferred as numbers, rendered as BDT `৳` (`lib/format.ts`).
- Admin UI is never indexed (`robots: noindex`); authorization is the backend's
  responsibility — the frontend guard is UX only.

## Status

Foundation only: app init, data layer, admin auth (login/2FA/logout/me), shell,
and a dashboard placeholder. Feature modules are scaffolded next, one per the
workspace SRS, using the workspace frontend skills (`fe-page-scaffold`,
`fe-api-integration`, `fe-form-builder`, …).
