# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Admin panel (Next.js 14 App Router) — multi-stage build.
# Produces a slim runtime image from Next.js standalone output.
# Listens on 3002 to avoid clashing with the backend (3001) and storefront (3000).
# Build:  docker build -t admin --build-arg NEXT_PUBLIC_API_URL=... .
# Run:    docker run -p 3002:3002 admin
# ─────────────────────────────────────────────────────────────────────────────

# ---- Base: pin Node + enable pnpm via corepack ------------------------------
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- Dependencies: install with a cached, frozen lockfile --------------------
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- Builder: compile the Next.js app --------------------------------------
FROM base AS builder
# NEXT_PUBLIC_* values are inlined at build time, so they must be present here.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
# Emit Next.js standalone output (gated in next.config.mjs) for the slim runtime image.
ENV BUILD_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- Runner: minimal production image --------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3002

CMD ["node", "server.js"]
